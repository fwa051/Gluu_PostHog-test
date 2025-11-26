import { useEffect, useMemo, useState } from 'react'
import { startRetentionTimer } from '../posthog'      // .ts module (no .js)
import posthog from '../posthog'
import { api } from '../api'
import UploadWidget from '../components/UploadWidget'
import PaymentHistory from '../components/PaymentHistory'

type User = {
  email?: string
  plan?: 'free' | 'premium' | string
  uploads?: number
  quota?: number
  [k: string]: unknown
}

type Payment = {
  id: string
  amount: number
  status: 'success' | 'fail'
  createdAt?: string
  [k: string]: unknown
}

type PaymentsResp = { payments?: Payment[] }
type UserResp = User

type Props = { user: User | null }

export default function Dashboard({ user: initialUser }: Props) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [seconds, setSeconds] = useState<number>(0)
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    // start retention timer (returns cleanup)
    const stopPH = startRetentionTimer?.()
    // local ticking UI timer
    const iv = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    // load payments
    api
      .get<PaymentsResp>('/payments')
      .then((r) => setPayments(r.data.payments ?? []))
      .catch(() => {})

    return () => {
      stopPH?.()
      window.clearInterval(iv)
    }
  }, [])

  const pct = useMemo<number>(() => {
    const used = user?.uploads ?? 0
    const quota = user?.quota ?? 1
    const p = (used / Math.max(1, quota)) * 100
    return Math.min(100, Math.max(0, Math.round(p)))
  }, [user])

  const remaining = Math.max(0, 120 - seconds)

  const upgradePlan = async () => {
    const r = await api.post<UserResp>('/upgrade')
    setUser(r.data)
    const used = r.data.uploads ?? 0
    const quota = Math.max(1, r.data.quota ?? 1)
    const qp = used / quota
    ;(posthog as any).setPersonProperties?.({ plan: 'premium', quota_pct: qp })
    posthog.capture('plan_upgraded', { quota: r.data.quota })
  }

  const downgradePlan = async () => {
    const r = await api.post<UserResp>('/downgrade')
    setUser(r.data)
    const used = r.data.uploads ?? 0
    const quota = Math.max(1, r.data.quota ?? 1)
    const qp = used / quota
    ;(posthog as any).setPersonProperties?.({ plan: 'free', quota_pct: qp })
    posthog.capture('plan_downgraded', { quota: r.data.quota })
  }

  const resetUsage = async () => {
    const r = await api.post<UserResp>('/reset')
    setUser(r.data)
    ;(posthog as any).setPersonProperties?.({ quota_pct: 0 })
    posthog.capture('usage_reset', { plan: r.data.plan })
  }

  // ---- Simulate Stripe results (pretend webhook) ----
  const simulatePayment = async (result: 'success' | 'fail') => {
    const r = await api.post<{ user: User; payment: Payment }>('/pay/simulate', { result })
    // update plan/quota from server truth
    setUser(r.data.user)
    // refresh payments list
    const p = await api.get<PaymentsResp>('/payments')
    setPayments(p.data.payments ?? [])
    // analytics
    const used = r.data.user.uploads ?? 0
    const quota = Math.max(1, r.data.user.quota ?? 1)
    const qp = used / quota

    if (result === 'success') {
      ;(posthog as any).setPersonProperties?.({ plan: 'premium', quota_pct: qp })
      posthog.capture('payment_succeeded', { provider: 'stripe', amount: r.data.payment.amount })
    } else {
      ;(posthog as any).setPersonProperties?.({ plan: 'free', quota_pct: qp })
      posthog.capture('payment_failed', { provider: 'stripe', amount: r.data.payment.amount })
    }
  }

  return (
    <div className="grid gap-6">
      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat">
          <div className="text-sm text-gray-600">Plan</div>
          <div className="mt-1 text-xl font-semibold">
            {user?.plan === 'premium' ? 'Premium' : 'Free'}
          </div>
          <div className="mt-2 badge">
            {user?.plan === 'premium' ? 'Premium user' : 'identified-only'}
          </div>
        </div>
        <div className="stat">
          <div className="text-sm text-gray-600">Uploads Used</div>
          <div className="mt-1 text-xl font-semibold">{user?.uploads ?? 0}</div>
          <div className="mt-2 text-sm text-gray-500">of {user?.quota ?? 0}</div>
        </div>
        <div className="stat">
          <div className="text-sm text-gray-600">Retention timer</div>
          <div className="mt-1 text-xl font-semibold">{remaining}s</div>
          <div className="mt-2 text-sm text-gray-500">
            fires <code>retention_over_2min</code>
          </div>
        </div>
      </div>

      {/* Quota bar + Plan actions */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Quota usage</h3>
          <span className="text-sm text-gray-600">{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {pct >= 80 && pct < 100 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Near your limit. <code>quota_near_limit</code> will be captured.
          </div>
        )}
        {pct >= 100 && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Limit reached. <code>quota_reached</code> was captured.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {user?.plan !== 'premium' && (
            <button onClick={upgradePlan} className="btn-primary">Upgrade plan → 200</button>
          )}
          {user?.plan === 'premium' && (
            <button onClick={downgradePlan} className="btn-ghost">Downgrade to Free</button>
          )}
          <button onClick={resetUsage} className="btn-ghost">Reset usage</button>
        </div>
      </div>

      {/* Simulate Stripe payment */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Payment (pretend Stripe)</h3>
          <span className="text-sm text-gray-600">Webhook-like state change</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => simulatePayment('success')} className="btn-primary">
            Simulate payment success
          </button>
          <button onClick={() => simulatePayment('fail')} className="btn-ghost">
            Simulate payment failure
          </button>
        </div>

        <div className="mt-4">
          <h4 className="mb-2 font-medium">Payment history</h4>
          <PaymentHistory items={payments} />
        </div>
      </div>

      {/* Uploads */}
      <UploadWidget user={user} onChange={(patch: Partial<User>) => setUser((u) => ({ ...(u ?? {}), ...patch }))} />
    </div>
  )
}

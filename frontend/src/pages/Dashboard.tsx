// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from 'react'
import posthog, { startRetentionTimer } from '../posthog'
import { api } from '../api'
import UploadWidget from '../components/UploadWidget'
import PaymentHistory from '../components/PaymentHistory'

type Plan = 'free' | 'plus' | 'premium'

type User = {
  email?: string
  plan?: Plan
  uploads?: number
  quota?: number
  [k: string]: unknown
}

type Payment = {
  id: string
  amount: number
  status: 'success' | 'fail'
  createdAt?: string
}

type PaymentsResp = { payments?: Payment[] }
type UserResp = User
type Props = { user: User | null }

export default function Dashboard({ user: initialUser }: Props) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [seconds, setSeconds] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    const stopPH = startRetentionTimer?.()
    const iv = window.setInterval(() => setSeconds((s) => s + 1), 1000)

    api.get<PaymentsResp>('/payments')
      .then((r) => setPayments(r.data.payments ?? []))
      .catch(() => {})

    return () => {
      stopPH?.()
      window.clearInterval(iv)
    }
  }, [])

  const pct = useMemo(() => {
    const used = user?.uploads ?? 0
    const quota = user?.quota ?? 1
    return Math.min(100, Math.max(0, Math.round((used / Math.max(1, quota)) * 100)))
  }, [user])

  const remaining = Math.max(0, 120 - seconds)

  // unify PostHog person property updates
  function syncPersonProps(next: User) {
    const used = next.uploads ?? 0
    const quota = Math.max(1, next.quota ?? 1)
    const qp = used / quota
    ;(posthog as any).setPersonProperties?.({
      plan: next.plan ?? 'free',
      quota_pct: qp,
    })
  }

  async function refreshPayments() {
    const p = await api.get<PaymentsResp>('/payments')
    setPayments(p.data.payments ?? [])
  }

  // --------- Plan changes ----------
  const upgradeToPlus = async () => {
    const r = await api.post<UserResp>('/upgrade/plus')
    setUser(r.data)
    syncPersonProps(r.data)
    posthog.capture('plan_upgraded', { to: 'plus', quota: r.data.quota })
    await refreshPayments()
  }

  const upgradeToPremium = async () => {
    const r = await api.post<UserResp>('/upgrade/premium')
    setUser(r.data)
    syncPersonProps(r.data)
    posthog.capture('plan_upgraded', { to: 'premium', quota: r.data.quota })
    await refreshPayments()
  }

  const downgradeToFree = async () => {
    const r = await api.post<UserResp>('/downgrade')
    setUser(r.data)
    syncPersonProps(r.data)
    posthog.capture('plan_downgraded', { to: 'free', quota: r.data.quota })
  }

  const resetUsage = async () => {
    const r = await api.post<UserResp>('/reset')
    setUser(r.data)
    syncPersonProps(r.data)
    posthog.capture('usage_reset', { plan: r.data.plan })
  }

  // --------- Simulated Stripe result ----------
  const simulatePayment = async (result: 'success' | 'fail', tier: 'plus' | 'premium') => {
    const r = await api.post<{ user: User; payment: Payment }>('/pay/simulate', { result, tier })
    setUser(r.data.user)
    syncPersonProps(r.data.user)
    await refreshPayments()

    if (result === 'success') {
      posthog.capture('payment_succeeded', {
        provider: 'stripe',
        amount: r.data.payment.amount,
        tier,
      })
    } else {
      posthog.capture('payment_failed', {
        provider: 'stripe',
        amount: r.data.payment.amount,
        tier,
      })
    }
  }

  return (
    <div className="grid gap-6">
      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat">
          <div className="text-sm text-gray-600">Plan</div>
          <div className="mt-1 text-xl font-semibold">{(user?.plan ?? 'free').toUpperCase()}</div>
          <div className="mt-2 badge">{user?.plan ?? 'free'}</div>
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

      {/* Quota bar + Actions */}
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
          {user?.plan !== 'plus' && (
            <button onClick={upgradeToPlus} className="btn-primary">
              Upgrade → Plus (200)
            </button>
          )}
          {user?.plan !== 'premium' && (
            <button onClick={upgradeToPremium} className="btn-primary">
              Upgrade → Premium (200)
            </button>
          )}
          {user?.plan !== 'free' && (
            <button onClick={downgradeToFree} className="btn-ghost">
              Downgrade to Free
            </button>
          )}
          <button onClick={resetUsage} className="btn-ghost">
            Reset usage
          </button>
        </div>
      </div>

      {/* Simulate Stripe */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Payment (pretend Stripe)</h3>
          <span className="text-sm text-gray-600">Webhook-like state change</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => simulatePayment('success', 'plus')} className="btn-primary">
            Sim success (Plus)
          </button>
          <button onClick={() => simulatePayment('success', 'premium')} className="btn-primary">
            Sim success (Premium)
          </button>
          <button onClick={() => simulatePayment('fail', 'plus')} className="btn-ghost">
            Sim FAIL (Plus)
          </button>
          <button onClick={() => simulatePayment('fail', 'premium')} className="btn-ghost">
            Sim FAIL (Premium)
          </button>
        </div>

        <div className="mt-4">
          <h4 className="mb-2 font-medium">Payment history</h4>
          <PaymentHistory items={payments} />
        </div>
      </div>

      {/* Uploads */}
      <UploadWidget
        user={user}
        onChange={(patch: Partial<User>) => {
          const next = { ...(user ?? {}), ...patch }
          setUser(next)
          syncPersonProps(next)
          const used = next.uploads ?? 0
          const quota = Math.max(1, next.quota ?? 1)
          const percent = (used / quota) * 100
          if (percent >= 100)
            posthog.capture('quota_reached', { uploads: used, quota, quotaPct: percent })
          else if (percent >= 80)
            posthog.capture('quota_near_limit', { uploads: used, quota, quotaPct: percent })
        }}
      />
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { startRetentionTimer } from '../posthog.js'
import posthog from '../posthog.js'
import { api } from '../api.js'
import UploadWidget from '../components/UploadWidget.jsx'
import PaymentHistory from '../components/PaymentHistory.jsx'

export default function Dashboard({ user: initialUser }) {
  const [user, setUser] = useState(initialUser)
  const [seconds, setSeconds] = useState(0)
  const [payments, setPayments] = useState([])

  useEffect(() => {
    const stopPH = startRetentionTimer()
    const iv = setInterval(() => setSeconds(s => s + 1), 1000)
    // load payments
    api.get('/payments').then(r => setPayments(r.data.payments || [])).catch(()=>{})
    return () => { stopPH?.(); clearInterval(iv) }
  }, [])

  const pct = useMemo(() => {
    const p = ((user?.uploads ?? 0) / (user?.quota ?? 1)) * 100
    return Math.min(100, Math.max(0, Math.round(p)))
  }, [user])

  const remaining = Math.max(0, 120 - seconds)

  const upgradePlan = async () => {
    const r = await api.post('/upgrade')
    setUser(r.data)
    const qp = (r.data.uploads || 0) / Math.max(1, r.data.quota || 1)
    posthog.setPersonProperties({ plan: 'premium', quota_pct: qp })
    posthog.capture('plan_upgraded', { quota: r.data.quota })
  }

  const downgradePlan = async () => {
    const r = await api.post('/downgrade')
    setUser(r.data)
    const qp = (r.data.uploads || 0) / Math.max(1, r.data.quota || 1)
    posthog.setPersonProperties({ plan: 'free', quota_pct: qp })
    posthog.capture('plan_downgraded', { quota: r.data.quota })
  }

  const resetUsage = async () => {
    const r = await api.post('/reset')
    setUser(r.data)
    posthog.setPersonProperties({ quota_pct: 0 })
    posthog.capture('usage_reset', { plan: r.data.plan })
  }

  // ---- Simulate Stripe results (pretend webhook) ----
  const simulatePayment = async (result) => {
    const r = await api.post('/pay/simulate', { result })
    // update plan/quota from server truth
    setUser(r.data.user)
    // refresh payments list
    const p = await api.get('/payments'); setPayments(p.data.payments || [])
    // analytics
    if (result === 'success') {
      const qp = (r.data.user.uploads || 0) / Math.max(1, r.data.user.quota || 1)
      posthog.setPersonProperties({ plan: 'premium', quota_pct: qp })
      posthog.capture('payment_succeeded', { provider: 'stripe', amount: r.data.payment.amount })
    } else {
      const qp = (r.data.user.uploads || 0) / Math.max(1, r.data.user.quota || 1)
      posthog.setPersonProperties({ plan: 'free', quota_pct: qp })
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
          <div className="mt-2 text-sm text-gray-500">fires <code>retention_over_2min</code></div>
        </div>
      </div>

      {/* Quota bar + Plan actions */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Quota usage</h3>
          <span className="text-sm text-gray-600">{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700 transition-[width] duration-500" style={{ width: `${pct}%` }} />
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
      <UploadWidget user={user} onChange={(patch) => setUser((u) => ({ ...u, ...patch }))} />
    </div>
  )
}

// src/pages/Login.tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import posthog, { onLoginStartTracking } from '../posthog'

type Plan = 'free' | 'plus' | 'premium'

type User = {
  email: string
  plan?: Plan
  uploads?: number
  quota?: number
  [k: string]: unknown
}

type Props = { onAuth: (u: User) => void }
type LoginResp = User

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  const e = err as any
  return (
    e?.response?.data?.error ??
    e?.response?.data?.message ??
    e?.message ??
    'Login failed'
  )
}

export default function Login({ onAuth }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post<LoginResp>('/login', { email, password })
      const user = res.data
      onAuth(user)

      // Compute quota %
      const uploads = user.uploads ?? 0
      const quota = Math.max(1, user.quota ?? 1)
      const quota_pct = uploads / quota

      // Identify + start session recording + SPA pageview
      onLoginStartTracking({
        id: user.email ?? email,
        email: user.email ?? email,
        plan: (user.plan as Plan) ?? 'free',
      })

      // Persist person properties for analysis
      ;(posthog as unknown as { setPersonProperties?: (p: Record<string, unknown>) => void })
        .setPersonProperties?.({
          email: user.email ?? email,
          registered: true,
          has_uploaded_image: uploads > 0,
          plan: (user.plan as Plan) ?? 'free',
          quota_pct,
        })

      posthog.capture('login_success', { plan: user.plan ?? 'free' })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setError(msg)
      posthog.capture('login_failed', { reason: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Login</h1>
      <form onSubmit={submit} className="space-y-3 card p-4">
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

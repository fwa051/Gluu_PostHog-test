// src/pages/Register.tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import posthog, { onLoginStartTracking } from '../posthog'
import type { User, Plan } from '../types'

type RegisterResp = User

function errMsg(e: unknown): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  const x = e as any
  return x?.response?.data?.error ?? x?.response?.data?.message ?? x?.message ?? 'Registration failed'
}

type Props = { onAuth: (u: User) => void }

export default function Register({ onAuth }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Optional: capture an attempt
    posthog.capture('register_attempt')

    try {
      const res = await api.post<RegisterResp>('/register', { email, password })
      const user = res.data

      // analytics: register_success + identify + start replay
      posthog.capture('register_success')
      onLoginStartTracking({
        id: user.email ?? email,
        email: user.email ?? email,
        plan: (user.plan as Plan) ?? 'free',
      })
      ;(posthog as any).setPersonProperties?.({
        email: user.email ?? email,
        registered: true,
        has_uploaded_image: (user.uploads ?? 0) > 0,
        plan: (user.plan as Plan) ?? 'free',
        quota_pct: (user.uploads ?? 0) / Math.max(1, user.quota ?? 1),
      })

      onAuth(user)                         // set user in App + navigate to dashboard
      navigate('/', { replace: true })
    } catch (e) {
      const msg = errMsg(e)
      setError(msg)
      posthog.capture('register_failed', { reason: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Create an account</h1>
      <form onSubmit={submit} className="space-y-3 card p-4">
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

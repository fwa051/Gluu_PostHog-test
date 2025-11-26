import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'          // no .js
import posthog from '../posthog'      // no .js

type User = {
  email: string
  plan?: string
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
  const navigate = useNavigate()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    try {
      const res = await api.post<LoginResp>('/login', { email, password })
      const user = res.data
      onAuth(user)

      // Identify + person properties
      posthog.identify(user.email ?? email)
      ;(posthog as any).setPersonProperties?.({
        email: user.email ?? email,
        registered: true,
        has_uploaded_image: (user.uploads ?? 0) > 0,
        plan: user.plan ?? 'free',
        quota_pct: (user.uploads ?? 0) / Math.max(1, user.quota ?? 1),
      })

      // Start replay after successful login (we already stop/reset on logout)
      ;(posthog as any).startSessionRecording?.()
      posthog.capture('login_success')

      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setError(msg)
      posthog.capture('login_failed', { reason: msg })
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

        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>
    </div>
  )
}

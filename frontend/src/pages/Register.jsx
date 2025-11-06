import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import posthog from '../posthog.js'

export default function Register({ onAuth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [doUpload, setDoUpload] = useState(true)   // <-- opt-in upload during register
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // 1) create account (sets cookie)
      const res = await api.post('/register', { email, password })
      const user = res.data // { email, uploads, quota, plan }
      onAuth(user)

      // 2) identify person + baseline props
      posthog.identify(email)
      posthog.setPersonProperties({
        email,
        registered: true,
        has_uploaded_image: false,
        plan: user.plan || 'free',
        quota_pct: (user.uploads || 0) / Math.max(1, user.quota || 1),
        first_flow: doUpload ? 'register_with_upload' : 'register_no_upload',
      })
      posthog.startSessionRecording?.()
      posthog.capture('register_success', { with_upload: doUpload })

      // 3) optional first upload immediately after register
      if (doUpload) {
        try {
          const up = await api.post('/upload') // uses auth cookie set above
          const { uploads, quota, quotaPct } = up.data
          onAuth(prev => ({ ...(prev || user), uploads, quota }))
          posthog.setPersonProperties({ has_uploaded_image: true, quota_pct: quotaPct })
          posthog.capture('upload_during_registration', { uploads, quota, quotaPct })
        } catch (err) {
          const msg = err?.response?.data?.error || 'Upload during registration failed'
          posthog.capture('upload_failed_during_registration', { reason: msg })
        }
      } else {
        posthog.capture('register_without_upload')
      }

      navigate('/')
    } catch (e) {
      const msg = e?.response?.data?.error || 'Registration failed'
      setError(msg)
      posthog.capture('register_failed', { reason: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <div className="card p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-gray-600">
            Optionally upload one sample item right after sign up (great for A/B comparisons).
          </p>
        </div>

        <form onSubmit={submit} className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">Email</span>
            <input className="input" placeholder="you@example.com"
                   value={email} onChange={e=>setEmail(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-gray-700">Password</span>
            <input className="input" type="password" placeholder="••••••••"
                   value={password} onChange={e=>setPassword(e.target.value)} />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={doUpload}
                   onChange={e=>setDoUpload(e.target.checked)} />
            <span>Upload one sample item immediately after register</span>
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button className="btn-primary" disabled={loading}>
            {loading ? 'Creating…' : (doUpload ? 'Create & Upload' : 'Create account')}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-600">
        Have an account?{' '}
        <Link to="/login" className="text-gray-900 underline decoration-black/20 underline-offset-4 hover:decoration-black">
          Log in
        </Link>
      </p>
    </div>
  )
}

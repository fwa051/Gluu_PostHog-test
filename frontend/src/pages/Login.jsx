import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import posthog from '../posthog.js'


export default function Login({ onAuth }) {
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [error, setError] = useState('')
const navigate = useNavigate()


const submit = async (e) => {
  e.preventDefault()
  setError('')
  try {
    const res = await api.post('/login', { email, password })
    onAuth(res.data)

    // DO NOT call reset() here. We already reset on logout.
    posthog.identify(email)
    posthog.setPersonProperties({
      email,
      registered: true,
      has_uploaded_image: (res.data.uploads || 0) > 0,
      plan: res.data.plan || 'free',
      quota_pct: (res.data.uploads || 0) / Math.max(1, res.data.quota || 1),
    })
    posthog.startSessionRecording?.()   // <- important after a logout
    posthog.capture('login_success')

    navigate('/')
  } catch (e) {
    const msg = e?.response?.data?.error || 'Login failed'
    setError(msg)
    posthog.capture('login_failed', { reason: msg })
  }
}



return (
<div className="mx-auto grid max-w-md gap-6">
<div className="card p-6">
<div className="mb-4">
<h1 className="text-2xl font-semibold">Welcome back</h1>
<p className="text-sm text-gray-600">Sign in to access your dashboard and start sending events.</p>
</div>
<form onSubmit={submit} className="grid gap-3">
<label className="grid gap-1 text-sm">
<span className="text-gray-700">Email</span>
<input className="input" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
</label>
<label className="grid gap-1 text-sm">
<span className="text-gray-700">Password</span>
<input className="input" placeholder="••••••••" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
</label>
{error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
<button className="btn-primary">Sign in</button>
</form>
</div>
<p className="text-center text-sm text-gray-600">
No account? <Link to="/register" className="text-gray-900 underline decoration-black/20 underline-offset-4 hover:decoration-black">Create one</Link>
</p>
</div>
)
}
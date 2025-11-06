import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { api } from './api.js'
import posthog from './posthog.js'

export default function App() {
  // user: undefined = loading, null = signed out, object = signed in
  const [user, setUser] = useState(undefined)
  const navigate = useNavigate()

  // check session on first load
  useEffect(() => {
    api.get('/me').then(r => setUser(r.data)).catch(() => setUser(null))
  }, [])

  const logout = async () => {
  try { await api.get('/logout') } catch (_) {}
  posthog.capture('logout')
  try { posthog.stopSessionRecording?.() } catch (_) {}
  posthog.reset()                 // clears distinct_id + props
  setUser(null)
  navigate('/login')
}

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded-md bg-black" />
            PostHog Login Demo
          </Link>

          <nav className="flex items-center gap-2">
            {user && user.email ? (
              <>
                <span className="hidden text-sm text-gray-600 md:inline">{user.email}</span>
                {user.plan === 'premium' && <span className="badge">Premium</span>}
                <Link to="/" className="btn-ghost text-sm">Dashboard</Link>
                <button onClick={logout} className="btn-primary text-sm">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">Login</Link>
                <Link to="/register" className="btn-primary text-sm">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {user === undefined ? (
          <div className="card p-6">Loading…</div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />}
            />
            <Route path="/login" element={<Login onAuth={setUser} />} />
            <Route path="/register" element={<Register onAuth={setUser} />} />
          </Routes>
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-gray-500">
        Built for local PostHog testing.
      </footer>
    </div>
  )
}

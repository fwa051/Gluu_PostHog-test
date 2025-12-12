// src/App.tsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import { api } from './api'
import posthog from './posthog'
import './styles.css'
import type { User } from './types'   // <-- use shared types; no local re-declarations

export default function App() {
  // undefined = loading, null = signed out, object = signed in
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const navigate = useNavigate()

  // after login/register
  const handleAuth = (u: User) => {
    setUser(u)
    navigate('/', { replace: true })
  }

  // check session on first load
  useEffect(() => {
    let mounted = true
    api.get<User | null>('/me')
      .then(r => { if (mounted) setUser(r.data ?? null) })
      .catch(() => { if (mounted) setUser(null) })
    return () => { mounted = false }
  }, [])

  const logout = async () => {
    try { await api.get('/logout') } catch {}
    posthog.capture('logout')
    ;(posthog as any).stopSessionRecording?.()
    posthog.reset()
    setUser(null)
    navigate('/login', { replace: true })
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
                {user.plan === 'plus' && <span className="badge">Plus</span>}
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
            <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onAuth={handleAuth} />} />
            <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onAuth={handleAuth} />} />
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

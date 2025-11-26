// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

type Props = {
  /** undefined = still loading, null = signed out, object = signed in */
  user: unknown | null | undefined
  /** where to send unauthenticated users */
  redirectTo?: string
  /** element to show while user is undefined */
  loadingFallback?: ReactNode
  /** wrap a single or multiple elements instead of using <Outlet/> */
  children?: ReactNode
}

export default function ProtectedRoute({
  user,
  redirectTo = '/login',
  loadingFallback = <div className="p-6">Loading…</div>,
  children,
}: Props) {
  if (user === undefined) return <>{loadingFallback}</>   // still checking session
  if (!user) return <Navigate to={redirectTo} replace />  // not signed in
  // children can be any ReactNode; wrap to satisfy return type
  return children ? <>{children}</> : <Outlet />
}

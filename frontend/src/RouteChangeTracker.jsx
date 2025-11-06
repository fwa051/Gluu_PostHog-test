import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import posthog from './posthog.js'

export default function RouteChangeTracker() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    posthog?.capture('$pageview', { $current_url: location.href })
  }, [pathname, search])
  return null
}

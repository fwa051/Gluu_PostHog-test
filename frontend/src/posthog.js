// src/posthog.js
// @ts-check
import posthog from 'posthog-js'

/**
 * @typedef {'free'|'plus'|'premium'} Plan
 * @typedef {{ id?: string, email?: string, plan?: Plan }} PHUser
 */

const PH_KEY  = import.meta.env.VITE_POSTHOG_KEY
const PH_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com'

posthog.init(PH_KEY, {
  api_host: PH_HOST,
  autocapture: true,
  capture_pageview: false,
  session_recording: { maskAllInputs: true, maskInputOptions: { password: true } },
})

posthog.opt_out_capturing?.()

if (!posthog.setPersonProperties) {
  posthog.setPersonProperties = (props = {}) => { try { posthog.capture('$set', props) } catch {} }
}

/** @param {string} [pathname] */
export function trackSPAView(pathname = window.location.pathname) {
  try { posthog.capture('$pageview', { $current_url: window.location.origin + pathname }) } catch {}
}

/** @param {PHUser} [user] */
export function onLoginStartTracking(user = {}) {
  try {
    posthog.opt_in_capturing?.()
    if (user.id) {
      posthog.identify(user.id, {
        email: user.email,
        plan: user.plan || 'free',
      })
    }
    posthog.startSessionRecording?.()
    trackSPAView()
  } catch {}
}

export function onLogoutStopTracking() {
  try { posthog.stopSessionRecording?.() } catch {}
  posthog.reset()
  posthog.opt_out_capturing?.()
}

/**
 * @param {number} [thresholdMs]
 * @param {string} [eventName]
 * @returns {() => void}
 */
export function startRetentionTimer(thresholdMs = 120_000, eventName = 'retention_over_2min') {
  const t = setTimeout(() => { try { posthog.capture(eventName) } catch {} }, thresholdMs)
  return () => clearTimeout(t)
}

export default posthog

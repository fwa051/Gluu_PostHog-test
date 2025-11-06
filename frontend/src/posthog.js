import posthog from 'posthog-js'

const key  = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com'

if (!key) {
  console.warn('No VITE_POSTHOG_KEY; PostHog disabled')
} else {
  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: true,

    // record sessions (both anonymous and identified)
    // exact option names vary by SDK version, so we also start it explicitly below
    session_recording: {
      // keep PII safe:
      maskAllInputs: true,      // masks <input>, <textarea>, contentEditable
      // If your SDK supports these, you can enable them too:
      // recordCanvas: true,     // record <canvas> (charts, etc.)
      // captureNetwork: true,   // log XHR/fetch metadata in replay
      // recordConsole: true,    // show console logs in replay
    },

    person_profiles: 'identified_only',
    debug: true, // see init + capture logs in DevTools console
  })

  // Force-on recording for all sessions (covers older/newer SDK differences)
  try { posthog.startSessionRecording?.() } catch(_) {}
}

export function startRetentionTimer() {
  const t = setTimeout(() => posthog.capture('retention_over_2min', { page: 'Dashboard' }), 120000)
  return () => clearTimeout(t)
}

export default posthog

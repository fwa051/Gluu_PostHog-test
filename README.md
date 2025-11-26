# Gluu PostHog Web — Quick Start 

A minimal React + Vite app wired with **PostHog** for pageviews, funnels, cohorts, and privacy‑safe session recordings. This README is tailored to your current setup (`Gluutest/posthog-web`, branch `test/posthog`).

---

## Overview
- **Purpose:** Add PostHog analytics to Gluu and verify events during development.
- **Key files:**
  - `src/lib/posthog.ts` — SDK init + helpers (`initPostHog`, `identifyUser`, `capture`, `resetAnalytics`, timers).
  - `src/main.tsx` — calls `initPostHog()` and tracks SPA `$pageview` on route changes.
- **Events used (starter taxonomy):**
  - `sign_up_submitted`, `onboarding_completed`, `file_uploaded { source }`
  - `login`, `logout`
  - `payment_attempted`, `payment_succeeded`, `payment_failed`
  - `quota_near_limit`
  - `stayed_2m_after_login`, `stayed_3m`

---

## Prerequisites
- Node.js 18+ and npm
- Git
- A PostHog project (Cloud or self‑hosted)

---

## Getting Started

> If this app lives inside a parent repo (e.g., `Gluutest`), run commands from the **`posthog-web/`** folder.

```bash
# 1) Install deps
npm install

# 2) Environment variables
cp .env.example .env
# Edit .env with your values:
# VITE_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxx
# VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# 3) Run the dev server
npm run dev
# App: http://localhost:5173
```

**Windows one‑liner (PowerShell):**
```powershell
npm i; if (!(Test-Path .env) -and (Test-Path .env.example)) { Copy-Item .env.example .env }; npm run dev
```

---

## Environment Variables (`.env`)

```ini
VITE_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxx
VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

- `VITE_PUBLIC_POSTHOG_KEY`: your **Project API key** from PostHog.
- `VITE_PUBLIC_POSTHOG_HOST`: keep default for PostHog Cloud or set to your self‑hosted URL.

> Never commit real keys. Keep `.env` out of git and provide a `.env.example` instead.

---

## Available Scripts
```bash
npm run dev       # start Vite dev server on :5173
npm run build     # production build to dist/
npm run preview   # serve built app locally
```

---

## Analytics Usage (where to call these)

- **After login**  
  `identifyUser(user.id, { email, name, plan, role }); capture('login', { method }); startStayTimers(true)`

- **On logout**  
  `capture('logout'); resetAnalytics()`

- **Registration / Onboarding / Upload**  
  `capture('sign_up_submitted'); capture('onboarding_completed'); capture('file_uploaded', { source: 'register' | 'profile', file_type, size_kb })`

- **Quota checks**  
  `maybeCaptureQuotaNearLimit(used, limit)`

- **Privacy**  
  Add `data-ph-mask="true"` to sensitive inputs; recordings are already set to `maskAllInputs: true`.

---

## Git & Branch
You’re on `test/posthog` and tracking `origin/test/posthog`. Push with:
```bash
git add -A
git commit -m "docs: add project quick start + PostHog usage"
git push -u origin test/posthog
```

If you later want a standalone repo for just this app, you can split the folder:
```bash
# from repo root (one level above posthog-web)
git subtree split --prefix=posthog-web -b posthog-web-standalone
# create empty GitHub repo then push:
git push https://github.com/<you>/posthog-web.git posthog-web-standalone:main
```

---

## Troubleshooting
- **No events** → confirm `VITE_PUBLIC_POSTHOG_KEY`, check Network tab for `/e/` requests, disable ad‑blockers.
- **Duplicate pageviews** → ensure `$pageview` isn’t fired in multiple places.
- **Wrong user after logout** → ensure `posthog.reset()` runs on logout.
- **Ports busy** → `npx kill-port 5173` or run `npm run dev -- --port 3000`.

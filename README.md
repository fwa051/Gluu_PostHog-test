Gluu PostHog Test

A tiny full-stack playground for the Gluu Admin Dashboard analytics layer.
Frontend is React + TypeScript (Vite); backend is a simple Node server to fake auth, uploads, and payments.
We use PostHog for funnels, events, session replay, and embedded insights.

Features

Email/password login (mock) with PostHog identify

Upload quota (Free vs Premium) + “near limit” and “reached” events

Simulated Stripe outcomes (success / fail)

Session replay gated to start after login

Optional embedded PostHog funnel in the dashboard

TS-safe components: Login, Dashboard, ProtectedRoute, UploadWidget

Tech

Frontend: Vite, React 18, TypeScript, React Router

Analytics: posthog-js (US or EU host)

Styling: Tailwind classes (utility CSS)

Backend: Minimal Node/Express (mock API)

Repo layout
.
├── backend/
│   ├── server.js                 # mock API: /login, /logout, /upload, /upgrade, /payments...
│   └── package.json
├── frontend/
│   ├── index.html                # entry points to /src/main.tsx
│   ├── src/
│   │   ├── main.tsx              # boot + Router + ErrorBoundary
│   │   ├── App.tsx
│   │   ├── api.ts                # tiny fetch wrapper
│   │   ├── posthog.ts            # PostHog init + helpers (replay gated)
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── UploadWidget.tsx
│   │   │   └── PaymentHistory.tsx
│   │   ├── styles.css
│   │   └── vite-env.d.ts
│   └── tsconfig.json
└── README.md

Prereqs

Node 18+

A PostHog project (US or EU)

Quick start
1) Backend (mock API)
cd backend
npm i
npm run start   # starts http://localhost:3001

2) Frontend
cd ../frontend
npm i
cp .env.example .env    # create your env file (see below)
npm run dev             # starts http://localhost:5173


Open http://localhost:5173

Environment variables (frontend)

Create frontend/.env:

# Your PostHog Project API key (starts with PHC_)
VITE_POSTHOG_KEY=PHC_xxx

# Choose ONE host (match your project region)
# US:
VITE_POSTHOG_HOST=https://us.posthog.com
# EU:
# VITE_POSTHOG_HOST=https://eu.posthog.com

# Optional: URL to an embedded funnel (PostHog → Save → Share → Embed)
# Example (do not include quotes or key attr):
# VITE_PH_ONBOARDING_FUNNEL_URL=https://us.posthog.com/embedded/<id>


Important: Never commit real keys. .env is git-ignored.

PostHog behavior in this app

posthog.init runs once in src/posthog.ts

We immediately call stopSessionRecording() so replay does not start for anonymous users

On login success:

posthog.identify(user.email)

setPersonProperties({ plan, quota_pct, has_uploaded_image… })

startSessionRecording() (begin replay)

capture('login_success')

On logout:

stopSessionRecording()

reset() (clears distinct_id and props)

You can switch to full opt-in tracking by calling posthog.opt_out_capturing() after init and posthog.opt_in_capturing() on login.

Event taxonomy (used in the demo)
Event	When	Important properties
login_success	login OK	—
login_failed	login error	reason
logout	user clicks logout	—
upload_attempt	click upload	—
upload_success	upload OK	uploads, quota, quotaPct
upload_failed	upload error	reason
quota_near_limit	80–99% usage	uploads, quota, quotaPct
quota_reached	>=100% usage	uploads, quota, quotaPct
payment_succeeded	simulated success	provider, amount
payment_failed	simulated fail	provider, amount
plan_upgraded	plan → premium	quota
plan_downgraded	plan → free	quota
usage_reset	reset button	plan
retention_over_2min	timer fires	—

Person properties we set: email, plan, registered, has_uploaded_image, quota_pct.

Embedded funnel (optional)

In PostHog: build a funnel (e.g., login_success → upload_success)

Click Save → Share → Embed → copy the embed URL only

Put it into .env as VITE_PH_ONBOARDING_FUNNEL_URL

The Dashboard will render it inside an iframe card

Mock data (optional CSV import)

If you want instant charts, import a small CSV of 20 demo events:

File: posthog_mock_events_20.csv (you can generate or use the one in the repo if present)

PostHog → Data management → Sources → CSV import

Map: event, distinct_id, timestamp, properties (JSON), uuid

Then build a funnel and trends in minutes.

Scripts

Backend

npm run start    # node server.js on :3001


Frontend

npm run dev      # Vite dev on :5173
npm run build    # production build
npm run preview  # preview prod build on :4173

Common issues

Vite still looks for /src/main.jsx
Update frontend/index.html to <script type="module" src="/src/main.tsx"></script> and restart dev server.

TS complains about PostHog methods
Types don’t (yet) include startSessionRecording/stopSessionRecording/setPersonProperties.
We use (posthog as any).startSessionRecording?.() etc. Intentionally.

No events arriving
Check the right host (US vs EU), the Project API key, and that your ad-blocker isn’t blocking PostHog.

Contributing

Branch: git checkout -b feature/xyz

Commit: git commit -m "feat: ..."

Push: git push -u origin feature/xyz

PR to main

License

MIT (for the test project). Replace if your org requires something else.

If you want this README prefilled with your exact embed URL and a larger mock CSV (e.g., 500 events over 30 days) I can generate both for you to commit.

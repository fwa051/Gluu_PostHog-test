const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))

// ---------------- In-memory demo state ----------------
let currentUser = null
const payments = []                      // newest first is fine in demo

function ensureUser(email) {
  if (!currentUser || currentUser.email !== email) {
    currentUser = {
      email,
      plan: 'free',
      uploads: 0,
      quota: 10,
    }
  }
  return currentUser
}
function quotaPct(u) {
  const q = Math.max(1, u.quota ?? 1)
  return Math.min(1, (u.uploads ?? 0) / q)
}

// ---------------- Auth-ish ----------------
app.post('/api/register', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
  const u = ensureUser(email)           // new demo user starts free
  res.status(201).json(u)
})

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
  const u = ensureUser(email)
  res.json(u)
})

app.get('/api/me', (req, res) => res.json(currentUser ?? null))
app.get('/api/logout', (req, res) => { currentUser = null; res.json({ ok: true }) })

// ---------------- Plan management ----------------
app.post('/api/upgrade/plus', (req, res) => {
  if (!currentUser) return res.status(401).json({ error: 'Not logged in' })
  currentUser.plan = 'plus'
  currentUser.quota = 200
  currentUser.uploads = Math.min(currentUser.uploads, currentUser.quota)
  res.json(currentUser)
})

app.post('/api/upgrade/premium', (req, res) => {
  if (!currentUser) return res.status(401).json({ error: 'Not logged in' })
  currentUser.plan = 'premium'
  currentUser.quota = 200
  currentUser.uploads = Math.min(currentUser.uploads, currentUser.quota)
  res.json(currentUser)
})

app.post('/api/downgrade', (req, res) => {
  if (!currentUser) return res.status(401).json({ error: 'Not logged in' })
  currentUser.plan = 'free'
  currentUser.quota = 10
  currentUser.uploads = Math.min(currentUser.uploads, currentUser.quota)
  res.json(currentUser)
})

app.post('/api/reset', (req, res) => {
  if (!currentUser) return res.status(401).json({ error: 'Not logged in' })
  currentUser.uploads = 0
  res.json(currentUser)
})

// ---------------- Payments (simulated “webhook”) ----------------
app.get('/api/payments', (req, res) => res.json({ payments }))

app.post('/api/pay/simulate', (req, res) => {
  if (!currentUser) return res.status(401).json({ error: 'Not logged in' })
  const { result, tier } = req.body || {}  // tier: 'plus' | 'premium'
  const amount = tier === 'premium' ? 1995 : 195  // cents just as example

  const p = {
    id: String(Date.now()),
    amount,
    status: result === 'success' ? 'success' : 'fail',
    createdAt: new Date().toISOString(),
  }
  payments.unshift(p)

  if (result === 'success') {
    if (tier === 'premium') {
      currentUser.plan = 'premium'
      currentUser.quota = 200
    } else {
      currentUser.plan = 'plus'
      currentUser.quota = 200
    }
    currentUser.uploads = Math.min(currentUser.uploads, currentUser.quota)
  }
  res.json({ user: currentUser, payment: p })
})

// ---------------- Uploads ----------------
app.post('/api/upload', (req, res) => {
  if (!currentUser) return res.status(401).json({ error: 'Not logged in' })
  if (currentUser.uploads >= currentUser.quota) {
    return res.status(429).json({ error: 'Quota reached' })
  }
  currentUser.uploads += 1
  res.json({
    uploads: currentUser.uploads,
    quota: currentUser.quota,
    quotaPct: quotaPct(currentUser),
  })
})

const PORT = 4242
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))

// backend/server.js  (CommonJS)
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_123';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json()); // NOTE: for real Stripe webhooks you need express.raw(...) on that route only
app.use(cookieParser());

// ---- In-memory data ---------------------------------------------------------
const users = new Map(); // email -> { id, email, passwordHash, uploads, quota, plan, payments[], createdAt }
let nextId = 1;
const FREE_UPLOAD_QUOTA = 5;
const PREMIUM_UPLOAD_QUOTA = 200;

// helpers
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = req.cookies['auth'];
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function pushPayment(user, payment) {
  user.payments ||= [];
  user.payments.unshift(payment);
}

// ---- Health -----------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- Auth -------------------------------------------------------------------
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users.has(email)) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nextId++,
    email,
    passwordHash,
    uploads: 0,
    quota: FREE_UPLOAD_QUOTA,
    plan: 'free', // 'free' | 'premium'
    payments: [],
    createdAt: new Date().toISOString()
  };
  users.set(email, user);

  const token = signToken(user);
  res.cookie('auth', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = users.get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.cookie('auth', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan });
});

app.get('/api/logout', (_req, res) => {
  res.clearCookie('auth');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });
  res.json({ email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan });
});

// ---- Product actions --------------------------------------------------------
app.post('/api/upload', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });

  if (user.uploads >= user.quota) {
    return res.status(403).json({ error: 'Quota reached', uploads: user.uploads, quota: user.quota });
  }
  user.uploads += 1;
  users.set(user.email, user);

  const quotaPct = user.uploads / user.quota;
  res.json({ uploads: user.uploads, quota: user.quota, quotaPct });
});

app.post('/api/upgrade', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });
  user.plan = 'premium';
  user.quota = PREMIUM_UPLOAD_QUOTA;
  users.set(user.email, user);
  res.json({ email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan });
});

app.post('/api/downgrade', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });
  user.plan = 'free';
  user.quota = FREE_UPLOAD_QUOTA;
  if (user.uploads > user.quota) user.uploads = user.quota;
  users.set(user.email, user);
  res.json({ email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan });
});

app.post('/api/reset', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });
  user.uploads = 0;
  users.set(user.email, user);
  res.json({ email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan, quotaPct: 0 });
});

// ---- Payments (pretend Stripe) ---------------------------------------------
// Simulate a checkout result for the *current* user (dev only)
app.post('/api/pay/simulate', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });

  const {
    result = 'success',        // 'success' | 'fail'
    amount = 999,              // cents
    currency = 'usd'
  } = req.body || {};

  const payment = {
    id: 'pay_' + Date.now(),
    provider: 'stripe',
    status: result === 'success' ? 'succeeded' : 'failed',
    amount,
    currency,
    via: 'simulate',
    createdAt: new Date().toISOString()
  };
  pushPayment(user, payment);

  if (payment.status === 'succeeded') {
    user.plan = 'premium';
    user.quota = PREMIUM_UPLOAD_QUOTA;
  } else {
    user.plan = 'free';
    user.quota = FREE_UPLOAD_QUOTA;
    if (user.uploads > user.quota) user.uploads = user.quota;
  }
  users.set(user.email, user);

  res.json({
    user: { email: user.email, uploads: user.uploads, quota: user.quota, plan: user.plan },
    payment
  });
});

// Return current user's payments
app.get('/api/payments', auth, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) return res.status(401).json({ error: 'Not found' });
  res.json({ payments: user.payments || [] });
});

// "Webhook" receiver (pretend). In real Stripe, you verify signature on raw body.
app.post('/api/webhook/stripe', (req, res) => {
  // DEV ONLY: expect { email, type, amount, currency }
  const { email, type, amount = 999, currency = 'usd' } = req.body || {};
  const user = users.get(email);
  if (!user) return res.status(200).json({ ok: true, note: 'User not found; ignoring for dev' });

  let status = 'ignored';
  if (type === 'checkout.session.completed' || type === 'payment_succeeded') {
    user.plan = 'premium';
    user.quota = PREMIUM_UPLOAD_QUOTA;
    status = 'succeeded';
  } else if (type === 'invoice.payment_failed' || type === 'payment_failed') {
    user.plan = 'free';
    user.quota = FREE_UPLOAD_QUOTA;
    if (user.uploads > user.quota) user.uploads = user.quota;
    status = 'failed';
  }

  pushPayment(user, {
    id: 'wh_' + Date.now(),
    provider: 'stripe',
    status,
    amount,
    currency,
    via: 'webhook',
    createdAt: new Date().toISOString()
  });
  users.set(user.email, user);

  res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

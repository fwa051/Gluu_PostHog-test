// generate_posthog_mock.js
// Creates posthog_mock_events_500.csv compatible with PostHog CSV import
// Columns: event,distinct_id,timestamp,properties,uuid

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const N_EVENTS = 500;
const N_USERS = 60;
const users = Array.from({ length: N_USERS }, (_, i) => `u-${1000 + i}`);

const events = [
  "register",
  "login_success",
  "login_failed",
  "logout",
  "upload_attempt",
  "upload_success",
  "upload_failed",
  "quota_near_limit",
  "quota_reached",
  "payment_succeeded",
  "payment_failed",
  "plan_upgraded",
  "plan_downgraded",
  "usage_reset",
  "retention_over_2min",
];

// rough weights to look realistic
const weights = {
  register: 3,
  login_success: 18,
  login_failed: 2,
  logout: 10,
  upload_attempt: 10,
  upload_success: 16,
  upload_failed: 4,
  quota_near_limit: 5,
  quota_reached: 2,
  payment_succeeded: 5,
  payment_failed: 2,
  plan_upgraded: 3,
  plan_downgraded: 1,
  usage_reset: 2,
  retention_over_2min: 6,
};

function pickWeighted() {
  const bag = [];
  for (const e of events) for (let i = 0; i < weights[e]; i++) bag.push(e);
  return bag[Math.floor(Math.random() * bag.length)];
}

const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

// per-user state
const state = Object.fromEntries(
  users.map((u) => [u, { plan: "Free", uploads: 0, quota: 10 }])
);

function iso(ts) {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function randTimestamp(i) {
  // evenly spaced then jitter
  const base = new Date(start.getTime() + i * 90 * 60 * 1000 + Math.floor(Math.random() * 80) * 1000);
  return iso(base);
}

function json(obj) {
  return JSON.stringify(obj);
}

let rows = [];
for (let i = 0; i < N_EVENTS; i++) {
  const u = users[Math.floor(Math.random() * users.length)];
  const s = state[u];
  const ev = pickWeighted();
  let props = {};

  switch (ev) {
    case "register":
      props = { plan: s.plan };
      break;
    case "login_success":
      props = { plan: s.plan };
      break;
    case "login_failed":
      props = { reason: ["bad password", "rate_limit", "captcha_failed"][Math.floor(Math.random() * 3)] };
      break;
    case "logout":
      break;
    case "upload_attempt":
      break;
    case "upload_success": {
      if (s.uploads < s.quota) s.uploads += 1;
      const pct = +(s.uploads / s.quota).toFixed(3);
      props = { uploads: s.uploads, quota: s.quota, quotaPct: pct };

      // occasionally emit derived near-limit / reached right after
      if (pct >= 0.8 && pct < 1 && Math.random() < 0.5) {
        rows.push({
          event: "quota_near_limit",
          distinct_id: u,
          timestamp: iso(new Date(randTimestamp(i)).getTime() + 5000),
          properties: json({ uploads: s.uploads, quota: s.quota, quotaPct: pct }),
          uuid: randomUUID(),
        });
      }
      if (pct >= 1 && Math.random() < 0.6) {
        rows.push({
          event: "quota_reached",
          distinct_id: u,
          timestamp: iso(new Date(randTimestamp(i)).getTime() + 8000),
          properties: json({ uploads: s.uploads, quota: s.quota, quotaPct: 1 }),
          uuid: randomUUID(),
        });
      }
      break;
    }
    case "upload_failed":
      props = { reason: ["timeout", "file_too_large", "network_error"][Math.floor(Math.random() * 3)] };
      break;
    case "quota_near_limit": {
      const target = Math.max(s.uploads, Math.floor(0.8 * s.quota));
      s.uploads = Math.min(target, s.quota - 1);
      const pct = +(s.uploads / s.quota).toFixed(3);
      props = { uploads: s.uploads, quota: s.quota, quotaPct: pct };
      break;
    }
    case "quota_reached":
      s.uploads = s.quota;
      props = { uploads: s.uploads, quota: s.quota, quotaPct: 1 };
      break;
    case "payment_succeeded":
      s.plan = "Premium";
      s.quota = 200;
      props = { provider: "stripe", amount: 200 };
      rows.push({
        event: "plan_upgraded",
        distinct_id: u,
        timestamp: iso(new Date(randTimestamp(i)).getTime() + 6000),
        properties: json({ quota: s.quota }),
        uuid: randomUUID(),
      });
      break;
    case "payment_failed":
      props = { provider: "stripe", amount: 200 };
      break;
    case "plan_upgraded":
      s.plan = "Premium";
      s.quota = 200;
      props = { quota: s.quota };
      break;
    case "plan_downgraded":
      s.plan = "Free";
      s.quota = 10;
      s.uploads = Math.min(s.uploads, s.quota);
      props = { quota: s.quota };
      break;
    case "usage_reset":
      s.uploads = 0;
      props = { plan: s.plan };
      break;
    case "retention_over_2min":
      break;
  }

  rows.push({
    event: ev,
    distinct_id: u,
    timestamp: randTimestamp(i),
    properties: json(props),
    uuid: randomUUID(),
  });
}

// keep exactly 500 (truncate if derived ones overflowed)
rows = rows.slice(0, N_EVENTS);

// write CSV
const out = path.resolve(process.cwd(), "posthog_mock_events_500.csv");
const header = "event,distinct_id,timestamp,properties,uuid\n";
const body = rows
  .map(
    (r) =>
      `${r.event},${r.distinct_id},${r.timestamp},"${r.properties.replace(/"/g, '""')}",${r.uuid}`
  )
  .join("\n");

fs.writeFileSync(out, header + body, "utf8");
console.log("Wrote:", out, "rows:", rows.length);

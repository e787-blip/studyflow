'use strict';
/* ── Who is calling, and what they have paid for — shared by every endpoint
   that costs money ─────────────────────────────────────────────────────────
   The leading underscore keeps Vercel from serving this file.

   Until Oct 2026 nothing on the server knew who was calling or what they had
   paid for. The plan lived only in the browser (`studyflow_user.tier`), so:
     - dashboard.html?upgraded=vip made any account VIP, no payment needed;
     - a paying learner who signed in on a new device was Free there;
     - api/generate, api/chat and api/extract answered anyone, signed in or
       not, so anyone could spend the Anthropic key.
   Now the endpoints call requireUser() and, where a plan matters, tierOf().
   The browser's copy of the tier is only a cache of what api/account says.

   The tier is read from users/{email} in Firestore, which api/webhook.js
   writes when Stripe confirms a payment. When there is no record - a learner
   who paid before the webhook could write (it could not until Oct 2026), or
   a payment whose webhook has not landed yet - Stripe itself is asked, and
   the answer is written back so the next read is Firestore alone. */

const { fetchWithTimeout, serviceAccount, makeDb } = require('./_firestore');

/* Explicit, so an unknown price is 'free', never a paid plan. */
const PRICE_TIERS = {
  'price_1TTxA2FFG0oviXd9TJGT1aAJ': 'pro',
  'price_1TTxAOFFG0oviXd97LZFacnr': 'vip',
  'price_1TTxArFFG0oviXd9Nl39k8ZM': 'classroom',
  'price_1TTxBDFFG0oviXd9wIKwRlUm': 'school',
};
const TIERS = { free: 1, pro: 1, vip: 1, classroom: 1, school: 1 };
/* Two live subscriptions on one account (nothing stops buying a second yet):
   the higher one wins. */
const RANK = { free: 0, pro: 1, vip: 2, classroom: 3, school: 4 };

/* The owner's own accounts are always VIP. sf-owner.js holds the same list
   for the pages; change both. */
const OWNERS = ['ethanhwang787@gmail.com'];

function isOwner(email) {
  return OWNERS.indexOf(String(email || '').toLowerCase().trim()) >= 0;
}

// ── Who is asking ─────────────────────────────────────────────────────────

/* accounts:lookup rejects an expired or forged token, so a token that comes
   back with a user is a real, current sign-in. Cached briefly: a plan build
   makes a call per day, and a teacher's dashboard three on load. */
const userCache = new Map();
const USER_CACHE_MS = 5 * 60 * 1000;

async function verifyUser(req, apiKey) {
  const m = /^Bearer\s+(\S+)$/.exec((req.headers && req.headers.authorization) || '');
  if (!m || m[1].length > 4096 || !apiKey) return null;
  const token = m[1];
  const hit = userCache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;

  const r = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
  );
  const data = await r.json().catch(() => ({}));
  const u = data.users && data.users[0];
  if (!u || !u.localId || !u.email || u.disabled) return null;

  const user = { uid: u.localId, email: String(u.email).toLowerCase().trim(), name: u.displayName || '' };
  if (userCache.size > 500) userCache.clear();
  userCache.set(token, { user, until: Date.now() + USER_CACHE_MS });
  return user;
}

/* For an endpoint that must not answer a stranger. Returns the user, or
   sends the 401 itself and returns null - the caller just returns. A server
   with no FIREBASE_API_KEY refuses everyone (503) rather than falling back
   to answering anyone. */
async function requireUser(req, res) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'auth_not_configured', message: 'Sign-in is not set up on the server.' });
    return null;
  }
  let user = null;
  try { user = await verifyUser(req, apiKey); } catch (e) { console.error('[account] verify', e.message); }
  if (!user) {
    res.status(401).json({ error: 'sign_in_required', message: 'Sign in again to keep going.' });
    return null;
  }
  return user;
}

// ── What they have paid for ───────────────────────────────────────────────

function stripeGet(path) {
  return fetchWithTimeout('https://api.stripe.com/v1/' + path, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  }).then(r => r.json());
}

/* The best live plan Stripe has for this email, 'free' when it has none,
   null when Stripe could not be asked. Stripe's email filter is exact, so
   the address is tried as given and lower-cased. */
async function stripeTier(email) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const seen = {};
    let best = 'free';
    for (const e of Array.from(new Set([email, String(email).toLowerCase()]))) {
      const list = await stripeGet('customers?limit=10&email=' + encodeURIComponent(e));
      if (!list || !Array.isArray(list.data)) return null;
      for (const c of list.data) {
        if (!c || !c.id || seen[c.id]) continue;
        seen[c.id] = 1;
        const subs = await stripeGet('subscriptions?status=all&limit=20&customer=' + encodeURIComponent(c.id));
        if (!subs || !Array.isArray(subs.data)) return null;
        for (const s of subs.data) {
          if (!s || (s.status !== 'active' && s.status !== 'trialing')) continue;
          const price = s.items && s.items.data && s.items.data[0] && s.items.data[0].price;
          const t = PRICE_TIERS[price && price.id] || 'free';
          if (RANK[t] > RANK[best]) best = t;
        }
      }
    }
    return best;
  } catch (e) {
    console.error('[account] stripe', e.message);
    return null;
  }
}

/* The tier this account has paid for. `fresh` asks Stripe even when
   Firestore has a record: the dashboard does that once after a checkout,
   because the webhook may not have landed yet. Any failure answers what is
   on record, else 'free' - never a paid tier nobody confirmed. */
const tierCache = new Map();
const TIER_CACHE_MS = 60 * 1000;   // the tutor asks on every message

async function tierOf(user, opts) {
  opts = opts || {};
  if (isOwner(user.email)) return 'vip';
  const hit = !opts.fresh && tierCache.get(user.email);
  if (hit && hit.until > Date.now()) return hit.tier;
  const tier = await lookUpTier(user, opts);
  if (tierCache.size > 500) tierCache.clear();
  tierCache.set(user.email, { tier, until: Date.now() + TIER_CACHE_MS });
  return tier;
}

async function lookUpTier(user, opts) {
  const sa = serviceAccount();
  if (!sa) return 'free';
  const db = makeDb(sa);
  const path = `users/${encodeURIComponent(user.email)}`;
  let onRecord = null;
  try {
    const doc = await db.get(path);
    const t = doc && String(doc.data.tier || '').toLowerCase();
    if (t && TIERS[t]) onRecord = t;
  } catch (e) { console.error('[account] firestore', e.message); }
  if (onRecord && !opts.fresh) return onRecord;

  const fromStripe = await stripeTier(user.email);
  if (fromStripe === null) return onRecord || 'free';
  if (fromStripe !== onRecord) {
    try {
      await db.patch(path, { tier: fromStripe, email: user.email, updatedAt: new Date().toISOString(), source: 'stripe' });
    } catch (e) { console.error('[account] write', e.message); }
  }
  return fromStripe;
}

// ── How much each account may use ─────────────────────────────────────────
/* A sign-in is not a limit: a free account could still run the AI all day
   from a script. These caps are the real cost ceiling, counted per account
   per UTC day in usage/{email}. They are far above what studying needs - a
   14-day plan with every retry is about 50 calls, a lesson about 10 - so a
   learner never meets them and a runaway loop or a script does. */
const DAILY = {
  ai:   { free: 150, pro: 300, vip: 600, classroom: 600, school: 600 },  // generate, extract, illustration
  chat: { free: 0,   pro: 0,   vip: 200, classroom: 0,   school: 0 }     // the study tutor (VIP)
};
/* Plans a month and days a plan, as the pricing page sells them. */
const PLAN_LIMITS = {
  free:      { plans: 1,   days: 7 },
  pro:       { plans: 5,   days: 14 },
  vip:       { plans: 999, days: 999 },
  classroom: { plans: 999, days: 999 },
  school:    { plans: 999, days: 999 }
};

function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }

function usageDb() {
  const sa = serviceAccount();
  return sa ? makeDb(sa) : null;
}

/* Read usage/{email}, change it, write it back only if nobody wrote in
   between (two calls at once must not both pass the cap). `change` returns
   the new fields, or null to write nothing. Any failure answers `onError`:
   a broken counter must not stop learners studying. */
async function withUsage(user, change, onError) {
  const db = usageDb();
  if (!db) return onError;
  const id = encodeURIComponent(user.email);
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const doc = await db.get('usage/' + id);
      const cur = doc ? doc.data : {};
      const out = change(cur);
      if (!out || !out.write) return out ? out.result : onError;
      const ok = doc ? await db.put('usage/' + id, out.write, doc.updateTime)
                     : await db.create('usage', user.email, out.write);
      if (ok) return out.result;
    }
  } catch (e) { console.error('[account] usage', e.message); }
  return onError;
}

/* One more call of `kind` today, if the account has any left.
   -> { ok: true } or { ok: false, limit, tier } */
async function spend(user, kind) {
  if (isOwner(user.email)) return { ok: true };
  const tier = await tierOf(user);
  const limit = (DAILY[kind] || DAILY.ai)[tier] || 0;
  const day = today();
  return withUsage(user, cur => {
    const fresh = cur.day !== day;
    const used = fresh ? 0 : (Number(cur[kind]) || 0);
    if (used >= limit) return { result: { ok: false, limit, tier } };
    const next = Object.assign({}, cur, { email: user.email, day });
    if (fresh) { next.ai = 0; next.chat = 0; }
    next[kind] = used + 1;
    return { write: next, result: { ok: true } };
  }, { ok: true });
}

/* For an endpoint: sends 429 itself when the account is over today's cap. */
async function allow(res, user, kind) {
  const r = await spend(user, kind);
  if (r.ok) return true;
  res.status(429).json({ error: 'daily_limit', limit: r.limit,
    message: kind === 'chat' ? 'You have used today\'s tutor messages. They reset tomorrow.'
                             : 'You have used today\'s AI limit. It resets tomorrow.' });
  return false;
}

/* Plans built this month. The plan builder asks before it starts
   (planCheck) and reports each plan it saved (planBuilt), so a build that
   fails costs nothing. Someone who rewrites the page could skip the report;
   the daily cap above still holds them. */
function planIds(cur) {
  if (cur.month !== thisMonth()) return [];
  try { const a = JSON.parse(cur.planIds || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

async function planCheck(user, days) {
  const tier = await tierOf(user);
  const lim = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
  if (isOwner(user.email)) return { ok: true, tier, used: 0, limit: lim.plans, maxDays: lim.days };
  const db = usageDb();
  let used = 0;
  if (db) {
    try {
      const doc = await db.get('usage/' + encodeURIComponent(user.email));
      used = doc ? planIds(doc.data).length : 0;
    } catch (e) { console.error('[account] planCheck', e.message); }
  }
  const out = { tier, used, limit: lim.plans, maxDays: lim.days };
  if (used >= lim.plans) return Object.assign(out, { ok: false, error: 'plan_limit' });
  if (Number(days) > lim.days) return Object.assign(out, { ok: false, error: 'too_many_days' });
  return Object.assign(out, { ok: true });
}

async function planBuilt(user, planId) {
  const pid = String(planId || '').replace(/[^\w.-]/g, '').slice(0, 40);
  if (!pid) return { ok: false };
  const month = thisMonth();
  return withUsage(user, cur => {
    const ids = planIds(cur);
    if (ids.indexOf(pid) >= 0) return { result: { ok: true, used: ids.length } };   // counted already
    ids.push(pid);
    const next = Object.assign({}, cur, { email: user.email, month, planIds: JSON.stringify(ids.slice(-60)) });
    return { write: next, result: { ok: true, used: ids.length } };
  }, { ok: true });
}

// ── Stripe: the customer, one plan at a time, and the manage-plan page ──────

/* Every Stripe customer with this email (as given and lower-cased: Stripe's
   filter is exact). null when Stripe could not be asked. */
async function stripeCustomers(email) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const out = [], seen = {};
    for (const e of Array.from(new Set([email, String(email).toLowerCase()]))) {
      const list = await stripeGet('customers?limit=10&email=' + encodeURIComponent(e));
      if (!list || !Array.isArray(list.data)) return null;
      list.data.forEach(c => { if (c && c.id && !seen[c.id]) { seen[c.id] = 1; out.push(c.id); } });
    }
    return out;
  } catch (e) { console.error('[account] customers', e.message); return null; }
}

/* The customer holding a live subscription, else the newest customer, else
   null. { customer, live } - live is true when a subscription is active. */
async function stripeAccount(email) {
  const ids = await stripeCustomers(email);
  if (!ids || !ids.length) return { customer: null, live: false };
  for (const id of ids) {
    const subs = await stripeGet('subscriptions?status=all&limit=20&customer=' + encodeURIComponent(id));
    const live = subs && Array.isArray(subs.data) &&
      subs.data.some(s => s && (s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'));
    if (live) return { customer: id, live: true };
  }
  return { customer: ids[0], live: false };
}

/* Stripe's own page for changing or cancelling a plan. Needs the Customer
   Portal switched on in the Stripe dashboard. */
async function portalUrl(user, returnUrl) {
  const acct = await stripeAccount(user.email);
  if (!acct.customer) return { error: 'no_subscription' };
  const r = await fetchWithTimeout('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ customer: acct.customer, return_url: returnUrl })
  });
  const d = await r.json().catch(() => ({}));
  if (!d || !d.url) {
    console.error('[account] portal', JSON.stringify(d && d.error || d).slice(0, 200));
    return { error: 'portal_unavailable' };
  }
  return { url: d.url };
}

// ── A small shared cache (illustration picks) ─────────────────────────────

async function cacheGet(name, key, maxAgeMs) {
  const db = usageDb();
  if (!db) return null;
  try {
    const doc = await db.get(name + '/' + encodeURIComponent(key));
    if (!doc || !doc.data.value) return null;
    if (Date.now() - Date.parse(doc.data.at || 0) > maxAgeMs) return null;
    return JSON.parse(doc.data.value);
  } catch (e) { return null; }
}

async function cachePut(name, key, value) {
  const db = usageDb();
  if (!db) return;
  try {
    await db.put(name + '/' + encodeURIComponent(key), { value: JSON.stringify(value), at: new Date().toISOString() });
  } catch (e) { console.error('[account] cachePut', e.message); }
}

module.exports = { PRICE_TIERS, OWNERS, DAILY, PLAN_LIMITS, isOwner, verifyUser, requireUser, stripeTier, tierOf,
                   spend, allow, planCheck, planBuilt, stripeAccount, portalUrl, cacheGet, cachePut };

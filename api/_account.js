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

module.exports = { PRICE_TIERS, OWNERS, isOwner, verifyUser, requireUser, stripeTier, tierOf };

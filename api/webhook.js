'use strict';
const { serviceAccount, makeDb } = require('./_firestore');
const FETCH_TIMEOUT_MS = 10000;
const REPLAY_WINDOW_SECS = 300; // 5 minutes — Stripe standard

/* Price ids -> tiers live in api/_account.js, which api/account.js also
   uses to ask Stripe directly. Unknown ids fall back to 'free', not 'pro'. */
const { PRICE_TIERS, stripeTier } = require('./_account');

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) return res.status(400).json({ error: 'Missing signature or secret' });

  // Read raw body for signature verification
  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch (err) {
    return res.status(400).json({ error: 'Could not read request body' });
  }

  // Verify Stripe signature (replay-attack protection included)
  try {
    const crypto = require('crypto');
    const parts = sig.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    if (!tPart) return res.status(400).json({ error: 'Malformed signature header' });

    const timestamp = tPart.split('=')[1];
    const ageSecs = Math.abs(Date.now() / 1000 - parseInt(timestamp));
    if (ageSecs > REPLAY_WINDOW_SECS)
      return res.status(400).json({ error: 'Webhook timestamp too old' });

    const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.split('=')[1]);
    if (signatures.length === 0) return res.status(400).json({ error: 'No v1 signature found' });

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const valid = signatures.some(s => {
      try {
        const sBuf = Buffer.from(s, 'hex');
        // Buffers must be same length for timingSafeEqual
        return sBuf.length === expectedBuf.length
          && crypto.timingSafeEqual(sBuf, expectedBuf);
      } catch { return false; }
    });
    if (!valid) return res.status(400).json({ error: 'Invalid signature' });
  } catch (err) {
    console.error('[webhook.js] sig verify error:', err.message);
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  try {
    const sub = event.data?.object;
    if (!sub) return res.status(200).json({ received: true }); // unknown event shape — ack and ignore

    const customerId = sub.customer;
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    // Unknown price → 'free', not 'pro' (safe default)
    const tier = PRICE_TIERS[priceId] ?? 'free';
    const status = sub.status;

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      if (status === 'active' || status === 'trialing') await updateUserTier(customerId, tier);
      else if (['canceled', 'unpaid', 'past_due'].includes(status)) await updateUserTier(customerId, 'free');
    } else if (event.type === 'customer.subscription.deleted') {
      await updateUserTier(customerId, 'free');
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook.js] handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function updateUserTier(customerId, tier) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY');

  // Get customer email from Stripe
  const custResp = await fetchWithTimeout(
    `https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );
  const customer = await custResp.json();
  const email = customer.email;
  if (!email) {
    console.error('[webhook.js] No email for customer:', customerId);
    return;
  }

  /* Written as the service account (api/_firestore.js). This used to send
     `Bearer ${FIREBASE_SERVICE_KEY}` - a fixed key where Firestore wants a
     short-lived OAuth token - so with the database denying all client
     access the tier never landed, and api/class.js could not see that a
     teacher had paid for Classroom. Lower-cased, because that is how
     class.js looks the account up. */
  const sa = serviceAccount();
  if (!sa) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  const key = String(email).toLowerCase().trim();
  /* The event names ONE subscription. If this account has another live one
     (bought before checkout refused a second), cancelling either must not
     set the account to free: ask Stripe what is still live. When Stripe
     cannot be asked, the event's own answer stands. */
  const live = await stripeTier(email);
  if (live !== null) tier = live;
  await makeDb(sa).patch(`users/${encodeURIComponent(key)}`, {
    tier, email: key, updatedAt: new Date().toISOString()
  });

  console.log(`[webhook.js] Updated ${email} → ${tier}`);
}

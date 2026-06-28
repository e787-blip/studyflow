'use strict';
const FETCH_TIMEOUT_MS = 10000;
const REPLAY_WINDOW_SECS = 300; // 5 minutes — Stripe standard

// Explicitly map price IDs — unknown IDs fall back to 'free', not 'pro'
const PRICE_TIERS = {
  'price_1TTxA2FFG0oviXd9TJGT1aAJ': 'pro',
  'price_1TTxAOFFG0oviXd97LZFacnr': 'vip',
  'price_1TTxArFFG0oviXd9Nl39k8ZM': 'classroom',
  'price_1TTxBDFFG0oviXd9wIKwRlUm': 'school',
};

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

  // Update tier in Firestore
  const firebaseUrl = `https://firestore.googleapis.com/v1/projects/studyflow-e59ef/databases/(default)/documents/users/${encodeURIComponent(email)}`;
  const fbResp = await fetchWithTimeout(`${firebaseUrl}?updateMask.fieldPaths=tier`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIREBASE_SERVICE_KEY}`
    },
    body: JSON.stringify({
      fields: {
        tier:      { stringValue: tier },
        email:     { stringValue: email },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    })
  });

  if (!fbResp.ok) {
    const err = await fbResp.json().catch(() => ({}));
    console.error('[webhook.js] Firebase update failed:', err);
    throw new Error('Firebase update failed');
  }

  console.log(`[webhook.js] Updated ${email} → ${tier}`);
}

'use strict';
const FETCH_TIMEOUT_MS = 10000;
const ALLOWED_PRICE_IDS = new Set([
  'price_1TTxA2FFG0oviXd9TJGT1aAJ',
  'price_1TTxAOFFG0oviXd97LZFacnr',
  'price_1TTxArFFG0oviXd9Nl39k8ZM',
  'price_1TTxBDFFG0oviXd9wIKwRlUm',
]);

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, plan, email } = req.body || {};

  // Allowlist validation — prevents forged price IDs
  if (!priceId || !ALLOWED_PRICE_IDS.has(priceId))
    return res.status(400).json({ error: 'Invalid price ID' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Server misconfiguration' });

  try {
    const params = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': `https://studyflow-ten-vert.vercel.app/dashboard.html?upgraded=${encodeURIComponent(plan || '')}`,
      'cancel_url': 'https://studyflow-ten-vert.vercel.app/pricing.html',
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'auto',
    });

    // Only attach email if it looks valid
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      params.set('customer_email', email);
    }

    const response = await fetchWithTimeout('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const session = await response.json();
    if (!session.url) {
      console.error('[checkout.js] No URL from Stripe:', session);
      return res.status(500).json({ error: 'Could not create checkout session' });
    }
    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'Payment service timeout — please try again' });
    console.error('[checkout.js]', err.message);
    return res.status(500).json({ error: 'Checkout failed' });
  }
};

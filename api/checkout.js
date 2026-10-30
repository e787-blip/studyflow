'use strict';
const { requireUser, stripeAccount } = require('./_account');

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  /* A purchase is recorded against the Stripe customer's email, and the
     plan is read back by the signed-in account's email (api/_account.js). So
     the email comes from the verified sign-in, never from the body: a typo
     or another address at checkout meant paying for a plan the account never
     got. */
  const user = await requireUser(req, res);
  if (!user) return;

  const { priceId } = req.body || {};

  // Allowlist validation — prevents forged price IDs
  if (!priceId || !ALLOWED_PRICE_IDS.has(priceId))
    return res.status(400).json({ error: 'Invalid price ID' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Server misconfiguration' });

  /* One plan at a time. Nothing used to stop a Pro subscriber pressing
     "Upgrade to VIP" and paying for both. A learner with a live plan is sent
     to Stripe's manage-plan page instead (api/account portal), where a
     switch replaces the plan. A known customer is reused, so one person is
     one Stripe customer. */
  const acct = await stripeAccount(user.email);
  if (acct.live)
    return res.status(409).json({ error: 'already_subscribed', message: 'You already have a plan. Change it from Manage plan.' });

  /* The site's own address: ALLOWED_ORIGIN when the site moves to its own
     domain, so Stripe sends the buyer back to the address they came from. */
  const site = process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app';

  try {
    const params = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      /* No tier in the address. It used to be ?upgraded=<plan>, and the
         dashboard granted whatever it said - dashboard.html?upgraded=vip
         was VIP for free. The dashboard now asks api/account. */
      'success_url': site + '/dashboard.html?checkout=done',
      'cancel_url': site + '/pricing.html',
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'auto',
    });

    if (acct.customer) params.set('customer', acct.customer);
    else params.set('customer_email', user.email);
    params.set('client_reference_id', user.uid);

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

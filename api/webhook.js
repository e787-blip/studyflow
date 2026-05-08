module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch (err) {
    return res.status(400).json({ error: 'Could not read body' });
  }

  // Verify Stripe signature
  try {
    const crypto = require('crypto');
    const parts = sig.split(',');
    const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
    const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.split('=')[1]);
    const payload = timestamp + '.' + rawBody;
    const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    const valid = signatures.some(s => {
      try { return crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex')); }
      catch(e) { return false; }
    });
    if (!valid) return res.status(400).json({ error: 'Invalid signature' });
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      return res.status(400).json({ error: 'Timestamp too old' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Signature verification failed: ' + err.message });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch (err) { return res.status(400).json({ error: 'Invalid JSON' }); }

  // Price ID to tier mapping
  const PRICE_TIERS = {
    'price_1TTxA2FFG0oviXd9TJGT1aAJ': 'pro',      // Pro $7.99
    'price_1TTxAOFFG0oviXd97LZFacnr': 'vip',      // VIP $14.99
    'price_1TTxArFFG0oviXd9Nl39k8ZM': 'classroom', // Classroom $79.99
    'price_1TTxBDFFG0oviXd9wIKwRlUm': 'school',   // School $299.99
  };

  try {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const priceId = subscription.items && subscription.items.data[0]
      ? subscription.items.data[0].price.id : null;
    const tier = PRICE_TIERS[priceId] || 'pro';
    const status = subscription.status;

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      // Subscription active or updated — upgrade user
      if (status === 'active' || status === 'trialing') {
        await updateUserTier(customerId, tier);
      } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
        await updateUserTier(customerId, 'free');
      }
    } else if (event.type === 'customer.subscription.deleted') {
      // Subscription cancelled — downgrade to free
      await updateUserTier(customerId, 'free');
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function updateUserTier(customerId, tier) {
  // Get customer email from Stripe
  const response = await fetch('https://api.stripe.com/v1/customers/' + customerId, {
    headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
  });
  const customer = await response.json();
  const email = customer.email;

  if (!email) {
    console.error('No email found for customer:', customerId);
    return;
  }

  // Update in Firebase
  const firebaseUrl = 'https://firestore.googleapis.com/v1/projects/studyflow-e59ef/databases/(default)/documents/users/' + encodeURIComponent(email);
  await fetch(firebaseUrl + '?updateMask.fieldPaths=tier', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.FIREBASE_SERVICE_KEY
    },
    body: JSON.stringify({
      fields: {
        tier: { stringValue: tier },
        email: { stringValue: email },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    })
  });

  console.log('Updated user ' + email + ' to tier: ' + tier);
}

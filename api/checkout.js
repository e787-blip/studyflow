module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, plan, email } = req.body || {};
  if (!priceId) return res.status(400).json({ error: 'No price ID' });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': 'https://studyflow-ten-vert.vercel.app/dashboard.html?upgraded=' + plan,
        'cancel_url': 'https://studyflow-ten-vert.vercel.app/pricing.html',
        'customer_email': email || '',
        'allow_promotion_codes': 'true',
        'billing_address_collection': 'auto',
      })
    });

    const session = await response.json();
    if (!session.url) return res.status(500).json({ error: 'No checkout URL', raw: session });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

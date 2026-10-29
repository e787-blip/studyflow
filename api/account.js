'use strict';
/* GET /api/account -> { email, tier }
   The plan the signed-in learner has paid for, as the server knows it
   (api/_account.js). sf-auth.js asks on every page load and writes the
   answer into studyflow_user.tier, which is the only place the pages read
   it - so a new device, a cleared browser or a cancelled subscription all
   come out right, and editing localStorage changes nothing the server
   enforces. `?fresh=1` asks Stripe directly: the dashboard does that after
   a checkout, before the webhook has necessarily landed. */

const { requireUser, tierOf } = require('./_account');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const fresh = String((req.query && req.query.fresh) || '') === '1';
    const tier = await tierOf(user, { fresh });
    return res.status(200).json({ email: user.email, tier });
  } catch (e) {
    console.error('[account.js]', e.message);
    return res.status(500).json({ error: 'account_unavailable' });
  }
};

'use strict';
/* /api/account - the signed-in learner's plan, as the server knows it
   (api/_account.js).

   GET                -> { email, tier }
                         sf-auth.js asks on every page load and writes the
                         answer into studyflow_user.tier, which is the only
                         place the pages read it - so a new device, a cleared
                         browser or a cancelled subscription all come out
                         right, and editing localStorage changes nothing the
                         server enforces. `?fresh=1` asks Stripe directly: the
                         dashboard does that after a checkout, before the
                         webhook has necessarily landed.
   POST plan-check    { days }    -> { ok, tier, used, limit, maxDays, error? }
                         Before app.html builds a plan: plans this month and
                         days per plan, as the pricing page sells them.
   POST plan-built    { planId }  -> { ok, used }
                         After a plan is saved. A build that fails costs
                         nothing; the same plan id is never counted twice.
   POST portal                    -> { url } | 404 no_subscription
                         Stripe's page to switch or cancel a plan. */

const { requireUser, tierOf, planCheck, planBuilt, portalUrl } = require('./_account');

const ORIGIN = 'https://studyflow-ten-vert.vercel.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  try {
    if (req.method === 'GET') {
      const fresh = String((req.query && req.query.fresh) || '') === '1';
      const tier = await tierOf(user, { fresh });
      return res.status(200).json({ email: user.email, tier });
    }

    const body = req.body || {};
    if (body.action === 'plan-check') {
      const r = await planCheck(user, Math.max(1, Math.min(365, Number(body.days) || 1)));
      return res.status(r.ok ? 200 : 403).json(r);
    }
    if (body.action === 'plan-built') {
      return res.status(200).json(await planBuilt(user, body.planId));
    }
    if (body.action === 'portal') {
      const r = await portalUrl(user, (process.env.ALLOWED_ORIGIN || ORIGIN) + '/dashboard.html?portal=done');
      if (r.url) return res.status(200).json(r);
      return res.status(r.error === 'no_subscription' ? 404 : 503).json(r);
    }
    return res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    console.error('[account.js]', e.message);
    return res.status(500).json({ error: 'account_unavailable' });
  }
};

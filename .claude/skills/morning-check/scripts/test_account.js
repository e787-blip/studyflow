// Paid plans and sign-in, enforced on the server (Oct 2026). Before this the plan lived only in
// the browser: dashboard.html?upgraded=vip made any account VIP, a paying learner was Free on a
// new device, and api/generate, api/chat and api/extract answered anyone at all.
// Server half: the REAL api files (_firestore, _account, account, generate, chat, extract,
// checkout, class, webhook) with Firebase, Firestore, Stripe and Anthropic answered by stand-ins.
// Page half: dashboard, pricing, lesson and app pages with api/account, api/chat, api/checkout and
// api/generate routed. Runs under Node 18+ (server half only without a browser) or the browser shim.
const fs = require('fs');
const path = require('path');
const API = path.join(__dirname, '../../../../api');
const SRC = {};
['_firestore', '_account', 'account', 'generate', 'chat', 'extract', 'checkout', 'class', 'webhook']
  .forEach(n => { SRC[n] = fs.readFileSync(path.join(API, n + '.js'), 'utf8'); });
let fails = 0; const ok = (c, m) => { if (!c) { fails++; if (typeof process !== 'undefined') process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' },
           json: async () => body, text: async () => JSON.stringify(body) };
}
const cryptoShim = {
  randomBytes: n => { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = (Math.random() * 256) | 0; return a; },
  createSign: () => ({ update() { return this; }, sign: () => 'c2ln' }),
  createHmac: () => ({ update() { return this; }, digest: () => '00' }),
  timingSafeEqual: () => false
};
const BufferShim = { from: v => ({ toString: () => String(v) }) };

/* A world: who can sign in, what Firestore holds, what Stripe sells. */
function world(env) {
  const W = {
    users: {
      'tok-free':  { localId: 'uidfree', email: 'free@x.test' },
      'tok-vip':   { localId: 'uidvip', email: 'vip@x.test' },
      'tok-owner': { localId: 'uidown', email: 'ethanhwang787@gmail.com' },
      'tok-paid':  { localId: 'uidpaid', email: 'paid@x.test' },
      'tok-two':   { localId: 'uidtwo', email: 'two@x.test' },
      'tok-gone':  { localId: 'uidgone', email: 'gone@x.test' },
      'tok-down':  { localId: 'uiddown', email: 'down@x.test' }
    },
    db: { 'users/vip%40x.test': { tier: 'vip' }, 'users/gone%40x.test': { tier: 'vip' } },
    customers: { 'paid@x.test': ['cus_paid'], 'two@x.test': ['cus_two'], 'gone@x.test': ['cus_gone'] },
    subs: {
      cus_paid: [{ status: 'active', items: { data: [{ price: { id: 'price_1TTxAOFFG0oviXd97LZFacnr' } }] } }],
      cus_two: [{ status: 'active', items: { data: [{ price: { id: 'price_1TTxA2FFG0oviXd9TJGT1aAJ' } }] } },
                { status: 'active', items: { data: [{ price: { id: 'price_1TTxAOFFG0oviXd97LZFacnr' } }] } }],
      cus_gone: [{ status: 'canceled', items: { data: [{ price: { id: 'price_1TTxAOFFG0oviXd97LZFacnr' } }] } }]
    },
    stripeDown: false, calls: { anthropic: 0, stripe: [], writes: [], sessions: [] }
  };
  async function upstream(url, opts) {
    opts = opts || {}; url = String(url);
    const u = new URL(url);
    if (u.host === 'identitytoolkit.googleapis.com') {
      const usr = W.users[JSON.parse(opts.body || '{}').idToken];
      return reply(usr ? 200 : 400, usr ? { users: [usr] } : { error: { message: 'INVALID_ID_TOKEN' } });
    }
    if (u.host === 'oauth2.googleapis.com') return reply(200, { access_token: 'adm', expires_in: 3600 });
    if (u.host === 'firestore.googleapis.com') {
      const p = u.pathname.split('/documents/')[1];
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET') {
        const d = W.db[p];
        if (!d) return reply(404, { error: { code: 404 } });
        const fields = {}; Object.keys(d).forEach(k => { fields[k] = { stringValue: String(d[k]) }; });
        return reply(200, { fields, updateTime: 't1' });
      }
      if (method === 'PATCH') {
        const f = JSON.parse(opts.body).fields, cur = W.db[p] || {};
        Object.keys(f).forEach(k => { cur[k] = f[k].stringValue; });
        W.db[p] = cur; W.calls.writes.push(p);
        return reply(200, { fields: f, updateTime: 't2' });
      }
    }
    if (u.host === 'api.stripe.com') {
      W.calls.stripe.push(u.pathname + u.search);
      if (W.stripeDown) return reply(500, { error: { message: 'down' } });
      if (u.pathname === '/v1/customers') {
        const ids = W.customers[u.searchParams.get('email')] || [];
        return reply(200, { data: ids.map(id => ({ id })) });
      }
      if (u.pathname === '/v1/subscriptions') return reply(200, { data: W.subs[u.searchParams.get('customer')] || [] });
      if (u.pathname === '/v1/checkout/sessions') {
        W.calls.sessions.push(Object.fromEntries(new URLSearchParams(String(opts.body))));
        return reply(200, { url: 'https://checkout.stripe.test/s' });
      }
    }
    if (u.host === 'api.anthropic.com') { W.calls.anthropic++; return reply(200, { content: [{ text: '{"ok":1}' }], stop_reason: 'end_turn' }); }
    throw new Error('unexpected fetch ' + url);
  }
  const procEnv = Object.assign({ ANTHROPIC_API_KEY: 'k', FIREBASE_API_KEY: 'web',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x', private_key: 'k' }), STRIPE_SECRET_KEY: 'sk_test' }, env || {});
  const cache = {};
  function load(name) {
    name = name.replace(/^\.\//, '').replace(/\.js$/, '');
    if (name === 'crypto') return cryptoShim;
    if (cache[name]) return cache[name].exports;
    const module = { exports: {} }; cache[name] = module;
    new Function('require', 'module', 'exports', 'fetch', 'Buffer', 'process', 'console', SRC[name])(
      load, module, module.exports, upstream, BufferShim, { env: procEnv }, { log() {}, warn() {}, error() {} });
    return module.exports;
  }
  W.handler = name => load(name);
  W.call = (name, o) => new Promise(resolve => {
    const res = { headers: {}, statusCode: 200,
      setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); return this; }, end() { resolve({ status: this.statusCode, body: null }); return this; } };
    const req = { method: o.method || 'POST', query: o.query || {}, body: o.body,
                  headers: o.tok ? { authorization: 'Bearer ' + o.tok } : {} };
    Promise.resolve(load(name)(req, res)).catch(e => resolve({ status: 'THREW', body: String(e && e.stack || e) }));
  });
  return W;
}

async function serverHalf() {
  let W = world();
  const gen = o => W.call('generate', Object.assign({ body: { prompt: 'hello' } }, o));

  // 1. api/generate answers signed-in callers only.
  let r = await gen({});
  ok(r.status === 401 && r.body.error === 'sign_in_required' && W.calls.anthropic === 0, 'generate: no token is 401 and the model is never called (' + r.status + ')');
  r = await gen({ tok: 'forged' });
  ok(r.status === 401 && W.calls.anthropic === 0, 'generate: a forged token is 401');
  r = await gen({ tok: 'tok-free' });
  ok(r.status === 200 && r.body.result === '{"ok":1}' && W.calls.anthropic === 1, 'generate: a signed-in free learner is answered');
  const W2 = world({ FIREBASE_API_KEY: '' });
  r = await W2.call('generate', { tok: 'tok-free', body: { prompt: 'x' } });
  ok(r.status === 503 && W2.calls.anthropic === 0, 'generate: no FIREBASE_API_KEY refuses everyone, never answers anyone');

  // 2. api/extract, the same.
  r = await W.call('extract', { body: { imageData: 'AA', mediaType: 'image/jpeg' } });
  ok(r.status === 401, 'extract: no token is 401');
  r = await W.call('extract', { tok: 'tok-free', body: { imageData: 'AA', mediaType: 'image/jpeg' } });
  ok(r.status === 200 && r.body.text === '{"ok":1}', 'extract: a signed-in learner is answered');

  // 3. api/chat: signed in AND VIP.
  W = world();
  const chat = tok => W.call('chat', { tok, body: { messages: [{ role: 'user', content: 'hi' }], context: {} } });
  r = await chat(null);
  ok(r.status === 401 && W.calls.anthropic === 0, 'chat: no token is 401');
  r = await chat('tok-free');
  ok(r.status === 403 && r.body.error === 'vip_required' && W.calls.anthropic === 0, 'chat: a free account is refused (403) and the model is never called');
  r = await chat('tok-vip');
  ok(r.status === 200 && r.body.reply, 'chat: a VIP on record is answered');
  r = await chat('tok-owner');
  ok(r.status === 200, 'chat: the owner is answered with no record at all');
  r = await chat('tok-paid');
  ok(r.status === 200, 'chat: a VIP who paid before the webhook could write is found through Stripe');

  // 4. api/account: what the account has paid for.
  W = world();
  const acct = (tok, fresh) => W.call('account', { method: 'GET', tok, query: fresh ? { fresh: '1' } : {} });
  r = await acct(null);
  ok(r.status === 401, 'account: no token is 401');
  r = await acct('tok-vip');
  ok(r.status === 200 && r.body.tier === 'vip' && W.calls.stripe.length === 0, 'account: a record in Firestore is answered without asking Stripe');
  r = await acct('tok-free');
  ok(r.body.tier === 'free' && W.db['users/free%40x.test'] && W.db['users/free%40x.test'].tier === 'free', 'account: no record and nothing in Stripe is free, and that is written down');
  const before = W.calls.stripe.length;
  await acct('tok-free');
  ok(W.calls.stripe.length === before, 'account: the next read is Firestore alone');
  r = await acct('tok-paid');
  ok(r.body.tier === 'vip' && W.db['users/paid%40x.test'].tier === 'vip' && W.db['users/paid%40x.test'].source === 'stripe', 'account: a live Stripe subscription with no record is found and recorded');
  r = await acct('tok-two');
  ok(r.body.tier === 'vip', 'account: two live subscriptions (Pro and VIP) answer the higher');
  r = await acct('tok-gone');
  ok(r.body.tier === 'vip', 'account: without fresh, the record stands (the webhook keeps it current)');
  r = await acct('tok-gone', true);
  ok(r.body.tier === 'free' && W.db['users/gone%40x.test'].tier === 'free', 'account: fresh asks Stripe - a cancelled plan comes back free');
  r = await acct('tok-owner');
  ok(r.body.tier === 'vip', 'account: the owner is VIP');
  W.stripeDown = true;
  r = await acct('tok-down');
  ok(r.status === 200 && r.body.tier === 'free' && !W.db['users/down%40x.test'], 'account: Stripe down and no record is free, and nothing is written');
  W.stripeDown = false;

  // 5. api/checkout: an account buys, with ITS email; the address back carries no tier.
  W = world();
  r = await W.call('checkout', { body: { priceId: 'price_1TTxAOFFG0oviXd97LZFacnr', email: 'free@x.test' } });
  ok(r.status === 401 && W.calls.sessions.length === 0, 'checkout: no token is 401 and no session is opened');
  r = await W.call('checkout', { tok: 'tok-free', body: { priceId: 'price_1TTxAOFFG0oviXd97LZFacnr', plan: 'vip', email: 'someone-else@x.test' } });
  const s = W.calls.sessions[0] || {};
  ok(r.status === 200 && r.body.url, 'checkout: a signed-in learner gets a session');
  ok(s.customer_email === 'free@x.test' && s.client_reference_id === 'uidfree', 'checkout: the email is the sign-in\'s, not the body\'s (' + s.customer_email + ')');
  ok(/checkout=done/.test(s.success_url) && !/upgraded|vip/.test(s.success_url), 'checkout: the success address carries no tier: ' + s.success_url);
  r = await W.call('checkout', { tok: 'tok-free', body: { priceId: 'price_forged' } });
  ok(r.status === 400, 'checkout: a forged price is still refused');

  // 6. The class API and the webhook still load through the shared module.
  r = await W.call('class', { method: 'GET', tok: 'tok-free', query: { type: 'teacher' } });
  ok(r.status === 200, 'class: verifyUser from api/_account.js still signs a teacher in (' + r.status + ')');
  r = await W.call('class', { method: 'GET', query: { type: 'teacher' } });
  ok(r.status === 401, 'class: still 401 with no token');
  ok(typeof W.handler('webhook') === 'function', 'webhook: loads with the shared price map');
}

async function pageHalf() {
  let h; try { h = require('./harness'); } catch (e) { console.log('SKIP page half: no browser here'); return; }
  const fx = require('./fixture');
  const FB_KEY = 'firebase:authUser:AIzaSyCY4FI-6L9tsAokNFl6o5bsmCt-JD0H8HI:[DEFAULT]';
  const seen = { account: [], chat: [], checkout: [], generate: [] };
  const state = { tier: 'vip', freshTier: null, chat: 200, gen: 200 };
  const auth = req => { const hd = req.headers() || {}; return hd.Authorization || hd.authorization || ''; };
  const env = await h.open({
    mock: () => ({ json: { result: '{"type":"none"}' } }),
    routes: [
      ['**/api/account**', async route => {
        const req = route.request(), a = auth(req), fresh = /fresh=1/.test(req.url());
        seen.account.push({ a, fresh });
        if (a !== 'Bearer tok-x') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"sign_in_required"}' });
        const tier = fresh && state.freshTier ? state.freshTier.shift() || 'free' : state.tier;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: fx.user.email, tier }) });
      }],
      ['**/api/chat', async route => {
        seen.chat.push(auth(route.request()));
        const st = state.chat;
        await route.fulfill({ status: st, contentType: 'application/json',
          body: JSON.stringify(st === 200 ? { reply: 'Think about the valves.' } : { error: st === 401 ? 'sign_in_required' : 'vip_required' }) });
      }],
      ['**/api/checkout', async route => {
        seen.checkout.push({ a: auth(route.request()), body: JSON.parse(route.request().postData() || '{}') });
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"error":"stop here"}' });
      }],
      ['**/api/generate', async route => {
        seen.generate.push(auth(route.request()));
        if (state.gen === 401) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"sign_in_required"}' });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
      }]
    ]
  });
  const p = env.page, BASE = (typeof process !== 'undefined' && process.env && process.env.SF_BASE) || 'http://localhost:8765/';
  const tierNow = () => p.evaluate(() => (JSON.parse(localStorage.getItem('studyflow_user') || '{}').tier));
  const wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
  const setUser = tier => p.evaluate(t => { const u = JSON.parse(localStorage.getItem('studyflow_user')); u.tier = t; localStorage.setItem('studyflow_user', JSON.stringify(u)); }, tier);
  const session = email => p.evaluate(({ k, e }) => {
    if (!e) return localStorage.removeItem(k);
    localStorage.setItem(k, JSON.stringify({ uid: 'u1', email: e, stsTokenManager: { accessToken: 'tok-x', refreshToken: 'r', expirationTime: Date.now() + 3600e3 } }));
  }, { k: FB_KEY, e: email });

  // 1. The address can no longer grant a plan.
  await session(null); await setUser('free');
  await p.goto(BASE + 'dashboard.html?upgraded=vip'); await p.waitForTimeout(1200);
  ok(await tierNow() === 'free', 'dashboard.html?upgraded=vip leaves the account free');
  ok(!/upgraded/.test(p.url()), 'and the address is cleared: ' + p.url());
  await p.goto(BASE + 'pricing.html?upgraded=vip'); await p.waitForTimeout(900);
  ok(await tierNow() === 'free', 'pricing.html?upgraded=vip leaves the account free');

  // 2. The server's answer is the plan: up on a new device, down after a cancel.
  await session(fx.user.email); state.tier = 'vip';
  await p.goto(BASE + 'dashboard.html');
  ok(await wait(async () => await tierNow() === 'vip'), 'a paid plan comes back from the server on a device that had it as free');
  ok(await wait(() => p.evaluate(() => /Vip plan/.test((document.getElementById('menu-tier') || {}).textContent || ''))), 'and the dashboard repaints with it');
  ok(seen.account.some(c => c.a === 'Bearer tok-x'), 'api/account was asked with the sign-in token');
  state.tier = 'free';
  await p.goto(BASE + 'dashboard.html');
  ok(await wait(async () => await tierNow() === 'free'), 'a cancelled plan goes back to free');

  // 3. Another account's session is never used for this learner's plan.
  const n0 = seen.account.length;
  await setUser('free'); await session('teacher@x.test'); state.tier = 'vip';
  await p.goto(BASE + 'dashboard.html'); await p.waitForTimeout(1500);
  ok(await tierNow() === 'free' && seen.account.length === n0, 'a different account signed in on this browser changes nothing');

  // 4. Back from Stripe: asked fresh until the plan shows.
  await session(fx.user.email); await setUser('free'); state.tier = 'free'; state.freshTier = ['free', 'pro'];
  await p.goto(BASE + 'dashboard.html?checkout=done');
  ok(await wait(async () => await tierNow() === 'pro', 9000), 'after checkout the dashboard asks Stripe (fresh) until the plan lands');
  ok(seen.account.filter(c => c.fresh).length >= 2, 'it asked fresh more than once');
  ok(await wait(() => p.evaluate(() => /Welcome to StudyFlow Pro/.test(document.body.textContent))), 'and says welcome');
  state.freshTier = null;

  // 5. The tutor sends the token and says why it was refused.
  await session(fx.user.email); await setUser('vip'); state.tier = 'vip';
  await p.goto(BASE + 'lesson.html?cb=' + Date.now()); await p.waitForTimeout(1500);
  const ask = async () => {
    await p.evaluate(() => toggleChat(true)); await p.waitForTimeout(300);
    await p.evaluate(() => { const i = document.getElementById('chat-input'); i.focus(); i.value = 'help'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
    await p.waitForTimeout(900);
    return p.evaluate(() => { const m = document.querySelectorAll('#chat-messages > *'); return m.length ? m[m.length - 1].textContent : ''; });
  };
  state.chat = 200;
  let last = await ask();
  ok(seen.chat[seen.chat.length - 1] === 'Bearer tok-x', 'the tutor sends the sign-in token: ' + seen.chat[seen.chat.length - 1]);
  state.chat = 401; last = await ask();
  ok(/Sign in again/.test(last), 'a 401 says to sign in again: ' + last);
  state.chat = 403; last = await ask();
  ok(/part of VIP/.test(last), 'a 403 says the tutor is VIP: ' + last);

  // 6. The plan builder: a 401 is a sign-in card at once, not three retries.
  state.gen = 401; seen.generate.length = 0;
  await p.goto(BASE + 'app.html?cb=' + Date.now()); await p.waitForTimeout(1500);
  await p.evaluate(() => { try { startGeneration('Photosynthesis turns light into sugar. Chlorophyll absorbs light. Glucose is made in the Calvin cycle from carbon dioxide.', 1, '', 'free'); } catch (e) { window.__genErr = String(e); } });
  const card = await wait(() => p.evaluate(() => { const b = document.getElementById('gen-error'); return b && b.classList.contains('active') && /Sign in/.test(b.textContent); }), 15000);
  ok(card, 'a 401 while building shows "Sign in again" (' + (await p.evaluate(() => window.__genErr || '')) + ')');
  ok(seen.generate.length <= 2, 'and the day is not retried: ' + seen.generate.length + ' calls (map + day at most)');
  state.gen = 200;

  // 7. Buying needs an account, and the email is not the page's to send.
  await session(null);
  await p.evaluate(() => localStorage.removeItem('studyflow_user'));
  await p.goto(BASE + 'pricing.html'); await p.waitForTimeout(900);
  const nc = seen.checkout.length;
  await p.evaluate(() => { const b = document.querySelector('[data-checkout="vip"]') || document.querySelector('[data-checkout]'); b.click(); });
  await p.waitForTimeout(900);
  ok(/login\.html\?mode=signup/.test(p.url()) && seen.checkout.length === nc, 'a visitor who picks a plan is sent to make an account first: ' + p.url());
  await p.evaluate(u => localStorage.setItem('studyflow_user', JSON.stringify(u)), fx.user);
  await session(fx.user.email);
  await p.goto(BASE + 'pricing.html'); await p.waitForTimeout(900);
  await p.evaluate(() => { const b = document.querySelector('[data-checkout="vip"]') || document.querySelector('[data-checkout]'); b.click(); });
  ok(await wait(() => seen.checkout.length > nc), 'a signed-in learner reaches api/checkout');
  const co = seen.checkout[seen.checkout.length - 1] || {};
  ok(co.a === 'Bearer tok-x' && co.body && co.body.priceId && !('email' in co.body) && !('plan' in co.body), 'checkout carries the token and no email or plan: ' + JSON.stringify(co));

  const errs = env.errors.filter(e => !/api\/(account|chat|checkout|generate)|401|403|Failed to load/.test(e));
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await env.browser.close();
}

(async () => {
  try { await serverHalf(); } catch (e) { fails++; console.log('FAIL server half threw: ' + (e && e.stack || e)); }
  try { await pageHalf(); } catch (e) { fails++; console.log('FAIL page half threw: ' + (e && e.stack || e)); }
  console.log(fails ? 'ACCOUNT FAILED (' + fails + ')' : 'ACCOUNT OK');
  if (fails && typeof process !== 'undefined') process.exitCode = 1;
})();

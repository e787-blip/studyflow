// Real page load of lesson.html with seeded storage and a mocked api/generate.
// usage: const h = require('./harness'); const {page, browser, calls} = await h.open({ mock });
const { chromium } = require('./pw');
const fx = require('./fixture');
async function open(opts) {
  opts = opts || {};
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: opts.width || 390, height: opts.height || 844 }, deviceScaleFactor: 2 });
  await require('./fontroute')(ctx); const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const calls = [];
  await page.route('**/api/generate', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push(body.prompt || '');
    const r = opts.mock ? await opts.mock(body.prompt || '', calls.length) : { status: 500, json: { error: 'no mock' } };
    if (r.delay) await new Promise(res => setTimeout(res, r.delay));
    if (r.abort) return route.abort();
    await route.fulfill({ status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.json) });
  });
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
  const plan = opts.plan || fx.plan;
  await page.evaluate(({ plan, user, dark }) => {
    localStorage.clear();
    localStorage.setItem('studyflow_user', JSON.stringify(user));
    if (dark) localStorage.setItem('studyflow_dark', '1');
    const ns = 'sfu:' + user.email + '|';
    localStorage.setItem(ns + 'studyflow_plan', JSON.stringify(plan));
    localStorage.setItem(ns + 'studyflow_plans', JSON.stringify([plan]));
    localStorage.setItem(ns + 'studyflow_current_day', '0');
    localStorage.setItem(ns + 'studyflow_minutes', '30');
    localStorage.setItem('studyflow_onboarded', '1');
  }, { plan, user: fx.user, dark: !!opts.dark });
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'lesson.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForTimeout(opts.settle || 1200);
  return { browser, page, calls, errors };
}
module.exports = { open };

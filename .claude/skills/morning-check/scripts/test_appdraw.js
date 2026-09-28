const { chromium } = require('./pw');
const fs = require('fs'); const fx = require('./fixture');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
async function run(artReply, label) {
  const b = await chromium.launch(); const ctx = await b.newContext({ ignoreHTTPSErrors: true }); await require('./fontroute')(ctx);
  const page = await ctx.newPage(); const errors = []; const calls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/generate', async r => {
    const p = JSON.parse(r.request().postData()).prompt; calls.push(p);
    if (/^Draw ONE illustration/.test(p)) { const a = artReply(); if (a.abort) return r.abort(); if (a.delay) await new Promise(x => setTimeout(x, a.delay)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(a.json) }); }
    const d = JSON.parse(JSON.stringify(fx.plan.days[0])); delete d.completed;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(d) }) });
  });
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
  await page.evaluate((u) => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify(u)); localStorage.setItem('studyflow_onboarded', '1'); }, Object.assign({}, fx.user, { tier: 'vip' }));
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const t0 = Date.now();
  await page.evaluate(() => {
    selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    const n = document.getElementById('notes-input'); if (n) n.value = 'The heart pumps blood through arteries and veins. Veins have valves. Capillaries are thin.';
    const s = document.getElementById('subject-input'); if (s) s.value = 'Biology: the heart';
    const d = new Date(Date.now() + 2 * 86400000); const dl = document.getElementById('deadline-input'); if (dl) dl.value = d.toISOString().slice(0, 10);
    /* The rebuilt wizard asks one question per screen and will not start
       until each is answered; the drawing is what is under test here. */
    startGeneration(n.value, 2, d.toISOString().slice(0, 10), 'vip');
  });
  let progress = new Set();
  for (let i = 0; i < 120 && !/dashboard/.test(page.url()); i++) { try { const t = await page.evaluate(() => document.body.innerText.match(/Drawing a picture[^\n]*/)); if (t) progress.add(t[0]); } catch (e) {} await page.waitForTimeout(500); }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const p = await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('studyflow_user')); return JSON.parse(localStorage.getItem('sfu:' + u.email + '|studyflow_plan') || 'null'); });
  const art = calls.filter(c => /^Draw ONE illustration/.test(c));
  console.log('[' + label + '] reached dashboard: ' + /dashboard/.test(page.url()) + ' in ' + secs + 's; days=' + (p && p.days.length) + '; day calls=' + (calls.length - art.length) + '; art calls=' + art.length + '; progress seen=' + [...progress].join(' / '));
  await b.close();
  return { p, art, errors, reached: /dashboard/.test(page.url()), secs: +secs };
}
(async () => {
  const a = await run(() => ({ json: { result: JSON.stringify(VALVES) } }), 'drawing');
  assert(a.reached && a.p && a.p.days[0].generatedArt && a.p.days[0].generatedArt.shapes, 'plan saved with day 1 already drawn');
  assert(a.art.length === 1 && /LESSON: The heart and blood vessels/.test(a.art[0]), 'exactly one art call, for day 1, with the shared lesson prompt');
  assert(!a.p.days[1] || a.p.days[1].generatedArt === undefined, 'later days left for the lesson before them');
  const b = await run(() => ({ abort: true }), 'fails');
  assert(b.reached && b.p && !('generatedArt' in b.p.days[0]), 'a failed drawing still saves the plan, nothing cached');
  const c = await run(() => ({ delay: 40000, json: { result: JSON.stringify(VALVES) } }), 'slow');
  assert(c.reached && c.secs < 40 && !('generatedArt' in c.p.days[0]), 'a slow drawing is abandoned at ~25s and the plan saves (' + c.secs + 's)');
  const d = await run(() => ({ json: { result: '{"type":"none"}' } }), 'none');
  assert(d.reached && d.p.days[0].generatedArt === null, '"nothing to draw" is remembered as null');
  assert([a, b, c, d].every(r => r.errors.length === 0), 'no page errors ' + [a, b, c, d].map(r => r.errors.join('|')).join(' '));
  console.log(fails ? fails + ' FAILED' : 'APP PREDRAW OK');
})();

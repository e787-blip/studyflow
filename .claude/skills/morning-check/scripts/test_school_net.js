// A school network that refuses StudyFlow's server (Nov 2026): the plan builder
// must say so, and the page must not wait on the font host.
//  - every api call aborted (what a filter does): the failure card says the
//    server can't be reached and names what to try, not "a busy server";
//  - a server that answers 500 keeps the old "hit a snag" card;
//  - the Google Fonts stylesheet does not block rendering (media=print swap).
const { chromium } = require('./pw');
const fx = require('./fixture');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

async function run(mode) {
  const b = await chromium.launch(); const ctx = await b.newContext({ ignoreHTTPSErrors: true }); await require('./fontroute')(ctx);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => mode === 'block' ? r.abort('failed') : r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }));
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
  await page.evaluate((u) => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify(u)); localStorage.setItem('studyflow_onboarded', '1'); }, fx.user);
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  // the markup as served (after load the swap has already set media to all)
  const font = await page.evaluate(() => fetch('app.html').then(r => r.text()).then(t => { const m = /<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/.exec(t); return m ? m[0] : 'none'; }));
  await page.evaluate(() => {
    selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    const d = new Date(Date.now() + 86400000);
    startGeneration('photosynthesis', 1, d.toISOString().slice(0, 10), 'vip');
  });
  let text = '';
  for (let i = 0; i < 240 && !text; i++) {
    await page.waitForTimeout(500);
    text = await page.evaluate(() => { const e = document.getElementById('gen-error'); return e && e.classList.contains('active') ? e.textContent : ''; });
  }
  await b.close();
  return { text, font, errors };
}

(async () => {
  const a = await run('block');
  assert(/can.t be\s*reached/i.test(a.text) && /school/i.test(a.text) && /studyflow-ten-vert\.vercel\.app/.test(a.text), 'refused calls: the card says StudyFlow can’t be reached and what to do (' + a.text.slice(0, 60) + ')');
  assert(/media="print"/.test(a.font) && /this\.media='all'/.test(a.font), 'the font stylesheet does not block the page');
  assert(a.errors.length === 0, 'no page errors ' + a.errors.join('|'));
  const c = await run('500');
  assert(/hit a snag/i.test(c.text) && !/can.t be\s*reached/i.test(c.text), 'a server that answers 500 keeps the old card');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nSCHOOL NET OK');
})();

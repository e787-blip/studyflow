// Plan builder: walk to the review screen, press Change on a step, answer it -
// it must land back on the review. A saved grade once left the learner stuck
// on the grade screen ("0 of 7", Continue did nothing), and every other Change
// walked all the later questions again.
const { chromium } = require('./pw');
const fx = require('./fixture');
const fontroute = require('./fontroute');
async function run(file, grade) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await fontroute(ctx);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 500, body: '{}' }));
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
  await page.evaluate((u) => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify(u)); localStorage.setItem('studyflow_onboarded', '1'); },
    Object.assign({}, fx.user, { tier: 'vip' }, grade ? { grade: grade } : {}));
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + file + '?cb=' + Date.now(), { waitUntil: 'load' }); await page.waitForTimeout(700);
  const step = () => page.evaluate(() => currentStep);
  await page.fill('#notes-input', 'The heart pumps blood through arteries and veins. Veins have valves so blood does not flow backwards.');
  await page.evaluate(() => { try { notesChanged(); } catch (e) {} });
  await page.click('#notes-next'); await page.waitForTimeout(500);
  for (let i = 0; i < 10; i++) {
    const s = await step(); if (s === 'review') break;
    if (s === 'date') { await page.click('#date-chips .chip'); await page.waitForTimeout(150); await page.click('#step-date [data-next]'); }
    else if (s === 'focus') { await page.click('#step-focus [data-next]'); }
    else { await page.click('#step-' + s + ' .choice'); await page.waitForTimeout(500); if ((await step()) === s) await page.click('#step-' + s + ' [data-next]'); }
    await page.waitForTimeout(500);
  }
  const out = { reached: await step() };
  for (const target of ['grade', 'purpose', 'date']) {
    if ((await step()) !== 'review') await page.evaluate(() => goToStep('review'));
    await page.waitForTimeout(300);
    const has = await page.$('#step-review [data-edit="' + target + '"]');
    if (!has) { out[target] = 'no Change button'; continue; }
    await page.click('#step-review [data-edit="' + target + '"]'); await page.waitForTimeout(500);
    const label = await page.evaluate((t) => { const b = document.querySelector('#step-' + t + ' [data-next]'); return b ? b.textContent : ''; }, target);
    const counter = await page.evaluate(() => { const e = document.querySelector('[id*="count"], .flow-count, #flow-count'); return e ? e.textContent.trim() : ''; });
    if (target === 'date') { await page.click('#date-chips .chip:nth-child(2)'); await page.waitForTimeout(150); await page.click('#step-date [data-next]'); }
    else { const ch = await page.$$('#step-' + target + ' .choice'); await ch[ch.length > 1 ? 1 : 0].click(); await page.waitForTimeout(600); if ((await step()) === target) await page.click('#step-' + target + ' [data-next]'); }
    await page.waitForTimeout(600);
    out[target] = 'button "' + label + '", counter "' + counter + '" -> ended on ' + (await step());
  }
  out.errors = errors.length ? errors.join(' | ') : 'none';
  await b.close(); return out;
}
(async () => {
  let fails = 0;
  for (const grade of ['7', null]) {
    const r = await run('app.html', grade);
    const tag = grade ? 'saved grade' : 'no saved grade';
    const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + tag + ': ' + m); if (!c) fails++; };
    ok(r.reached === 'review', 'the questions walk through to the review (' + r.reached + ')');
    for (const t of ['grade', 'purpose', 'date']) ok(/Back to review/.test(r[t]) && /ended on review$/.test(r[t]), 'Change ' + t + ' returns to the review: ' + r[t]);
    ok(r.errors === 'none', 'no page errors: ' + r.errors);
  }
  console.log(fails ? fails + ' FAILED' : 'REVIEW CHANGE OK');
})();

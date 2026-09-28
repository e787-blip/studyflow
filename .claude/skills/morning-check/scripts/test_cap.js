const h = require('./harness'); const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
(async () => {
  const { page, browser, calls, errors } = await h.open({ mock: async (p) => /^A student just got/.test(p) ? { json: { result: JSON.stringify(VALVES) } } : { json: { result: '{"type":"none"}' } } });
  await page.evaluate(() => { MOMENT_AUTO_MAX = 1; });
  const seen = [];
  for (let k = 0; k < 40 && seen.length < 2; k++) {
    const q = await page.evaluate(() => { const c = window.currentCard; return c && c.q && !c.isPretest && !c.isSpacedRepeat && document.querySelector('.q-option') ? c.q.question : null; });
    if (q && seen.indexOf(q) === -1) {
      await page.evaluate(() => { const o = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; }); o.click(); });
      await page.waitForTimeout(400);
      seen.push(q + ' -> ' + await page.evaluate(() => document.querySelector('#session-card .sf-moment').getAttribute('data-state')));
    }
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(60);
  }
  console.log(seen.join('\n'));
  const ok = /-> drawn$/.test(seen[0]) && /-> idle$/.test(seen[1]) && calls.filter(c => /^A student/.test(c)).length === 1;
  console.log(ok ? 'PASS cap: first distinct miss drawn automatically, second offers the button, 1 call' : 'FAIL cap');
  console.log(errors.join('|') || 'no page errors'); await browser.close();
})();

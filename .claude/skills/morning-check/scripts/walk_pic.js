// Walk to a given card, answer it wrong, open the walkthrough, screenshot each step.
const h = require('./harness'); const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
const FX = require('./bigday');
const want = process.argv[2] || 'veins';     // substring of question, or 'label'
const tag = process.argv[3] || 'w';
(async () => {
  const { page, browser, errors, calls } = await h.open({ plan: FX[0], mock: async () => ({ delay: 150, json: { result: JSON.stringify(VALVES) } }) });
  await page.waitForTimeout(800);
  const wrong = async () => page.evaluate(() => {
    const o = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; }); if (o) return o.click();
    const t = Array.from(document.querySelectorAll('.tf-btn')).find(x => { const n = /answerTF\(this,'(\w+)','(\w+)'/.exec(x.getAttribute('onclick') || ''); return n && n[1] !== n[2]; }); if (t) return t.click();
    const fi = document.getElementById('fill-input'); if (fi) { fi.value = 'zzzz'; const b = document.getElementById('fill-btn'); if (b) { b.click(); b.click(); } return; }
    const sels = document.querySelectorAll('#session-card select'); if (sels.length) { sels.forEach((s, i) => { s.selectedIndex = i === 0 ? 1 : s.options.length - 1; }); const b = Array.from(document.querySelectorAll('#session-card button')).find(x => /check/i.test(x.textContent)); if (b) b.click(); }
  });
  let found = false;
  for (let i = 0; i < 80 && !found; i++) {
    const info = await page.evaluate(() => { const c = window.currentCard; return { t: c && c.type, q: c && c.q && String(c.q.question || ''), pre: !!(c && c.isPretest) }; });
    const hit = want === 'label' ? info.t === 'labeldiagram' && info.q : (!info.pre && info.q && info.q.toLowerCase().includes(want));
    if (hit) { found = true; break; }
    if (info.q && !info.pre) { await wrong(); await page.waitForTimeout(300); }
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(120);
  }
  if (!found) { console.log('card not found'); await browser.close(); return; }
  await wrong(); await page.waitForTimeout(1200);
  await page.screenshot({ path: tag + '_0card.png', fullPage: true });
  const hasBtn = await page.$('.sfwb-explain');
  if (!hasBtn) { console.log('no walkthrough button'); await browser.close(); return; }
  await page.click('.sfwb-explain'); await page.waitForTimeout(900);
  const info = await page.evaluate(() => ({ type: window.currentCard && window.currentCard.type, kind: window.currentCard && window.currentCard.walk && window.currentCard.walk.kind, rows: window.currentCard && window.currentCard.walk && window.currentCard.walk.rows.map(r => r.label + ': ' + r.detail) }));
  console.log(JSON.stringify(info, null, 1));
  const n = info.rows ? info.rows.length : 1;
  for (let s = 0; s < n; s++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ hot: Array.from(document.querySelectorAll('#pw-fig .pw-hot, #pw-fig .is-hot')).map(e => e.textContent.trim()), count: (document.getElementById('pw-count') || {}).textContent, btn: (document.getElementById('btn-next') || {}).textContent, pics: document.querySelectorAll('#session-card svg').length }));
    console.log('step', s + 1, JSON.stringify(st));
    await page.screenshot({ path: tag + '_step' + (s + 1) + '.png', fullPage: true });
    await page.click('#btn-next');
  }
  await page.waitForTimeout(500);
  console.log('after walk card:', await page.evaluate(() => window.currentCard && window.currentCard.type));
  console.log(errors.join('|') || 'no page errors'); await browser.close();
})();

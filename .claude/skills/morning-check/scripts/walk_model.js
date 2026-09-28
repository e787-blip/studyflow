const h = require('./harness'); const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
const FX = require('./bigday');
(async () => {
  const dark = process.argv[2] === 'dark';
  const { page, browser, errors } = await h.open({ plan: FX[0], dark, mock: async () => ({ delay: 150, json: { result: JSON.stringify(VALVES) } }) });
  await page.waitForTimeout(600);
  const W = VALVES.w, H = VALVES.h;
  console.log('canvas', W, H);
  await page.evaluate(({ spec, W, H }) => {
    const q = { type: 'labeldiagram', question: 'Label the vein.', drawing: spec, difficulty: 'Medium',
      pins: [{ x: W * 0.28, y: H * 0.45, answer: 'Open valve' }, { x: W * 0.72, y: H * 0.45, answer: 'Closed valve' }, { x: W * 0.7, y: H * 0.25, answer: 'Backflow' }, { x: W * 0.76, y: H * 0.3, answer: 'Vein wall' }],
      options: ['Artery'], explanation: 'Valves open with the flow and shut against it.' };
    sessionCards.splice(cardIndex, 0, { type: 'labeldiagram', q });
    showNextCard();
  }, { spec: VALVES, W, H });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.querySelectorAll('.ld-sel').forEach(s => { s.selectedIndex = s.options.length - 1; }); document.getElementById('ld-check-btn').click(); });
  await page.waitForTimeout(600);
  await page.click('.sfwb-explain'); await page.waitForTimeout(700);
  const kind = await page.evaluate(() => window.currentCard.walk && window.currentCard.walk.kind);
  console.log('kind', kind);
  for (let s = 0; s < 4; s++) { await page.click('#btn-next'); await page.waitForTimeout(350); }
  // on the last step all labels shown: check overlap among pw-pinlab boxes
  const ov = await page.evaluate(() => {
    const ls = Array.from(document.querySelectorAll('.pw-pinlab')).map(t => t.getBoundingClientRect());
    let n = 0; for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) { const a = ls[i], b = ls[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) n++; }
    return { labels: ls.length, overlaps: n, count: document.getElementById('pw-count').textContent };
  });
  console.log(JSON.stringify(ov));
  await page.locator('.pw-card').screenshot({ path: 'wm_' + (dark ? 'dark' : 'light') + '.png' });
  console.log(errors.join('|') || 'no page errors'); await browser.close();
})();

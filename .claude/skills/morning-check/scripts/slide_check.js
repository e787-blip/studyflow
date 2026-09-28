const h = require('./harness');
const FX = require('./fixtures_more');
(async () => {
  for (const w of [320, 375]) {
    const { page, browser, errors } = await h.open({ width: w, plan: FX[1], mock: async () => ({ json: { result: '{"type":"none"}' } }) });
    await page.addStyleTag({ content: 'nav, .time-bar-wrap { position:static !important; }' });
    await page.evaluate(() => { for (let i = 0; i < 10; i++) { if (window.currentCard && window.currentCard.type === 'sfwb-brief') return; showNextCard(); } });
    await page.waitForTimeout(900);
    const tr = [];
    for (let k = 0; k < 4; k++) {
      tr.push(await page.evaluate(() => { const t = document.querySelector('[data-sfb-track]'); return t ? t.style.transform : 'none'; }));
      if (k === 2) await page.locator('#session-card').screenshot({ path: 'math_' + w + '_p3.png' });
      const btn = page.locator('#session-card .sfb-btn.is-primary').first();
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(700); }
    }
    const ov = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth > window.innerWidth, card: document.getElementById('session-card').scrollWidth > document.getElementById('session-card').clientWidth + 1 }));
    const whys = await page.evaluate(() => Array.from(document.querySelectorAll('.sfb-wwhy text')).map(t => t.textContent).filter(s => /…/.test(s)));
    console.log(w, 'track:', tr.join(' | '), 'overflow:', JSON.stringify(ov), 'cut reasons:', whys.length, errors.join(' ') || 'no errors');
    await browser.close();
  }
})();

// Walk a whole session answering EVERY question wrong (the struggling learner), and count
// what pictures appear on each question card: which kind, and whether it is a picture seen before.
const h = require('./harness'); const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
const FX = require(process.env.FX || './fixtures_more');
(async () => {
  const plan = FX[+process.argv[2] || 0];
  const { page, browser, errors } = await h.open({ plan, mock: async (p) => ({ delay: 200, json: { result: JSON.stringify(VALVES) } }) });
  await page.waitForTimeout(800);
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const info = await page.evaluate(() => { const c = window.currentCard; const r = document.getElementById('results-wrap'); return { t: c && c.type, qt: c && c.q && c.q.type, q: c && c.q && String(c.q.question || '').slice(0, 34), pre: !!(c && c.isPretest), rep: !!(c && c.isSpacedRepeat), done: !!(r && r.classList.contains('show')) }; });
    if (info.done) break;
    if (info.qt || info.t === 'labeldiagram') {
      await page.evaluate(() => {
        const o = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; }); if (o) return o.click();
        const t = Array.from(document.querySelectorAll('.tf-btn')).find(x => { const n = /answerTF\(this,'(\w+)','(\w+)'/.exec(x.getAttribute('onclick') || ''); return n && n[1] !== n[2]; }); if (t) return t.click();
        const fi = document.getElementById('fill-input'); if (fi) { fi.value = 'zzzz'; const b = document.getElementById('fill-btn'); if (b) { b.click(); b.click(); } return; }
        const sw = document.getElementById('seq-wrap'); if (sw) { Array.from(sw.querySelectorAll('.seq-item')).reverse().forEach(x => sw.appendChild(x)); const b = document.getElementById('seq-check-btn'); if (b) b.click(); return; }
        const sels = document.querySelectorAll('#session-card select'); if (sels.length) { sels.forEach(s => { s.selectedIndex = s.options.length - 1; }); const b = Array.from(document.querySelectorAll('#session-card button')).find(x => /check/i.test(x.textContent)); if (b) b.click(); }
      });
      await page.waitForTimeout(500);
      const pics = await page.evaluate(() => {
        const sc = document.getElementById('session-card'); const out = [];
        sc.querySelectorAll('.sf-recall').forEach(() => out.push('lessonPic'));
        sc.querySelectorAll('.sf-moment').forEach(hh => { const s = hh.getAttribute('data-state'); if (s === 'drawn' || s === 'wait') out.push('moment:' + hh.getAttribute('data-mkey')); });
        if (sc.querySelector('.ld-wrap, [id^="ld-"], svg circle') && window.currentCard.type === 'labeldiagram') out.push('labelCard');
        if (sc.querySelector('.sf-recall-btn')) out.push('seeDiagramBtn');
        return out;
      });
      rows.push((info.t + '/' + (info.qt || '')) + (info.pre ? '(pre)' : '') + (info.rep ? '(retry)' : '') + ' "' + info.q + '" -> ' + (pics.join(' + ') || '-'));
    }
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(100);
  }
  const real = rows.filter(r => !/\(pre\)|^write\//.test(r)); const qcards = real.length, withPic = real.filter(r => /lessonPic|moment|labelCard/.test(r)).length; const seenK = {}; let dup = 0; real.forEach(r => (r.match(/moment:\w+|lessonPic|labelCard/g) || []).forEach(k => { if (seenK[k]) dup++; seenK[k] = 1; }));
  rows.forEach(r => console.log(r));
  console.log('\nrepeated pictures: ' + dup + '\nquestion cards (no pretest/write): ' + qcards + ', with a picture: ' + withPic + ' (' + Math.round(100 * withPic / qcards) + '%)');
  console.log(errors.join('|') || 'no page errors'); await browser.close();
})();

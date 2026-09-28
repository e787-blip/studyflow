const h = require('./harness');
const fs = require('fs');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const shapes = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec.shapes;
(async () => {
  // 1. hostile lesson-art title: escaped on the lesson card, the recall panel, and never executed
  const env = await h.open({ mock: async (p) => /^Draw ONE illustration/.test(p)
    ? { json: { result: JSON.stringify({ type: 'drawing', title: '', w: 400, h: 240, shapes }) } }
    : { json: { result: '{"type":"none"}' } } });
  const { page, errors } = env;
  await page.evaluate(() => { lessonArt.spec.title = '<img src=x onerror="window.__pwned=1">Valves'; });
  await page.evaluate(() => { for (let i = 0; i < 20; i++) { if (window.currentCard && window.currentCard.type === 'lesson') return; showNextCard(); } });
  await page.waitForTimeout(500);
  const r1 = await page.evaluate(() => { const a = document.querySelector('#lesson-art'); return { img: a.querySelectorAll('img').length, pwned: !!window.__pwned, cap: (a.lastElementChild && a.lastElementChild.tagName === 'DIV') ? a.lastElementChild.textContent : null }; });
  assert(r1.img === 0 && !r1.pwned, 'lesson card: model title never becomes markup: ' + JSON.stringify(r1));
  const r1b = await page.evaluate(() => diagramCaptionHtml('<svg><text>Heart</text></svg>', 'Lungs <img src=x onerror="window.__pwned=1">', 'color:red'));
  assert(/&lt;img/.test(r1b) && !/<img/.test(r1b), 'diagramCaptionHtml escapes: ' + r1b);
  await page.evaluate(() => applyLessonArt());
  const r2 = await page.evaluate(() => ({ img: document.querySelectorAll('#lesson-art img').length, pwned: !!window.__pwned }));
  assert(r2.img === 0 && !r2.pwned, 'applyLessonArt: still text');
  const r3 = await page.evaluate(() => { recallCache.key = null; const p = recallPanel(lessonPicture(), 'x'); document.body.appendChild(p); return { img: p.querySelectorAll('img').length, pwned: !!window.__pwned, cap: (p.querySelector('.sf-recall-cap') || {}).textContent }; });
  assert(r3.img === 0 && !r3.pwned, 'recall panel: still text: ' + JSON.stringify(r3));
  // 2. dedupe: a title the drawing already prints is not printed again underneath
  await page.evaluate(() => { lessonArt.spec.title = 'Valves let blood go one way'; applyLessonArt(); });
  const r4 = await page.evaluate(() => { const a = document.querySelector('#lesson-art'); return { divs: a.querySelectorAll(':scope > div').length, svgTitle: Array.from(a.querySelectorAll('svg text')).map(t => t.textContent)[0] }; });
  assert(r4.divs === 0 && r4.svgTitle === 'Valves let blood go one way', 'title printed once (inside the drawing), no caption under it: ' + JSON.stringify(r4));
  const r5 = await page.evaluate(() => ({ a: diagramCaption('<svg><text>How blood</text><text>moves</text></svg>', 'How blood moves'), b: diagramCaption('<svg><text>Heart</text></svg>', 'How blood moves'), c: diagramCaption('<svg><text>Supply and demand</text></svg>', 'Demand curve') }));
  assert(r5.a === '' && r5.b === 'How blood moves' && r5.c === 'Demand curve', 'caption rule: wrapped title counts, different words kept: ' + JSON.stringify(r5));
  assert(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'CAPTIONS OK');
})();

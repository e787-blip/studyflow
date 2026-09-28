const h = require('./harness');
const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const toLabel = (page) => page.evaluate(() => { for (let i = 0; i < 60; i++) { const c = window.currentCard; if (c && c.type === 'labeldiagram' && c.lessonLabel) return true; showNextCard(); } return false; });
const cardState = (page) => page.evaluate(() => ({ wait: !!document.querySelector('#session-card .sf-moment-sketch'), pins: document.querySelectorAll('#session-card select').length, type: window.currentCard && window.currentCard.type, lesson: !!(window.currentCard && window.currentCard.lessonLabel) }));
async function scen(name, mock, body, opts) {
  console.log('\n## ' + name);
  const env = await h.open(Object.assign({ mock, settle: 300 }, opts || {}));
  try { await body(env); } catch (e) { assert(false, 'threw ' + e.message); }
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join(' | '));
  await env.browser.close();
}
(async () => {
  // A. the drawing is still coming when the card is reached
  await scen('label card waits for a drawing in progress', async (p) => /^Draw ONE/.test(p) ? { delay: 3500, json: { result: JSON.stringify(VALVES) } } : { json: { result: '{"type":"none"}' } }, async ({ page, calls }) => {
    assert(await toLabel(page), 'reached the labelling card');
    const s1 = await cardState(page);
    assert(s1.wait && s1.pins === 0, 'shows the sketching placeholder instead of skipping: ' + JSON.stringify(s1));
    await page.locator('#session-card').screenshot({ path: 'label_wait.png' });
    await page.waitForTimeout(4200);
    const s2 = await cardState(page);
    assert(!s2.wait && s2.pins >= 3 && s2.type === 'labeldiagram', 'builds itself when the drawing lands: ' + JSON.stringify(s2));
    assert(calls.filter(c => /^Draw ONE/.test(c)).length === 1, 'one drawing call, no duplicate');
    await page.locator('#session-card').screenshot({ path: 'label_built.png' });
  });
  // B. the first call failed: the card asks again, on the spot
  let n = 0;
  await scen('label card redraws after a failed call', async (p) => { if (!/^Draw ONE/.test(p)) return { json: { result: '{"type":"none"}' } }; n++; return n === 1 ? { abort: true } : { delay: 800, json: { result: JSON.stringify(VALVES) } }; }, async ({ page }) => {
    await page.waitForTimeout(400);
    assert(await toLabel(page), 'reached the card');
    assert((await cardState(page)).wait, 'waiting, having asked again');
    await page.waitForTimeout(1500);
    const s = await cardState(page);
    assert(s.pins >= 3, 'built from the second attempt (' + n + ' calls): ' + JSON.stringify(s));
  });
  // C. the model says nothing to draw: the card skips, honestly
  await scen('nothing to draw -> the card skips', async () => ({ json: { result: '{"type":"none"}' } }), async ({ page }) => {
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { for (let i = 0; i < 60; i++) { const c = window.currentCard; if (c && c.type === 'labeldiagram') return 'stopped on it'; showNextCard(); } return 'never shown'; });
    assert(r === 'never shown', 'no labelling card without a drawing: ' + r);
  });
  // D. too slow: the card moves on by itself
  await scen('too slow -> moves on', async (p) => /^Draw ONE/.test(p) ? { delay: 5000, json: { result: JSON.stringify(VALVES) } } : { json: { result: '{"type":"none"}' } }, async ({ page }) => {
    await page.evaluate(() => { LABEL_WAIT_MS = 800; });
    assert(await toLabel(page), 'reached the card');
    await page.waitForTimeout(1300);
    const s = await cardState(page);
    assert(!s.lesson, 'moved on after the wait: now on ' + s.type);
  });
  // E. misses are drawn automatically, capped
  await scen('miss pictures draw by themselves, up to the cap', async (p) => /^A student just got/.test(p) ? { delay: 600, json: { result: JSON.stringify(VALVES) } } : { json: { result: '{"type":"none"}' } }, async ({ page, calls }) => {
    const states = [];
    for (let k = 0; k < 40 && states.length < 6; k++) {
      const info = await page.evaluate(() => { const c = window.currentCard; return c && c.q && !c.isPretest && !c.isSpacedRepeat && (document.querySelector('.q-option') || document.querySelector('.tf-btn')) ? true : false; });
      if (info) {
        await page.evaluate(() => {
          const o = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; });
          if (o) return o.click();
          const t = Array.from(document.querySelectorAll('.tf-btn')).find(x => { const n = /answerTF\(this,'(\w+)','(\w+)'/.exec(x.getAttribute('onclick') || ''); return n && n[1] !== n[2]; });
          if (t) t.click();
        });
        await page.waitForTimeout(150);
        const st = await page.evaluate(() => { const hh = document.querySelector('#session-card .sf-moment'); return hh ? hh.getAttribute('data-state') + (hh.getAttribute('data-auto') ? '(auto)' : '') : 'none'; });
        states.push(st);
        if (states.length === 1) { await page.waitForTimeout(900); states.push('after-wait:' + await page.evaluate(() => document.querySelector('#session-card .sf-moment').getAttribute('data-state'))); }
      }
      await page.evaluate(() => showNextCard());
      await page.waitForTimeout(80);
    }
    console.log('   states:', states.join(' , '));
    assert(/^wait\(auto\)/.test(states[0]) && states[1] === 'after-wait:drawn', 'first miss: drawing starts without a tap and lands');
    const autos = await page.evaluate(() => momentArt.auto);
    assert(autos <= 4, 'never more than 4 automatic drawings (' + autos + ')');
  });
  // F. automatic + "nothing to draw" says nothing
  await scen('auto + none = silent', async (p) => /^A student just got/.test(p) ? { json: { result: '{"type":"none"}' } } : { json: { result: '{"type":"none"}' } }, async ({ page }) => {
    await page.evaluate(() => { for (let i = 0; i < 40; i++) { const c = window.currentCard; if (c && c.q && !c.isPretest && c.q.question === 'Why do veins need valves?') return; showNextCard(); } });
    await page.evaluate(() => { const o = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; }); o.click(); });
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => { const hh = document.querySelector('#session-card .sf-moment'); return hh ? JSON.stringify([hh.getAttribute('data-state'), hh.innerText]) : 'no host'; });
    assert(t === '["none",""]', 'empty, no apology: ' + t);
  });
  console.log(fails ? '\n' + fails + ' FAILED' : '\nON-THE-SPOT OK');
})();

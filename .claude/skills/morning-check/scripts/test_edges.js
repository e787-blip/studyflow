const h = require('./harness');
const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const ART = { json: { result: '{"type":"none"}' } };

async function toCard(page, pred) {
  return page.evaluate((src) => {
    const f = new Function('c', 'return ' + src);
    for (let i = 0; i < 40; i++) { const c = window.currentCard; if (c && c.q && !c.isPretest && f(c)) return true; showNextCard(); }
    return false;
  }, pred);
}
async function missMcq(page) {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick')); return m && m[1] !== m[2]; });
    b.click();
  });
  await page.waitForTimeout(250);
}
const state = (page, sel) => page.evaluate((s) => { const h = document.querySelector(s || '#session-card .sf-moment'); return h ? h.getAttribute('data-state') : null; }, sel);
const VALVE_Q = "c.q.question === 'Why do veins need valves?'";

async function scenario(name, mockFn, body) {
  let mock = mockFn;
  const env = await h.open({ mock: async (p, n) => /^Draw ONE illustration/.test(p) ? ART : mock(p, n) });
  env.setMock = (m) => { mock = m; };
  await env.page.evaluate(() => { MOMENT_AUTO_MAX = 0; });   // the tap path
  console.log('\n## ' + name);
  try { await body(env); } catch (e) { assert(false, 'threw: ' + e.message); }
  assert(env.errors.length === 0, 'no page errors' + (env.errors.length ? ': ' + env.errors.join(' | ') : ''));
  await env.browser.close();
}

(async () => {
  await scenario('network failure, then Try again', async () => ({ abort: true }), async (env) => {
    const { page, calls } = env;
    assert(await toCard(page, VALVE_Q), 'on the valves card');
    await missMcq(page);
    await page.click('.sf-moment-btn');
    await page.waitForTimeout(600);
    assert(await state(page) === 'failed', 'aborted call -> failed state');
    const t = await page.locator('#session-card .sf-moment').innerText();
    assert(/Couldn.t draw it just now/.test(t) && /Try again/.test(t), 'says so, offers Try again: ' + JSON.stringify(t));
    assert(await page.evaluate(() => Object.keys(day.visuals || {}).length) === 0, 'failure not cached');
    env.setMock(async () => ({ json: { result: JSON.stringify(VALVES) } }));
    await page.click('.sf-moment-btn');
    await page.waitForFunction(() => document.querySelector('#session-card .sf-moment').getAttribute('data-state') === 'drawn', null, { timeout: 5000 });
    assert(true, 'Try again draws');
  });

  await scenario('model says none', async () => ({ json: { result: '{"type":"none"}' } }), async (env) => {
    const { page, calls } = env;
    await toCard(page, VALVE_Q); await missMcq(page);
    await page.click('.sf-moment-btn'); await page.waitForTimeout(600);
    assert(await state(page) === 'none', 'none -> "no picture" note');
    const cached = await page.evaluate(() => { const k = Object.keys(day.visuals); return k.length === 1 && day.visuals[k[0]] === null; });
    assert(cached, 'null is cached');
    const n = calls.length;
    await page.evaluate(() => endSession()); await page.waitForTimeout(500);
    const r = await page.evaluate(() => Array.from(document.querySelectorAll('#results-wrap .sf-moment')).map(h => h.getAttribute('data-state')));
    assert(r.indexOf('none') !== -1 && calls.length === n, 'results screen shows the cached answer without a call: ' + r.join(','));
  });

  await scenario('reply with no JSON', async () => ({ json: { result: 'Sorry, I cannot draw that.' } }), async (env) => {
    const { page } = env;
    await toCard(page, VALVE_Q); await missMcq(page);
    await page.click('.sf-moment-btn'); await page.waitForTimeout(600);
    assert(await state(page) === 'failed', 'prose reply is a failed call, not an answer');
    assert(await page.evaluate(() => Object.keys(day.visuals || {}).length) === 0, 'not cached');
  });

  await scenario('server error payload', async () => ({ status: 502, json: { error: 'AI service error: 529' } }), async (env) => {
    const { page } = env;
    await toCard(page, VALVE_Q); await missMcq(page);
    await page.click('.sf-moment-btn'); await page.waitForTimeout(600);
    assert(await state(page) === 'failed', '502 -> failed');
  });

  await scenario('hostile spec', async () => ({ json: { result: JSON.stringify({ type: 'drawing', title: '<img src=x onerror="window.__pwned=1">', w: 400, h: 240, shapes: [
    { s: 'script', t: 'window.__pwned=1' },
    { s: 'foreignObject', x: 0, y: 0 },
    { s: 'path', d: 'M0 0 L10 10" onload="window.__pwned=1', stroke: 'ink' },
    { s: 'rect', x: 10, y: 10, w: 100, h: 60, fill: 'url(#evil)', stroke: 'blue' },
    { s: 'circle', x: 200, y: 120, r: 30, fill: 'blueFill', stroke: 'javascript:alert(1)' },
    { s: 'path', d: 'M20 200 Q200 120 380 200', stroke: 'blue', fill: 'none' },
    { s: 'text', x: 200, y: 60, t: '<script>window.__pwned=1</script>Valve', size: 12, fill: 'blueInk' }
  ] }) } }), async (env) => {
    const { page } = env;
    await toCard(page, VALVE_Q); await missMcq(page);
    await page.click('.sf-moment-btn'); await page.waitForTimeout(700);
    const s = await state(page);
    const dom = await page.evaluate(() => { const a = document.querySelector('#session-card .sf-moment'); return { pwned: !!window.__pwned, scripts: a.querySelectorAll('script, img, foreignObject').length, html: a.innerHTML.length, hasEvil: Array.from(a.querySelectorAll('*')).some(el => Array.from(el.attributes).some(at => /^on/i.test(at.name) || /url\(#evil\)|javascript:/i.test(at.value))), text: a.innerText.slice(0, 200) }; });
    assert(!dom.pwned && dom.scripts === 0 && !dom.hasEvil, 'nothing executable survives (state=' + s + '): ' + JSON.stringify(dom));
  });

  await scenario('too slow: times out, late reply ignored', async () => ({ delay: 2000, json: { result: JSON.stringify(VALVES) } }), async (env) => {
    const { page } = env;
    await page.evaluate(() => { MOMENT_TIMEOUT_MS = 600; });
    await toCard(page, VALVE_Q); await missMcq(page);
    await page.click('.sf-moment-btn'); await page.waitForTimeout(1000);
    assert(await state(page) === 'failed', 'timed out -> failed');
    await page.waitForTimeout(1800);
    assert(await state(page) === 'failed' && await page.evaluate(() => Object.keys(day.visuals || {}).length) === 0, 'late reply neither painted nor cached');
  });

  await scenario('learner moves on while it draws', async () => ({ delay: 1500, json: { result: JSON.stringify(VALVES) } }), async (env) => {
    const { page, calls } = env;
    await toCard(page, VALVE_Q); await missMcq(page);
    await page.click('.sf-moment-btn');
    await page.evaluate(() => showNextCard());
    await page.waitForTimeout(2200);
    assert(await page.evaluate(() => Object.keys(day.visuals || {}).length) === 1, 'landed off-screen and was cached');
    // the spaced-repeat retry of the same question: miss it again -> drawn at once, no new call
    const n = calls.length;
    const found = await page.evaluate(() => { for (let i = 0; i < 12; i++) { const c = window.currentCard; if (c && c.isSpacedRepeat) return true; showNextCard(); } return false; });
    if (found) {
      assert(await page.locator('#session-card .sf-moment').count() === 0, 'retry card: no picture before answering');
      await missMcq(page);
      assert(await state(page) === 'drawn' && calls.length === n, 'retry miss: cached picture shown at once, no call');
    } else assert(false, 'spaced-repeat retry card found');
  });

  await scenario('self-grading card (sequence) and excluded types', async () => ({ json: { result: JSON.stringify(VALVES) } }), async (env) => {
    const { page } = env;
    assert(await toCard(page, "c.type === 'sequence'"), 'on the sequence card');
    assert(await page.locator('#session-card .sf-moment').count() === 0, 'nothing before answering');
    await page.evaluate(() => { const w = document.getElementById('seq-wrap'); const it = Array.from(w.querySelectorAll('.seq-item')); it.reverse().forEach(x => w.appendChild(x)); document.getElementById('seq-check-btn').click(); });
    await page.waitForTimeout(300);
    assert(await state(page) === 'idle', 'sequence miss (recordMiss path) offers the chip');
    const ex = await page.evaluate(() => ['write', 'bigequation', 'labeldiagram', 'graph', 'sentence', 'tracetable', 'matchpairs'].map(t => momentCanDraw({ type: t, question: 'Q?', answer: 'x', modelAnswer: 'x' }, t)));
    assert(ex.every(v => v === false), 'no offer on write/equation/labelling/graph/sentence/trace/pairs: ' + ex.join(','));
    const ok = await page.evaluate(() => ['mcq', 'truefalse', 'fill', 'estimate', 'wordproblem', 'classify', 'errorspot', 'twopart', 'highlight', 'corroborate', 'scenario'].map(t => {
      const q = { type: t, question: 'Q?', options: ['a', 'b'], correctIndex: 0, correct: 'True', answer: '5', itemsA: ['x'], itemsB: ['y'], categoryA: 'A', categoryB: 'B', steps: [{ text: 's', hasError: true }], sentences: ['one', 'two'], reasons: ['r1', 'r2'], reasonIndex: 1 };
      return t + ':' + (momentCanDraw(q) ? momentAnswer(q) : 'NO');
    }));
    console.log('   answers:', ok.join(' | '));
    assert(ok.every(v => !/:NO$/.test(v)), 'offered on every drawable format');
  });

  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL EDGE CASES PASS');
})();

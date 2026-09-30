// The visual pass of 2026-09-30, held in place. Real page loads, api/generate mocked.
const h = require('./harness'); const fs = require('fs');
const FX = require('./fixtures_more');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const lum = rgb => { const m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(rgb || ''); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : -1; };
const wrong = page => page.evaluate(() => {
  const o = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick') || ''); return m && m[1] !== m[2]; }); if (o) { o.click(); return 'mcq'; }
  const t = Array.from(document.querySelectorAll('.tf-btn')).find(x => { const n = /answerTF\(this,'(\w+)','(\w+)'/.exec(x.getAttribute('onclick') || ''); return n && n[1] !== n[2]; }); if (t) { t.click(); return 'tf'; }
  const fi = document.getElementById('fill-input'); if (fi) { fi.value = 'zqxw'; const b = document.getElementById('fill-btn'); if (b) { b.click(); b.click(); } return 'fill'; }
  return '';
});
(async () => {
  // 1. Light: headings, banner, chips, results.
  let env = await h.open({ mock: async () => ({ json: { result: JSON.stringify(VALVES) } }) });
  let page = env.page;
  const seen = { bannerOnTeach: false, chipBg: {}, diffAmber: false, headW: {} };
  let pretestMisses = 0, bannerAfterPretest = null;
  for (let i = 0; i < 30; i++) {
    const c = await page.evaluate(() => { const c = window.currentCard || {}; const r = document.getElementById('results-wrap'); return { t: c.type, pre: !!c.isPretest, q: !!c.q, done: !!(r && r.classList.contains('show')) }; });
    if (c.done) break;
    const st = await page.evaluate(() => ({
      banner: document.getElementById('struggling-banner').classList.contains('show'),
      h2: (() => { const e = document.querySelector('#session-card .card-header h2'); return e ? getComputedStyle(e).fontWeight : null; })(),
      chips: Array.from(document.querySelectorAll('#session-card .q-type-label')).map(e => getComputedStyle(e).backgroundColor),
      diff: Array.from(document.querySelectorAll('#session-card .q-difficulty')).map(e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).color)
    }));
    if (st.h2) seen.headW[st.h2] = 1;
    st.chips.forEach(b => seen.chipBg[b] = 1);
    st.diff.forEach(d => { if (/245, 158, 11|192, 107, 26|255, 240, 224|220, 38, 38|254, 226, 226/.test(d)) seen.diffAmber = true; });
    if (['welcome', 'lesson', 'flashcards'].indexOf(c.t) !== -1 && st.banner) seen.bannerOnTeach = true;
    if (c.q && !['write'].includes(c.t)) { const a = await wrong(page); if (c.pre && a) pretestMisses++; await page.waitForTimeout(250); }
    if (c.t === 'pretest-done') bannerAfterPretest = st.banner;
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(120);
  }
  assert(Object.keys(seen.headW).every(w => w === '400'), 'card headings use the serif\'s real weight (' + Object.keys(seen.headW).join(',') + ')');
  assert(pretestMisses >= 2 && bannerAfterPretest === false, 'missing the pre-test raises no "slow down" banner (' + pretestMisses + ' pre-test misses)');
  assert(!seen.bannerOnTeach, 'the banner never sits over the welcome, lesson or flashcards');
  assert(Object.keys(seen.chipBg).length === 1, 'every type chip is one colour: ' + Object.keys(seen.chipBg).join(' / '));
  assert(!seen.diffAmber, 'difficulty is not amber/red');
  await page.evaluate(() => { if (!document.getElementById('results-wrap').classList.contains('show')) endSession(); });
  await page.waitForTimeout(600);
  const res = await page.evaluate(() => {
    const qs = Array.from(document.querySelectorAll('#results-wrap .wi-q')).map(e => e.firstChild.textContent.trim());
    const yours = Array.from(document.querySelectorAll('#results-wrap .wi-yours')).map(e => e.textContent);
    const top = document.querySelector('#results-wrap .results-top');
    return { qs, yours, dup: qs.length !== new Set(qs).size, topBg: top && getComputedStyle(top).backgroundImage, ring: !!document.querySelector('.r-ring') };
  });
  assert(!res.dup && res.qs.length > 0, 'what-to-study lists each question once (' + res.qs.length + ' entries)');
  assert(!res.yours.some(y => /Check|Submit/i.test(y)), 'no "Your answer: Check answers": ' + res.yours.filter(y => /Check|Submit/i.test(y)).join(' | '));
  assert(res.yours.some(y => /zqxw/.test(y)) || !res.qs.some(q => /___/.test(q)), 'a fill-in miss shows what was typed');
  assert(res.ring && res.topBg === 'none', 'score is the ring card, not a coloured slab');
  assert(env.errors.length === 0, 'light walk: no page errors ' + env.errors.join('|'));
  await env.browser.close();

  // 2. Dark: every drawing sits on paper.
  env = await h.open({ dark: true, mock: async () => ({ json: { result: JSON.stringify(VALVES) } }) }); page = env.page;
  let artBg = null, ldBg = null;
  for (let i = 0; i < 40 && (artBg === null || ldBg === null); i++) {
    const r = await page.evaluate(() => { const a = document.getElementById('lesson-art'), l = document.querySelector('.ld-fig'); return { a: a && getComputedStyle(a).backgroundColor, l: l && getComputedStyle(l).backgroundColor }; });
    if (r.a && artBg === null) artBg = r.a;
    if (r.l && ldBg === null) ldBg = r.l;
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(150);
  }
  assert(lum(artBg) > 0.9, 'dark mode: the lesson picture is on paper (' + artBg + ')');
  assert(lum(ldBg) > 0.9, 'dark mode: the labelling picture is on paper (' + ldBg + ')');
  assert(env.errors.length === 0, 'dark walk: no page errors ' + env.errors.join('|'));
  await env.browser.close();

  // 3. A question with nothing to picture walks as steps, never the old text board, and says the answer.
  env = await h.open({ plan: FX[3], mock: async () => ({ json: { result: '{"type":"none"}' } }) }); page = env.page;
  for (let i = 0; i < 30; i++) {
    const t = await page.evaluate(() => window.currentCard && window.currentCard.q && window.currentCard.q.type);
    if (t === 'sentence') break;
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.sfwbExplain(window.currentCard.q.explanation || ''));
  await page.waitForTimeout(700);
  const walk = await page.evaluate(() => ({ t: window.currentCard && window.currentCard.type, kind: window.currentCard && window.currentCard.walk && window.currentCard.walk.kind,
    labels: ((window.currentCard && window.currentCard.walk && window.currentCard.walk.rows) || []).map(r => r.label) }));
  assert(walk.t === 'sfwb-picwalk' && walk.kind === 'text', 'a sentence walkthrough is the step walk (' + walk.t + '/' + walk.kind + ')');
  assert(walk.labels.indexOf('The answer') !== -1, 'and it says the answer: ' + walk.labels.join(' > '));
  assert(env.errors.length === 0, 'walk: no page errors ' + env.errors.join('|'));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'VISUALS OK');
})();

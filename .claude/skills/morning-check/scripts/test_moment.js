const h = require('./harness');
const fs = require('fs');
const VALVES = JSON.parse(fs.readFileSync(__dirname + '/valves.json', 'utf8'))[0].spec;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const dark = process.argv.includes('--dark');
  const tag = dark ? '_dark' : '';
  const { browser, page, calls, errors } = await h.open({ dark, mock: async (prompt) => {
    if (/^Draw ONE illustration/.test(prompt)) return { json: { result: '{"type":"none"}' } };
    if (/^A student just got/.test(prompt)) return { delay: 2500, json: { result: JSON.stringify(VALVES) } };
    return { status: 500, json: { error: 'unexpected' } };
  }});
  // A pre-test miss offers nothing.
  await page.evaluate(() => showNextCard());
  const pre = await page.evaluate(() => !!(window.currentCard && window.currentCard.isPretest));
  const clickedPre = await page.evaluate(() => {
    const b = document.querySelector('.tf-btn') || Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick')); return m && m[1] !== m[2]; });
    if (!b) return 'none';
    if (b.classList.contains('tf-btn')) { const m = /answerTF\(this,'(\w+)','(\w+)'/.exec(b.getAttribute('onclick')); const wrong = Array.from(document.querySelectorAll('.tf-btn')).find(x => { const n = /answerTF\(this,'(\w+)','(\w+)'/.exec(x.getAttribute('onclick')); return n && n[1] !== n[2]; }); wrong.click(); return 'tf'; }
    b.click(); return 'mcq';
  });
  await page.waitForTimeout(300);
  assert(pre && (await page.locator('#session-card .sf-moment').count()) === 0, 'pre-test miss (' + clickedPre + ') offers no drawing');
  await page.evaluate(() => { MOMENT_AUTO_MAX = 0; });   // this suite tests the tap path
  const seen = await page.evaluate(() => {
    const types = [];
    for (let i = 0; i < 40; i++) {
      const c = window.currentCard;
      if (c && c.q && c.q.question === 'Why do veins need valves?' && !c.isPretest) return types;
      showNextCard(); types.push(window.currentCard && window.currentCard.type);
    }
    return types;
  });
  console.log('cards walked:', seen.join(' > '));
  const onCard = await page.evaluate(() => window.currentCard && window.currentCard.q && window.currentCard.q.question);
  assert(onCard === 'Why do veins need valves?', 'reached the valves MCQ');
  assert(await page.locator('.sf-moment').count() === 0, 'no drawing offer BEFORE answering (invariant 7)');
  await page.addStyleTag({ content: 'nav, .time-bar-wrap { position:static !important; }' });
  await page.locator('#session-card').screenshot({ path: 'm1_before' + tag + '.png' });

  // click a wrong option
  const idx = await page.evaluate(() => {
    const bs = Array.from(document.querySelectorAll('.q-option'));
    for (let i = 0; i < bs.length; i++) {
      const m = /answerMCQ\(this,(\d+),(\d+)/.exec(bs[i].getAttribute('onclick'));
      if (m && m[1] !== m[2]) return i;
    }
    return -1;
  });
  await page.locator('.q-option').nth(idx).click();
  await page.waitForTimeout(400);
  const st1 = await page.evaluate(() => { const h = document.querySelector('#session-card .sf-moment'); return h && { state: h.getAttribute('data-state'), txt: h.innerText }; });
  assert(st1 && st1.state === 'idle' && /Draw it for me/.test(st1.txt), 'miss shows the "Draw it for me" chip: ' + JSON.stringify(st1));
  assert(calls.length === 1, 'no call fired by the miss itself (calls=' + calls.length + ')');
  await page.locator('#session-card .sf-moment').scrollIntoViewIfNeeded();
  await page.locator('#session-card').screenshot({ path: 'm2_miss' + tag + '.png' });

  await page.locator('.sf-moment-btn').click();
  await page.waitForTimeout(700);
  const st2 = await page.evaluate(() => document.querySelector('#session-card .sf-moment').getAttribute('data-state'));
  assert(st2 === 'wait', 'tap shows the sketching placeholder (state=' + st2 + ')');
  await page.locator('.sf-moment-btn, .sf-moment-panel').first().click().catch(() => {});
  await page.locator('#session-card').screenshot({ path: 'm3_wait' + tag + '.png' });
  await page.waitForFunction(() => document.querySelector('#session-card .sf-moment').getAttribute('data-state') === 'drawn', null, { timeout: 8000 });
  assert(calls.length === 2, 'exactly one moment call, even with a second tap (calls=' + calls.length + ')');
  const mp = calls[1];
  fs.writeFileSync('moment_prompt.txt', mp);
  assert(/RIGHT ANSWER: To stop blood flowing backwards/.test(mp), 'prompt carries the right answer');
  assert(/THEY ANSWERED \(wrong\): /.test(mp), 'prompt carries what they answered: ' + (mp.match(/THEY ANSWERED[^\n]*/) || [''])[0]);
  console.log('moment prompt chars:', mp.length);
  const saved = await page.evaluate(() => {
    const k = Object.keys(day.visuals || {});
    const p = JSON.parse(SFStore.getItem('studyflow_plan'));
    return { k, inPlan: Object.keys((p.days[0].visuals) || {}), arrows: document.querySelectorAll('#session-card .sf-moment-art marker').length, ids: Array.from(document.querySelectorAll('#session-card .sf-moment-art marker')).map(m => m.id) };
  });
  assert(saved.k.length === 1 && saved.inPlan.length === 1, 'cached on the day and in the saved plan: ' + JSON.stringify(saved));
  assert(saved.ids.length && saved.ids.every(id => id !== 'skArrow'), 'marker ids made unique: ' + saved.ids.join(','));
  await page.locator('#session-card .sf-moment-panel').scrollIntoViewIfNeeded();
  await page.locator('#session-card').screenshot({ path: 'm4_drawn' + tag + '.png' });

  // walkthrough board: cached, no new call
  const hasWalk = await page.locator('.sfwb-explain').count();
  if (hasWalk) {
    await page.locator('.sfwb-explain').first().click();
    await page.waitForTimeout(900);
    const b = await page.evaluate(() => { const h = document.querySelector('#pw-fig .sf-moment') || document.querySelector('.sf-moment-board .sf-moment'); return h && h.getAttribute('data-state'); });
    assert(b === 'drawn', 'walkthrough shows the same picture, on the walk (state=' + b + ')');
    assert(calls.length === 2, 'board reused the cache (calls=' + calls.length + ')');
    await page.locator('#session-card').screenshot({ path: 'm5_board' + tag + '.png' });
  } else assert(false, 'walkthrough button present');

  // results screen
  await page.evaluate(() => endSession());
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => Array.from(document.querySelectorAll('#results-wrap .sf-moment')).map(h => h.getAttribute('data-state') + ':' + (h.querySelector('details') ? 'folded' : 'open')));
  /* One entry per QUESTION. The pre-test picks at random; when it asked this
     same valves question and that was missed too, the list used to print it
     twice. Since 2026-09-30 a repeat is one entry marked "missed Nx". */
  const u = await page.evaluate(() => {
    const k = {}; wrongItems.forEach(w => { const q = w.q || {}; k[(q.type || '') + '|' + (q.question || q.scenario || q.title || '')] = 1; });
    return { distinct: Object.keys(k).length, raw: wrongItems.length, times: document.querySelectorAll('#results-wrap .wi-times').length };
  });
  assert(r.indexOf('drawn:folded') !== -1 && r.length === u.distinct, 'results screen folds the drawn picture, one slot per missed question: ' + r.join(',') + ' ' + JSON.stringify(u));
  assert((u.raw > u.distinct) === (u.times > 0), 'a question missed more than once is listed once and marked: ' + JSON.stringify(u));
  await page.locator('#results-wrap .wrong-reviews').scrollIntoViewIfNeeded();
  await page.locator('#results-wrap .wrong-reviews').screenshot({ path: 'm6_results' + tag + '.png' });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
})();

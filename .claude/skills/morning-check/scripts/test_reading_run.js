// A reading day (Oct 2026, the owner: teach the method, then "go to the
// reading passages and multiple of those ... a little bit of mix up in
// between"), on real page loads of lesson.html:
//  - three reading sets queue as three passage blocks one after another, with
//    exactly ONE other card between neighbours, and the other formats after
//    the last one - not scattered through them;
//  - every question appears once (3 sets x 3 + the rest), none dropped;
//  - a block is never split (passage card, then its own questions);
//  - one set on a day keeps the old spread (no run), a non-reading day is
//    untouched;
//  - the plan builder's reading mixes are three / two / two sets, and the
//    lesson prompt carries the method line for those days only.
// Fails on the code before: the sets were spread through a shuffled run.
const fs = require('fs'), path = require('path');
const h = require('./harness');
const fx = require('./fixture');
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const NONE = { json: { result: '{"type":"none"}' } };

function mc(t, k) { return { type: 'mcq', question: t, options: ['Right', 'Wrong', 'Also wrong', 'Not this'], correctIndex: k || 0, hint: 'Look back.', explanation: 'Because.', difficulty: 'Medium' }; }
function set(n) {
  return { type: 'readingset', title: 'Passage ' + n, difficulty: 'Medium',
    passage: 'Passage ' + n + ': the reef is built by tiny animals that grow in warm shallow water. Over many years their hard skeletons pile up and form a wall that shelters fish and slows the waves. When the water gets too hot the animals lose the algae that feed them, and the reef turns white.',
    questions: [
      { question: 'Set ' + n + ' main idea?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, questionType: 'main-idea', explanation: 'x' },
      { question: 'Set ' + n + ' inference?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, questionType: 'inference', explanation: 'x' },
      { question: 'Set ' + n + ' word?', options: ['A', 'B', 'C', 'D'], correctIndex: 2, questionType: 'vocab-in-context', explanation: 'x' }] };
}
function readPlan(nSets, subtype) {
  const p = JSON.parse(JSON.stringify(fx.plan));
  p.id = 'rr' + nSets + subtype; p.subject = 'Reading comprehension: coral reefs'; p.subjectType = 'english';
  const d = p.days[0]; d.title = 'Finding the main idea'; d.microTopic = '';
  const qs = [];
  for (let i = 1; i <= nSets; i++) qs.push(set(i));
  qs.push({ type: 'highlight', question: 'Which sentence shows why reefs turn white?', sentences: ['One.', 'Two.', 'Three.', 'Four.'], correctIndex: 2, explanation: 'x', difficulty: 'Medium' });
  qs.push({ type: 'fill', question: 'A reef turns ___ when the animals lose their algae.', answer: 'white', hint: 'A colour.', explanation: 'x', difficulty: 'Medium' });
  qs.push({ type: 'write', question: 'Explain how a reef protects a coast.', modelAnswer: 'Skeletons pile up and slow waves.', hint: '', explanation: 'x', difficulty: 'Medium' });
  if (subtype === 'mcq') { qs.push(mc('Extra mcq one')); qs.push(mc('Extra mcq two')); }
  d.questions = qs;
  const d2 = JSON.parse(JSON.stringify(d)); d2.day = 2; p.days.push(d2);
  return p;
}
async function shape(p, day) {
  const { page, browser, errors } = await h.open({ plan: p, day: day === undefined ? 1 : day, mock: async () => NONE });
  const r = await page.evaluate(() => {
    const start = sessionCards.findIndex(c => c.type === 'reading-passage');
    const seq = sessionCards.slice(Math.max(0, start)).map(c => c.type === 'reading-passage' ? 'R' : (c.q && c.q.collapsePassage ? 'p' : (c.type === 'write' ? 'W' : c.type[0])));
    const qs = sessionCards.filter(c => c.q && !c.isPretest && !c.isReview && c.type !== 'write').map(c => c.q.question || c.q.title || c.type);
    return { seq: seq.join(''), qs, types: sessionCards.map(c => c.type), total: sessionCards.length };
  });
  return { r, browser, errors };
}

(async () => {
  // ── 1. three sets: a run, one card between, the rest after ──
  {
    const { r, browser, errors } = await shape(readPlan(3, 'mcq'));
    console.log('\n## 3 sets + extras: ' + r.seq);
    const m = /^R(p+)(.)R(p+)(.)R(p+)(.*)$/.exec(r.seq.replace(/[^\w]/g, ''));
    assert(r.seq.indexOf('q') > r.seq.lastIndexOf('R') || r.seq.indexOf('q') < 0, 'plain multiple choice only comes after the last passage (' + r.seq + ')');
    assert(!!m, 'three passage blocks, one card between each pair, then the rest (' + r.seq + ')');
    if (m) {
      assert(m[1].length === 3 && m[3].length === 3 && m[5].length === 3, 'each block is a passage then its three questions');
      assert(m[2] !== 'q' && m[4] !== 'q', 'the cards between sets are not plain multiple choice (' + m[2] + m[4] + ')');
      assert(/^[^R]*$/.test(m[6]) && m[6].length >= 3, 'the other formats follow the last passage (' + m[6] + ')');
    }
    const count = {};
    r.qs.forEach(q => { count[q] = (count[q] || 0) + 1; });
    assert(Object.keys(count).filter(k => /^Set \d/.test(k)).length === 9, 'all nine set questions are in the day');
    assert(Object.keys(count).every(k => count[k] === 1), 'every question appears once, none doubled');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }
  // ── 2. day 0 (pre-test path) still builds the run ──
  {
    const { r, browser } = await shape(readPlan(3, 'mcq'), 0);
    assert(/R[p]{3}.R[p]{3}.R[p]{3}/.test(r.seq.replace(/[^\w]/g, '')), 'day 1 (with a pre-test) builds the same run (' + r.seq + ')');
    await browser.close();
  }
  // ── 3. one set keeps the old spread; nothing becomes a run ──
  {
    const { r, browser } = await shape(readPlan(1, 'mcq'));
    assert((r.seq.match(/R/g) || []).length === 1, 'one set: one passage card, spread as before (' + r.seq + ')');
    await browser.close();
  }
  // ── 4. the plan builder: mixes and the method line ──
  {
    const app = fs.readFileSync(path.join(__dirname, '../../../../app.html'), 'utf8');
    const grab = (key, after) => { const i = app.indexOf(after); const j = app.indexOf("key:'" + key + "'", i); return app.slice(j, app.indexOf('visual:', j)); };
    const count = (s) => (s.match(/'readingset'/g) || []).length;
    const eng = app.indexOf('english: ['), lang = app.indexOf('language: [');
    const reading = grab('reading', 'english: ['), lit = grab('literature', 'english: ['), lreading = (function () { const j = app.indexOf("label:'Reading and conversation'"); return app.slice(j, app.indexOf('visual:', j)); })();
    assert(count(reading) === 3, 'english/reading asks for three reading sets');
    assert(count(lit) === 2, 'english/literature asks for two');
    assert(count(lreading) === 2, 'language/reading asks for two');
    assert(!/'mcq'/.test(reading), 'english/reading drops the plain mcq (each passage carries three questions)');
    assert(/THE LESSON TEACHES THE METHOD FIRST/.test(reading) && /THE LESSON TEACHES THE METHOD FIRST/.test(lit) && /THE LESSON TEACHES THE METHOD FIRST/.test(lreading), 'all three carry a method line');
    const grammar = grab('grammar', 'english: [');
    assert(!/method:/.test(grammar), 'grammar (confusable rules, kept mixed) has no method block');
    assert(/\(sub && sub\.method\)/.test(app), 'the lesson prompt prints the method line');
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nREADING RUN OK');
})();

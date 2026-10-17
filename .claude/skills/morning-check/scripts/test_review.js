// Spaced review and pitch-following (Oct 2026), on real page loads of
// lesson.html with api/generate mocked:
//  - questions from earlier days whose SM-2 date has passed come back as
//    review cards in the practice run (sfDueReview), never in the opening,
//    the pre-test, on day 0, or in an assignment;
//  - an assignment writes no SM-2 record; the self-grading cards' right
//    answers reach SM-2 (recordRight) and their misses count toward "slow down";
//  - a miss is logged with what was answered and what was right;
//  - the top-up asks for harder or easier questions as the learner goes
//    (sfAdapt), names their recent misses (sfWeakLine), and runs the
//    question lint (no keyless card, no "All of the above", keys spread).
// Fails on the code before: sfDueReview, sfAdapt, sfWeakLine, recordRight
// did not exist and the top-up kept a keyless mcq.
const h = require('./harness');
const fx = require('./fixture');
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const NONE = { json: { result: '{"type":"none"}' } };

function hash(q) {   // lesson.html getQuestionHash, verbatim
  const str = (q.question || '').substring(0, 30); let x = 0;
  for (let i = 0; i < str.length; i++) { x = ((x << 5) - x) + str.charCodeAt(i); x = x & x; }
  return 'q_' + Math.abs(x);
}
function twoDayPlan() {
  const p = JSON.parse(JSON.stringify(fx.plan));
  const d2 = JSON.parse(JSON.stringify(p.days[0]));
  d2.day = 2; d2.title = 'Blood and the lungs';
  d2.questions = d2.questions.map((q, i) => Object.assign({}, q, { question: 'Day two: ' + (q.question || ('q' + i)) }));
  p.days.push(d2);
  return p;
}

(async () => {
  // ── 1. due review on day 2 ─────────────────────────────────────────────
  {
    const plan = twoDayPlan();
    const past = new Date(Date.now() - 2 * 86400000).toISOString();
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    const seed = {};
    const d1 = plan.days[0].questions.filter(q => /^(mcq|truefalse|fill|sequence|classify|estimate)$/.test(q.type));
    d1.forEach((q, i) => { seed['studyflow_sm2_' + hash(q)] = { easiness: 2.5, interval: 1, repetitions: i % 2, nextReview: i < 4 ? past : future }; });
    const { page, browser, errors } = await h.open({ plan, day: 1, seed, mock: async () => NONE });
    const r = await page.evaluate(() => {
      const due = sessionCards.map((c, i) => ({ c, i })).filter(x => x.c.isDue);
      const firstQ = sessionCards.findIndex(c => c.q && !c.isPretest && !c.isReview);
      const welcome = sessionCards.findIndex(c => c.type === 'welcome');
      const d0 = plan.days[0].questions.map(q => q.question);
      const OPEN = { welcome: 1, lesson: 1, flashcards: 1, 'sfwb-brief': 1, 'review-intro': 1, 'review-done': 1, 'interleave-intro': 1 };
      let practiceStart = 0; sessionCards.forEach((c, i) => { if (OPEN[c.type] || c.isPretest || /^pretest/.test(c.type)) practiceStart = i + 1; });
      return { n: due.length, idx: due.map(x => x.i), welcome, firstQ, practiceStart,
               fromDay0: due.every(x => d0.indexOf(x.c.q.question) !== -1),
               review: due.every(x => x.c.isReview && !x.c.isPretest),
               copies: due.every(x => plan.days[0].questions.indexOf(x.c.q) === -1),
               types: due.map(x => x.c.q.type) };
    });
    console.log('\n## due review, day 2: ' + JSON.stringify(r));
    assert(r.n >= 1 && r.n <= 3, '1-3 questions due for review are queued (' + r.n + ')');
    assert(r.fromDay0, 'every one is from an earlier day');
    assert(r.review, 'tagged isReview, never pre-test');
    assert(r.copies, 'copies, not the earlier day\'s own objects');
    assert(r.idx.every(i => i >= r.practiceStart && i > r.welcome), 'all inside the practice run, after the opening');
    // the not-yet-due ones stay out
    const notDue = await page.evaluate(() => sfDueReview(10).length);
    assert(notDue <= 4, 'only past-due questions are offered (' + notDue + ' of 4 past-due)');
    // assignment mode
    const asg = await page.evaluate(() => {
      assignMode = true;
      const n = sfDueReview(3).length;
      const q = { question: 'An assignment question nobody has seen ' + Date.now() };
      const before = Object.keys(localStorage).filter(k => /studyflow_sm2_/.test(k)).length;
      updateSM2(q, true);
      const after = Object.keys(localStorage).filter(k => /studyflow_sm2_/.test(k)).length;
      sfAdapt(true); sfAdapt(true); sfAdapt(true);
      const lvl = sfLevel;
      assignMode = false;
      return { n, wrote: after - before, lvl };
    });
    assert(asg.n === 0, 'assignment mode: no due review');
    assert(asg.wrote === 0, 'assignment mode: updateSM2 writes nothing');
    assert(asg.lvl === 0, 'assignment mode: pitch does not move');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // ── 2. day 0 gets none ────────────────────────────────────────────────
  {
    const { page, browser, errors } = await h.open({ mock: async () => NONE });
    const n = await page.evaluate(() => sessionCards.filter(c => c.isDue).length);
    console.log('\n## day 0');
    assert(n === 0, 'day 0: no due review');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // ── 3. graders, log, pitch, weak line, top-up lint ────────────────────
  {
    let topups = [];
    const TOPUP = JSON.stringify([
      { type: 'mcq', question: 'Pick the chamber that pumps blood to the whole body.', options: ['Left ventricle', 'Right atrium', 'All of the above'], correctIndex: 0, difficulty: 'Hard' },
      { type: 'mcq', question: 'Which vessel has the thinnest wall of all?', options: ['Capillary', 'Artery', 'Vein'], difficulty: 'Easy' },
      { type: 'truefalse', question: 'The aorta carries blood away from the heart.', correct: 'True', difficulty: 'Easy' },
      { type: 'mcq', question: 'What do the pulmonary veins carry to the heart?', options: ['Oxygen-rich blood', 'Oxygen-poor blood', 'Lymph', 'Air'], correctIndex: 0, difficulty: 'Medium' }
    ]);
    const { page, browser, errors } = await h.open({ mock: async (p) => {
      if (/^TOPIC LOCK/.test(p)) { topups.push(p); return { json: { result: TOPUP } }; }
      return NONE;
    } });
    console.log('\n## graders, log, pitch, top-up');
    // recordRight reaches SM-2; recordMiss counts toward slow-down
    const g = await page.evaluate(() => {
      const q = { type: 'sequence', question: 'Order the path of blood through the heart, start to end', items: ['a', 'b', 'c'] };
      sessionCards.splice(cardIndex, 0, { type: 'sequence', q });
      cardIndex++;
      recordRight();
      const sm = getSM2Data(q);
      window.currentCard = sessionCards[cardIndex - 1];
      recentWrong = 0;
      recordMiss('x', 'y');
      return { reps: sm.repetitions, next: !!sm.nextReview, rw: recentWrong };
    });
    assert(g.reps === 1 && g.next, 'recordRight: a self-graded right answer is scheduled by SM-2');
    assert(g.rw === 1, 'recordMiss counts toward "slow down"');
    // a real mcq miss is logged with what was answered and what was right
    const lg = await page.evaluate(async () => {
      for (let i = 0; i < 40; i++) { const c = window.currentCard; if (c && c.q && c.q.type === 'mcq' && !c.isPretest) break; showNextCard(); }
      const b = Array.from(document.querySelectorAll('.q-option')).find(x => { const m = /answerMCQ\(this,(\d+),(\d+)/.exec(x.getAttribute('onclick')); return m && m[1] !== m[2]; });
      if (!b) return null;
      const said = b.textContent;
      b.click();
      await new Promise(r => setTimeout(r, 200));
      showNextCard();
      const log = JSON.parse(SFStore.getItem('studyflow_answer_log') || '[]');
      return { e: log[log.length - 1], said };
    });
    assert(lg && lg.e && lg.e.k < lg.e.n, 'a missed mcq is logged as a miss');
    assert(lg && lg.e && lg.e.w && lg.said.indexOf(lg.e.w) !== -1, 'the log keeps what was answered: ' + (lg && lg.e && lg.e.w));
    assert(lg && lg.e && lg.e.r && lg.e.r !== lg.e.w, 'and what was right: ' + (lg && lg.e && lg.e.r));
    // pitch
    const pitch = await page.evaluate(() => {
      sfLevel = 0; sfRunRight = 0; sfRunWrong = 0;
      sfAdapt(true); sfAdapt(true); const two = sfLevel; sfAdapt(true);
      const up = sfLevel;
      const hard = sfLevelRule();
      sfAdapt(false); sfAdapt(false); const back = sfLevel;
      sfAdapt(false); sfAdapt(false); const down = sfLevel;
      const easy = sfLevelRule();
      return { two, up, back, down, hard, easy };
    });
    assert(pitch.two === 0 && pitch.up === 1, 'three right in a row raise the pitch (two do not)');
    assert(pitch.back === 0 && pitch.down === -1, 'two misses lower it a step at a time');
    assert(/HARD/.test(pitch.hard) && /EASY/.test(pitch.easy), 'the rule text follows the level');
    // top-up prompt and lint, at the eased level
    const tp = await page.evaluate(async () => {
      generatingNew = false; questionBuffer = [];
      generateMoreQuestions();
      for (let i = 0; i < 50 && generatingNew; i++) await new Promise(r => setTimeout(r, 100));
      const buf = questionBuffer.map(q => ({ q: q.question, o: q.options, k: q.correctIndex, d: q.difficulty }));
      const pick = buf.length ? questionBuffer[sfPickByLevel(questionBuffer)].difficulty : null;
      sfLevel = 1;
      const pickHard = buf.length ? questionBuffer[sfPickByLevel(questionBuffer)].difficulty : null;
      sfLevel = 0;
      return { buf, pick, pickHard };
    });
    const prompt = topups[topups.length - 1] || '';
    assert(/struggling: make most of them EASY/.test(prompt), 'the top-up asks for easier questions after misses');
    assert(/recently missed: .*they answered/.test(prompt), 'the top-up names a recent miss and the wrong answer');
    assert(/never "all of the above"/.test(prompt), 'the top-up states the distractor rule');
    const qs = tp.buf.map(b => b.q);
    assert(qs.indexOf('Which vessel has the thinnest wall of all?') === -1, 'a keyless top-up mcq is dropped');
    const ch = tp.buf.find(b => /whole body/.test(b.q));
    assert(ch && ch.o.indexOf('All of the above') === -1 && ch.o[ch.k] === 'Left ventricle', '"All of the above" removed, key still right');
    const pv = tp.buf.find(b => /pulmonary/.test(b.q));
    assert(pv && pv.o[pv.k] === 'Oxygen-rich blood', 'shuffled options keep their key');
    assert(tp.pick === 'Easy' && tp.pickHard === 'Hard', 'the next buffered question follows the level (' + tp.pick + ', ' + tp.pickHard + ')');
    assert(prompt.length < 12000, 'top-up prompt stays small (' + prompt.length + ' chars)');
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nREVIEW QUEUE OK');
})();

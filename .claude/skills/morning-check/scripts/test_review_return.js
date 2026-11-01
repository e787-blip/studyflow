// The end of a review, and coming back (Oct 2026), on real page loads of
// lesson.html. The owner: after the review "it shows that you have finished
// the review part, and then it gets back to the actual lesson (so they know
// that they're not just repeating)".
//  - the day-start review AND the mixed review (every third day) each end on
//    a done card, before anything new; the done card says how the review
//    went and names today's lesson;
//  - the mixed review never re-asks a question the day-start review asked;
//  - a review finished, then the page left and opened again: no review, and
//    the welcome card says it is already done; a different plan still gets
//    its own review.
// Fails on the code before: no interleave-done card existed, the mixed
// review repeated yesterday's misses, and reopening rebuilt the review.
const h = require('./harness');
const fx = require('./fixture');
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const NONE = { json: { result: '{"type":"none"}' } };

function mcq(text, k) {
  return { type: 'mcq', question: text, options: ['Right answer', 'Wrong one', 'Also wrong', 'Not this'], correctIndex: k || 0,
           explanation: 'Because.', difficulty: 'medium' };
}
function fourDayPlan(id) {
  const p = JSON.parse(JSON.stringify(fx.plan));
  p.id = id;
  const base = p.days[0];
  for (let d = 1; d < 4; d++) {
    const nd = JSON.parse(JSON.stringify(base));
    nd.day = d + 1; nd.title = ['Arteries and veins', 'Blood and the lungs', 'The heart at work'][d - 1];
    nd.questions = nd.questions.map((q, i) => Object.assign({}, q, { question: 'Day ' + (d + 1) + ': ' + (q.question || ('q' + i)) }));
    p.days.push(nd);
  }
  return p;
}
const A = mcq('Review A: which side of the heart pumps to the lungs?');
const B = mcq('Review B: which vessels have valves?');
const C = mcq('Review C: how thick is a capillary wall?');
const seed = { studyflow_missed_day_2: [A, B], studyflow_missed_day_0: [A, C] };

async function shape(page) {
  return page.evaluate(() => sessionCards.map(c => c.type + (c.isReview ? ':R:' + (c.q && c.q.question || '').slice(0, 8) : '')));
}

(async () => {
  const plan = fourDayPlan('rr1');
  const { page, browser, errors } = await h.open({ plan, day: 3, seed, mock: async () => NONE });

  // ── 1. the queue: two blocks, each closed, no repeats ───────────────────
  const s = await shape(page);
  console.log('\n## queue: ' + s.slice(0, 16).join(' > '));
  const ri = s.indexOf('review-intro'), rd = s.indexOf('review-done');
  const ii = s.indexOf('interleave-intro'), id = s.indexOf('interleave-done');
  const welcome = s.indexOf('welcome');
  assert(ri === 0 && rd === 3, 'day-start review: intro, two questions, done card (' + ri + ', ' + rd + ')');
  assert(rd < welcome, 'its done card comes before today\'s lesson');
  assert(ii > welcome && id > ii, 'the mixed review has an intro and a done card (' + ii + ', ' + id + ')');
  const mixed = s.slice(ii + 1, id);
  assert(mixed.length === 1 && /Review C/.test(mixed[0]), 'the mixed review holds only what the day review did not ask (' + mixed.join(',') + ')');
  assert(s.slice(ii + 1, id).every(t => /:R:/.test(t)), 'nothing new inside the mixed review block');
  const reviewAs = s.filter(t => /:R:Review A/.test(t)).length;
  assert(reviewAs === 1, 'yesterday\'s miss is asked once, not twice (' + reviewAs + ')');

  // ── 2. walk the day review through the real card path ──────────────────
  const done = await page.evaluate(() => {
    // the intro is on screen (init showed it); answer the two: one right, one wrong
    const introShown = currentCard && currentCard.type === 'review-intro';
    showNextCard();                  // review A
    correctCount++; totalAnswered++;
    showNextCard();                  // review B
    totalAnswered++;
    showNextCard();                  // the done card
    const el = document.getElementById('session-card');
    const text = el ? el.innerText : '';
    const btn = [].slice.call(el.querySelectorAll('button')).pop();
    return { introShown, type: currentCard && currentCard.type, text, btn: btn ? btn.innerText : '',
             key: localStorage.getItem('sfu:' + JSON.parse(localStorage.getItem('studyflow_user')).email + '|studyflow_reviewed') };
  });
  console.log('## done card: ' + JSON.stringify(done.text.replace(/\s+/g, ' ').slice(0, 300)));
  assert(done.introShown, 'the session opens on the review intro');
  assert(done.type === 'review-done', 'after the review comes the done card');
  assert(/Review finished/.test(done.text), 'it says the review is finished');
  assert(/1 of 2 right/.test(done.text), 'it says how the review went (1 of 2 right)');
  assert(/come back in a later session/.test(done.text), 'it says the missed one comes back');
  assert(/Everything from here is new/.test(done.text), 'it says what follows is new');
  assert(/Day 4/.test(done.text) && /heart at work/i.test(done.text), 'it names today\'s lesson');
  assert(/Start today.s lesson/.test(done.btn), 'its button starts today\'s lesson (' + done.btn + ')');
  assert(done.key === 'rr1|3', 'the finished review is remembered (' + done.key + ')');
  const next = await page.evaluate(() => { showNextCard(); return currentCard && currentCard.type; });
  assert(next === 'welcome', 'and the next card is today\'s welcome (' + next + ')');

  // a re-render does not recount
  const again = await page.evaluate(() => {
    const c = sessionCards.find(x => x.type === 'review-done');
    correctCount += 5; totalAnswered += 5;
    const t = sfReviewDoneCard(c);
    return /1 of 2 right/.test(t);
  });
  assert(again, 'rendering the done card again does not recount');

  // the mixed review's done card
  const mix = await page.evaluate(() => {
    const c = sessionCards.find(x => x.type === 'interleave-done');
    const intro = sessionCards.find(x => x.type === 'interleave-intro');
    sfReviewStart(intro.block);
    correctCount++; totalAnswered++;
    const box = document.createElement('div'); box.innerHTML = sfReviewDoneCard(c);
    const b = [].slice.call(box.querySelectorAll('button')).pop();
    return { text: box.textContent, btn: b ? b.textContent : '' };
  });
  assert(/Mixed review finished/.test(mix.text) && /1 of 1 right/.test(mix.text) && /All of them right/.test(mix.text),
         'the mixed review ends on its own done card, with its own score');
  assert(/Back to today/.test(mix.text) && /Back to today.s questions/.test(mix.btn), 'and says it goes back to today');

  // ── 3. leave, come back: no review again ───────────────────────────────
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'lesson.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const back = await page.evaluate(() => ({
    types: sessionCards.map(c => c.type),
    reviews: sessionCards.filter(c => c.isReview && !c.isDue).length,
    first: currentCard && currentCard.type,
    note: (document.getElementById('session-card') || {}).innerText || ''
  }));
  console.log('## back: ' + back.types.slice(0, 6).join(' > '));
  assert(back.types.indexOf('review-intro') === -1 && back.types.indexOf('interleave-intro') === -1, 'coming back: no review is asked again');
  assert(back.reviews === 0, 'coming back: no review question either');
  assert(back.first === 'welcome', 'coming back opens on today\'s welcome (' + back.first + ')');
  assert(/review is already done/.test(back.note), 'the welcome says the review is already done');

  // a different plan on the same day number still gets its review
  const other = await page.evaluate(() => {
    plan.id = 'another-plan'; sessionCards = []; buildQueue();
    return sessionCards.map(c => c.type).indexOf('review-intro');
  });
  assert(other === 0, 'a different plan still gets its own review');

  // a fresh session never shows the note
  const fresh = await page.evaluate(() => {
    const ns = 'sfu:' + JSON.parse(localStorage.getItem('studyflow_user')).email + '|';
    localStorage.removeItem(ns + 'studyflow_reviewed');
    plan.id = 'rr1'; sessionCards = []; buildQueue();
    const w = sessionCards.find(c => c.type === 'welcome');
    return !!(w && w.reviewedEarlier);
  });
  assert(fresh === false, 'a session with its review still to do shows no "already done" note');

  // assignment mode never skips or records
  const asg = await page.evaluate(() => {
    const ns = 'sfu:' + JSON.parse(localStorage.getItem('studyflow_user')).email + '|';
    localStorage.setItem(ns + 'studyflow_reviewed', 'rr1|3');
    assignMode = true; const r = sfReviewedToday(); assignMode = false; return r;
  });
  assert(asg === false, 'an assignment never reads the review flag');

  assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nREVIEW RETURN OK');
})();

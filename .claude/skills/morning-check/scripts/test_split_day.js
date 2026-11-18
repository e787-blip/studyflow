// A day is TWO calls (lesson, then questions) so neither runs into the server's
// 55s: the retry only repeats the half that failed, and a half that timed out
// is asked again SHORT. Plan builder against a faked api/generate.
const { chromium } = require('./pw');
const fx = require('./fixture');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const BASE = process.env.SF_BASE || 'http://localhost:8765/';
const kind = p => /THIS CALL WRITES THE LESSON ONLY/.test(p) ? 'lesson' : /THIS CALL WRITES THE QUESTIONS ONLY/.test(p) ? 'qs' : 'other';

async function run(label, plan, loops) {                 // plan(kind, n) -> {status?, body?} for the n-th call of that kind
  const b = await chromium.launch(); const ctx = await b.newContext({ ignoreHTTPSErrors: true }); await require('./fontroute')(ctx);
  const page = await ctx.newPage(); const errors = []; const calls = []; const count = { lesson: 0, qs: 0, other: 0 };
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/generate', async r => {
    const p = JSON.parse(r.request().postData()).prompt; const k = kind(p); count[k]++; calls.push({ k, p });
    const day = JSON.parse(JSON.stringify(fx.plan.days[0])); delete day.completed;
    const o = k === 'other' ? { body: { result: JSON.stringify(day) } } : plan(k, count[k], day);
    if (o.status && o.status !== 200) return r.fulfill({ status: o.status, contentType: 'application/json', body: JSON.stringify({ error: 'x' }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.body) });
  });
  await page.goto(BASE + 'favicon.png');
  await page.evaluate((u) => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify(u)); localStorage.setItem('studyflow_onboarded', '1'); }, fx.user);
  await page.goto(BASE + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    const n = document.getElementById('notes-input'); if (n) n.value = 'The heart pumps blood through arteries and veins. Veins have valves. Capillaries are thin.';
    const s = document.getElementById('subject-input'); if (s) s.value = 'Biology: the heart';
    const d = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    startGeneration(n.value, 1, d, 'vip');
  });
  for (let i = 0; i < (loops || 200) && !/dashboard/.test(page.url()); i++) await page.waitForTimeout(250);
  const saved = await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('studyflow_user')); return JSON.parse(localStorage.getItem('sfu:' + u.email + '|studyflow_plan') || 'null'); });
  console.log('[' + label + '] lesson calls=' + count.lesson + ' question calls=' + count.qs + ' saved=' + !!(saved && saved.days.length));
  await b.close();
  return { calls, count, saved, errors };
}
const full = (day) => ({ body: { result: JSON.stringify(day) } });
const qsOnly = (day, n) => ({ body: { result: JSON.stringify({ questions: day.questions.slice(0, n || day.questions.length) }) } });

(async () => {
  const want = fx.plan.days[0];
  // A. clean day: one lesson call, one questions call, merged
  const a = await run('clean', (k, n, day) => k === 'lesson' ? full(day) : qsOnly(day));
  assert(a.count.lesson === 1 && a.count.qs === 1, 'a clean day is exactly two calls (lesson, questions)');
  const ap = a.calls.filter(c => c.k === 'lesson')[0].p, aq = a.calls.filter(c => c.k === 'qs')[0].p;
  assert(!/"questions":\[\{/.test(ap), 'the lesson call does not ask for any questions');
  assert(aq.indexOf(want.title) > -1 && /ALREADY WRITTEN/.test(aq), 'the questions call is shown the lesson that was written: ' + want.title);
  assert(/\{"questions":\[\{"type"/.test(aq) && !/"microTopic":"","briefing"/.test(aq.slice(aq.lastIndexOf('THIS CALL WRITES'))), 'the questions call asks for questions only');
  assert(a.calls.every(c => c.k === 'other' || c.p.length < 60000), 'every call fits the 60 000 character cap');
  assert(a.saved && a.saved.days[0].title === want.title && a.saved.days[0].questions.length >= 3 && a.saved.days[0].keyTerms.length > 0, 'the saved day has the lesson AND its questions');

  // B. the questions call times out once: only the questions are asked again, shorter
  const b = await run('questions time out', (k, n, day) => k === 'lesson' ? full(day) : (n === 1 ? { status: 504 } : qsOnly(day)));
  assert(b.count.lesson === 1 && b.count.qs === 2, 'a failed questions call is retried alone: lesson 1, questions 2 (' + b.count.lesson + ', ' + b.count.qs + ')');
  assert(/^LENGTH LIMIT/.test(b.calls.filter(c => c.k === 'qs')[1].p) && !/^LENGTH LIMIT/.test(b.calls.filter(c => c.k === 'qs')[0].p), 'the retry after a timeout asks for the questions SHORT');
  assert(b.saved && b.saved.days[0].questions.length >= 3, 'the day still saves');

  // C. the lesson call times out once: the lesson is asked again, short; questions asked once
  const c = await run('lesson times out', (k, n, day) => k === 'lesson' ? (n === 1 ? { status: 504 } : full(day)) : qsOnly(day));
  assert(c.count.lesson === 2 && c.count.qs === 1, 'a failed lesson call is retried, the questions asked once (' + c.count.lesson + ', ' + c.count.qs + ')');
  assert(/^LENGTH LIMIT/.test(c.calls.filter(x => x.k === 'lesson')[1].p), 'the lesson retry is SHORT');
  assert(c.saved && c.saved.days[0].title === want.title, 'the day still saves');

  // D. a reply that is not a lesson (repairJSON\'s made-up "Study Session") is asked for again
  const d = await run('junk lesson', (k, n, day) => k === 'lesson' ? (n === 1 ? { body: { result: '{"title":"Study Session"}' } } : full(day)) : qsOnly(day));
  assert(d.count.lesson === 2 && d.count.qs === 1, 'a reply with no lesson in it is not accepted as one (' + d.count.lesson + ', ' + d.count.qs + ')');
  assert(d.saved && d.saved.days[0].title === want.title, 'and the real lesson is what is saved, not "Study Session"');

  // E. one question back is not a day: the questions are asked again, the lesson is not
  const e = await run('too few questions', (k, n, day) => k === 'lesson' ? full(day) : qsOnly(day, n === 1 ? 1 : undefined));
  assert(e.count.lesson === 1 && e.count.qs === 2, 'too few questions asks for the questions again, keeping the lesson (' + e.count.lesson + ', ' + e.count.qs + ')');
  assert(e.saved && e.saved.days[0].questions.length >= 3, 'and saves the full set');

  // F. a daily limit stops at once, with no retries
  const f = await run('daily limit', () => ({ status: 429 }), 48);
  assert(f.count.lesson === 1 && f.count.qs === 0, 'a daily limit is not retried (' + f.count.lesson + ', ' + f.count.qs + ')');

  assert([a, b, c, d, e, f].every(r => r.errors.length === 0), 'no page errors ' + [a, b, c, d, e, f].map(r => r.errors.join('|')).join(' '));
  console.log(fails ? fails + ' FAILED' : 'SPLIT DAY OK');
})();

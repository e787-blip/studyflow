// Question VERSIONS (sf-questions.js): every non-maths day's questions call names an
// angle for each question slot, rotated by day, numbered like the schema the model
// is handed. The lesson call and maths days carry none. Plan builder, faked api/generate.
const { chromium } = require('./pw');
const fx = require('./fixture');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const BASE = process.env.SF_BASE || 'http://localhost:8765/';
const QS = /THIS CALL WRITES THE QUESTIONS ONLY/;

async function prompts(subject, notes, days) {
  const b = await chromium.launch(); const ctx = await b.newContext({ ignoreHTTPSErrors: true }); await require('./fontroute')(ctx);
  const page = await ctx.newPage(); const errors = []; const calls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/generate', async r => {
    const p = JSON.parse(r.request().postData()).prompt; calls.push(p);
    const day = JSON.parse(JSON.stringify(fx.plan.days[0])); delete day.completed;
    const body = QS.test(p) ? { result: JSON.stringify({ questions: day.questions }) } : { result: JSON.stringify(day) };
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(BASE + 'favicon.png');
  await page.evaluate((u) => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify(u)); localStorage.setItem('studyflow_onboarded', '1'); }, fx.user);
  await page.goto(BASE + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.SFQuestions && typeof startGeneration === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate((a) => {
    selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    const n = document.getElementById('notes-input'); if (n) n.value = a.notes;
    const s = document.getElementById('subject-input'); if (s) s.value = a.subject;
    const d = new Date(Date.now() + a.days * 86400000).toISOString().slice(0, 10);
    startGeneration(a.notes, a.days, d, 'vip');
  }, { subject, notes, days });
  for (let i = 0; i < 240 && !/dashboard/.test(page.url()); i++) await page.waitForTimeout(250);
  await b.close();
  return { all: calls, qs: calls.filter(p => QS.test(p)), lesson: calls.filter(p => /THIS CALL WRITES THE LESSON ONLY/.test(p)), errors };
}
const lines = p => (p.match(/^Question \d+ \([a-z]+\) - .+$/gm) || []);
const schemaTypes = p => { const s = p.slice(p.lastIndexOf('{"questions":[')); return (s.match(/\{"type":"([a-z]+)"/g) || []).map(x => x.slice(9, -1)); };

(async () => {
  for (const c of [['Biology: the heart', 'The heart pumps blood through arteries and veins. Veins have valves. Capillaries are thin.'],
                   ['History: the French Revolution', 'In 1789 the French Revolution began. Bread prices rose. The Bastille was stormed. The monarchy fell.'],
                   ['Spanish 1: present tense', 'Yo hablo. Tu hablas. Nosotros hablamos. The present tense of -ar verbs.']]) {
    const r = await prompts(c[0], c[1], 2);
    assert(r.qs.length >= 2, c[0] + ': two days asked for questions (' + r.qs.length + ')');
    if (r.qs.length < 2) continue;
    const p = r.qs[0], got = lines(p), types = schemaTypes(p);
    assert(/\nVERSIONS - /.test(p) && got.length >= 3, c[0] + ': the questions call names angles (' + got.length + ' questions)');
    assert(p.indexOf('VERSIONS - ') < p.indexOf('THIS CALL WRITES THE QUESTIONS ONLY'), c[0] + ': the angles come before the output shape');
    assert(got.every(l => { const m = /^Question (\d+) \(([a-z]+)\)/.exec(l); return types[m[1] - 1] === m[2]; }), c[0] + ': every numbered angle names the type at that place in the schema [' + types.join(' ') + ']');
    assert(r.qs.every(x => x.length < 60000 && /\{"questions":\[\{"type"/.test(x) && /\]\}\s*$/.test(x)), c[0] + ': under the cap, with the schema still at the end');
    assert(lines(r.qs[0]).join() !== lines(r.qs[1]).join(), c[0] + ': day 2 gets different angles from day 1');
    assert(r.lesson.every(x => !/\nVERSIONS - /.test(x)), c[0] + ': the lesson call carries none');
    assert(!r.errors.length, c[0] + ': no page errors ' + r.errors.join(' | '));
  }
  const m = await prompts('Algebra: solving equations', 'Solve for x: 2x + 3 = 11. Subtract 3 then divide by 2. Linear equations.', 1);
  assert(m.qs.length >= 1 && m.qs.every(x => !/\nVERSIONS - /.test(x)), 'maths days carry no angles (their variety is code)');
  console.log(fails ? fails + ' FAILED' : 'VERSIONS OK');
})();

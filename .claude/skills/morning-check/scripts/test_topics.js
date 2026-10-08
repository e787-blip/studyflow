// The subtopic skill (sf-topics.js) on a real page load of app.html, with
// api/generate mocked: the one map call before the days, what each day's
// prompt carries, what the plan saves, and every way the call can fail.
const { chromium } = require('./pw');
const fx = require('./fixture');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const MAP = /^Map the study notes/;

const MUSIC_NOTES = 'Intervals are the distance between two notes, counted in half steps. A major third is four half steps, a minor third three, a perfect fifth seven. ' +
  'Triads stack two thirds: root, third and fifth. A major triad has a major third below a minor third. ' +
  'Time signatures: 4/4 means four quarter-note beats per measure, 3/4 three.';
const MUSIC_MAP = { subject: 'Intervals, triads and time signatures', field: 'Music', family: 'general', tip: 'Name the interval or chord, then spell an example from a real note.',
  subtopics: [
    { name: 'Intervals', parent: 'Harmony', covers: ['half steps', 'major and minor thirds', 'perfect fifth'], kind: 'procedure', material: ['calculation', 'categories'], like: '', ask: 'Count the half steps between two named notes and name the interval', avoid: 'Defining interval with no notes to measure', picture: 'drawing' },
    { name: 'Triads', parent: 'Harmony', covers: ['root, third, fifth', 'major against minor'], kind: 'mechanism', material: ['parts', 'categories'], like: '', ask: 'Build a triad on a given root', avoid: 'Naming triad types with no notes', picture: 'parts' },
    { name: 'Time signatures', parent: 'Rhythm', covers: ['4/4', 'beats per measure'], kind: 'facts', material: ['numbers'], like: '', ask: '', avoid: '', picture: 'concept' }] };

async function run(o) {
  const b = await chromium.launch(); const ctx = await b.newContext({ ignoreHTTPSErrors: true }); await require('./fontroute')(ctx);
  const page = await ctx.newPage(); const errors = []; const calls = []; const times = [];
  page.on('pageerror', e => errors.push(e.message));
  const t0 = Date.now();
  await page.route('**/api/generate', async r => {
    const p = JSON.parse(r.request().postData()).prompt; calls.push(p); times.push(Date.now());
    if (MAP.test(p)) {
      const a = o.map();
      if (a.abort) return r.abort();
      if (a.delay) await new Promise(x => setTimeout(x, a.delay));
      return r.fulfill({ status: a.status || 200, contentType: 'application/json', body: JSON.stringify(a.json) }).catch(() => {});
    }
    if (/^Draw ONE illustration/.test(p)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
    const d = JSON.parse(JSON.stringify(fx.plan.days[0])); delete d.completed;
    /* Slow enough that the build screen is still up to be read. */
    if (o.dayDelay) await new Promise(x => setTimeout(x, o.dayDelay));
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(d) }) });
  });
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
  await page.evaluate((u) => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify(u)); localStorage.setItem('studyflow_onboarded', '1'); }, Object.assign({}, fx.user, { tier: 'vip' }));
  if (o.block) await page.route('**/sf-topics.js', r => r.abort());
  await page.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate(({ notes, subject, days, focus }) => {
    selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    if (focus) { intake.grade = '11'; intake.focus = focus; }
    const n = document.getElementById('notes-input'); if (n) n.value = notes;
    const s = document.getElementById('subject-input'); if (s) s.value = subject;
    const d = new Date(Date.now() + days * 86400000);
    startGeneration(notes, days, d.toISOString().slice(0, 10), 'vip');
  }, { notes: o.notes, subject: o.subject, days: o.days, focus: o.focus || '' });
  let covers = '', coversHtml = '';
  for (let i = 0; i < 160 && !/dashboard/.test(page.url()); i++) {
    try {
      const c = await page.evaluate(() => { const el = document.getElementById('build-covers'); return el && !el.hidden ? [el.textContent, el.innerHTML] : null; });
      if (c) { covers = c[0]; coversHtml = c[1]; }
    } catch (e) {}
    await page.waitForTimeout(250);
  }
  const plan = await page.evaluate(() => { try { const u = JSON.parse(localStorage.getItem('studyflow_user')); return JSON.parse(localStorage.getItem('sfu:' + u.email + '|studyflow_plan') || 'null'); } catch (e) { return null; } });
  await b.close();
  const maps = calls.filter(c => MAP.test(c)), days = calls.filter(c => !MAP.test(c) && !/^Draw ONE illustration/.test(c));
  const firstDay = calls.findIndex(c => !MAP.test(c) && !/^Draw ONE/.test(c));
  return { calls, maps, days, plan, errors, covers, coversHtml, reached: !!plan,
           mapToFirstDay: firstDay >= 0 ? (times[firstDay] - t0) / 1000 : -1 };
}

(async () => {
  // A. A subject the app has no list for.
  const a = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 3, dayDelay: 1500, map: () => ({ json: { result: JSON.stringify(MUSIC_MAP) } }) });
  assert(a.reached && a.errors.length === 0, '[music] plan saved, no page errors ' + a.errors.join('|'));
  assert(a.maps.length === 1 && MAP.test(a.calls[0]), '[music] exactly one map call, and it comes before any day');
  assert(a.maps[0].indexOf('Intervals are the distance') >= 0 && /PLAN LENGTH: 3 days/.test(a.maps[0]) && /science\/life \(Life science\)/.test(a.maps[0]), '[music] the map prompt carries the notes, the plan length and the premade shapes');
  const parts = ['Intervals (part of Harmony)', 'Triads (part of Harmony)', 'Time signatures (part of Rhythm)'];
  assert(a.days.length === 3 && a.days.every((d, i) => d.indexOf("TODAY'S PART OF THE NOTES: " + parts[i]) >= 0), '[music] day N is told its own part, in teaching order');
  assert(/It is also the last day/.test(a.days[2]) && !/It is also the last day/.test(a.days[0]), '[music] the last day, still in its first pass, keeps its part and connects it to the rest');
  assert(/MUSIC — INTERVALS: .*Trace table/.test(a.days[0]) && /MUSIC — TRIADS: .*Label the diagram/.test(a.days[1]), '[music] each day\'s quota is its own part\'s mix');
  assert(a.days.every(d => /a study day for a Music student/.test(d) && /knows no MUSIC at all/.test(d) && !/knows no GENERAL/.test(d)), '[music] the prompt names the field, not "General"');
  assert(/This part is a METHOD/.test(a.days[0]) && !/AT LEAST 3 "mcq" on the central claims/.test(a.days[0]), '[music] the part\'s own mandate replaces the subject-wide one');
  const p = a.plan || { days: [] };
  assert(p.topics && p.topics.field === 'Music' && p.topics.subtopics.length === 3 && p.subjectType === 'general', '[music] the plan saves the map; the family stays general');
  assert(p.days[0] && p.days[0].subtopic && p.days[0].subtopic.name === 'Intervals' && /Count the half steps/.test(p.days[0].subtopic.guide), '[music] each day carries its part and guide for the top-up');
  assert(p.days[0] && p.days[0].allowedTypes.indexOf('tracetable') >= 0 && p.days[0].allowedTypes.indexOf('errorspot') >= 0 &&
         p.days[1].allowedTypes.indexOf('labeldiagram') >= 0 && p.days.every(d => d.allowedTypes.indexOf('wordproblem') < 0 && d.allowedTypes.indexOf('bigequation') < 0),
         '[music] the palette admits the day\'s own formats, and never a word problem or equation');
  assert(a.covers === 'Your notes cover: Intervals · Triads · Time signatures', '[music] the build screen says what the notes cover: "' + a.covers + '"');

  // B. "general" upgraded to the family the model names.
  const b = await run({ notes: 'Stars form in nebulae. Main sequence stars fuse hydrogen into helium. A red giant expands when core hydrogen runs out. Massive stars end as supernovae.', subject: 'Astronomy', days: 2,
    map: () => ({ json: { result: JSON.stringify({ subject: 'The life cycle of stars', field: 'Astronomy', family: 'science', subtopics: [{ name: 'Star formation', parent: 'Stellar evolution', kind: 'mechanism', material: ['order'] }, { name: 'How stars die', parent: 'Stellar evolution', kind: 'mechanism', material: ['order', 'categories'] }] }) } }) });
  assert(b.plan && b.plan.subjectType === 'science' && b.days.every(d => /a study day for a Science student/.test(d) && /knows no ASTRONOMY at all/.test(d)), '[astronomy] general -> science; the lock names the field');
  assert(b.plan && b.plan.days.every(d => d.allowedTypes.indexOf('labeldiagram') >= 0 && d.allowedTypes.indexOf('sequence') >= 0), '[astronomy] days carry the science palette');

  // C. The model may not turn a subject into maths.
  const c = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 1, map: () => ({ json: { result: JSON.stringify(Object.assign({}, MUSIC_MAP, { family: 'math' })) } }) });
  assert(c.plan && c.plan.subjectType === 'general' && c.plan.topics && c.plan.topics.subtopics.length === 1 && !/TODAY'S PART/.test(c.days[0]), '[math claim] stays general; a 1-day plan merges every part into one, with no focus line');

  // D-F. Every way the map can fail leaves the plan exactly as before.
  const oldShape = d => /QUESTIONS: 3 MCQ, 2 True\/False, 2 Fill, 1 Write\./.test(d) && !/TODAY'S PART/.test(d) && /knows no GENERAL/.test(d);
  const dd = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 2, map: () => ({ abort: true }) });
  assert(dd.reached && !dd.plan.topics && dd.days.length === 2 && dd.days.every(oldShape) && dd.errors.length === 0, '[network failure] plan saved the old way, nothing stored');
  const e = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 2, map: () => ({ json: { result: '{"title":"A day","questions":[]}' } }) });
  assert(e.reached && !e.plan.topics && e.days.every(oldShape), '[not a map] refused by the judge, plan saved the old way');
  const e2 = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 2, map: () => ({ status: 502, json: { error: 'AI service error: 529' } }) });
  assert(e2.reached && !e2.plan.topics && e2.days.every(oldShape), '[502] plan saved the old way');
  const f = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 2, map: () => ({ delay: 30000, json: { result: JSON.stringify(MUSIC_MAP) } }) });
  assert(f.reached && !f.plan.topics && f.days.every(oldShape) && f.mapToFirstDay > 18 && f.mapToFirstDay < 24, '[slow] abandoned at the cap (first day after ' + f.mapToFirstDay + 's); the late reply changes nothing');
  const g = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 2, block: true, map: () => ({ json: { result: JSON.stringify(MUSIC_MAP) } }) });
  assert(g.reached && g.maps.length === 0 && !g.plan.topics && g.errors.length === 0, '[sf-topics.js missing] no call, plan saved the old way');

  // G. Hostile names reach the screen as text.
  const h = await run({ notes: MUSIC_NOTES, subject: 'Music theory', days: 3, dayDelay: 1500, map: () => ({ json: { result: JSON.stringify({ field: 'Music', subtopics: [
    { name: '<img src=x onerror="window.__pwned=1">Hack' }, { name: '<script>window.__pwned=1</script>Two' }, { name: 'Three', covers: ['<b>x</b>'] }] }) } }) });
  assert(h.reached && /^Your notes cover: .*Hack/.test(h.covers) && h.coversHtml.replace(/^<b>Your notes cover: <\/b>/, '').indexOf('<') < 0 && JSON.stringify(h.plan.topics).indexOf('<') < 0 && h.errors.length === 0, '[hostile] markup never reaches the build screen or the plan');

  // H. Maths never asks.
  const m = await run({ notes: 'Solve equations by isolating the variable. 2x + 3 = 11, subtract 3 from both sides, divide by 2, x = 4. Simplify expressions by combining like terms.', subject: 'Algebra: solving equations', days: 2, map: () => ({ json: { result: JSON.stringify(MUSIC_MAP) } }) });
  assert(m.reached && m.maps.length === 0 && !m.plan.topics && m.plan.subjectType === 'math', '[maths] no map call; maths keeps its own mix');

  // I. The prompt budget, with every part of the day prompt at its longest.
  const big = await run({ notes: (MUSIC_NOTES + ' ').repeat(120), subject: 'Music theory: harmony and rhythm for the AP exam', days: 3, focus: 'I keep mixing up '.repeat(30),
    map: () => ({ json: { result: JSON.stringify({ field: 'Music', family: 'general', subtopics: [0, 1, 2].map(i => ({ name: 'Part number ' + i + ' of the harmony notes', parent: 'Harmony and voice leading', kind: 'procedure', like: 'cs/algorithms',
      material: Object.keys({ order: 1, dates: 1, parts: 1, numbers: 1, calculation: 1, procedure: 1, sources: 1, text: 1, categories: 1, cases: 1 }),
      covers: ['x'.repeat(44), 'y'.repeat(44), 'z'.repeat(44), 'w'.repeat(44), 'v'.repeat(44)], ask: 'a'.repeat(200), avoid: 'b'.repeat(200) })) }) } }) });
  const longest = Math.max.apply(null, big.days.map(d => d.length));
  assert(big.plan && big.plan.topics && longest < 50000 && /\]\}$/.test(big.days[0]), '[budget] longest day prompt ' + longest + ' chars with the map, 30k notes and a full brief - under 50k of the 60k cap, schema intact');

  // J. lesson.html: the top-up asks about the day's part, and the
  //    teach-it-back tip is the model's, escaped, on a general plan only.
  const hz = require('./harness');
  async function topUp(plan) {
    const env = await hz.open({ plan, mock: async () => ({ json: { result: '[]' } }) });
    const r = await env.page.evaluate(() => { generateMoreQuestions(); return { tip: getFeynmanTip(plan.subjectType), sci: getFeynmanTip('science') }; });
    await env.page.waitForTimeout(600);
    const prompt = env.calls.filter(c => /^TOPIC LOCK/.test(c)).pop() || '';
    await env.browser.close();
    return Object.assign(r, { prompt, errors: env.errors });
  }
  const gp = JSON.parse(JSON.stringify(fx.plan));
  gp.subject = 'Music theory'; gp.subjectType = 'general';
  gp.topics = { v: 1, field: 'Music', family: 'general', tip: '<img src=x onerror=1>Name the interval, then spell an example.', subtopics: [] };
  gp.days[0].subtopic = { key: 'intervals', name: 'Intervals', parent: 'Harmony', covers: ['half steps'], guide: 'ASK: Count the half steps between two named notes. AVOID: Defining interval.' };
  const j = await topUp(gp);
  assert(/\nPart of the course: Intervals, within Harmony\nWhat a good question on it does: ASK: Count the half steps/.test(j.prompt), '[top-up] carries the day\'s part and its guide');
  assert(j.tip === '&lt;img src=x onerror=1&gt;Name the interval, then spell an example.' && /^Describe the process/.test(j.sci), '[tip] a general plan gets the model\'s tip, escaped; a known family keeps its own');
  const k = await topUp(JSON.parse(JSON.stringify(fx.plan)));
  assert(k.prompt && !/Part of the course/.test(k.prompt) && /^Describe the process/.test(k.tip), '[old plan] no part line, the curated tip');
  assert(j.errors.length === 0 && k.errors.length === 0, '[lesson] no page errors ' + j.errors.concat(k.errors).join('|'));

  console.log(fails ? fails + ' FAILED' : 'TOPICS PAGE OK');
})();

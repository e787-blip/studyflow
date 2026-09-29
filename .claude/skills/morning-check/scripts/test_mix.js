// Every subject and subtopic: capture the REAL day prompt off the wire
// (api/generate mocked), read the question list off its JSON schema, and
// check that (1) each subtopic's mix is its own, (2) every type asked for is
// on the subject's palette - lesson.html drops anything that is not - and
// (3) no other quota in the prompt names a format the mix leaves out.
// Prints the percentage table. `node test_mix.js --json` prints raw data.
const { chromium } = require('./pw');
const fx = require('./fixture');
const BASE = process.env.SF_BASE || 'http://localhost:8765/';
const CASES = [
  ['math', '-', 'Algebra: solving linear equations', 'Solve for x in two-step equations. Isolate the variable by inverse operations.'],
  ['science', 'life', 'Biology: photosynthesis in plant cells', 'Chloroplasts in plant cells capture light. Photosynthesis makes glucose.'],
  ['science', 'physical', 'Physics: forces and motion', 'A force changes motion. Friction opposes motion. Gravity pulls objects down.'],
  ['science', 'earth', 'Earth science: rocks and the rock cycle', 'Igneous rock forms from magma. Erosion breaks rock into sediment. Fossils form in sedimentary rock.'],
  ['science', '(no match)', 'Science: lab safety rules', 'Wear goggles. Tie back hair. Report spills to the teacher right away.'],
  ['english', 'reading', 'English: reading comprehension and inference', 'Find the main idea of a passage. Make an inference from text evidence.'],
  ['english', 'grammar', 'English grammar: commas and run-on sentences', 'A comma splice joins two clauses with only a comma. Fix it with a period or a conjunction.'],
  ['english', 'literature', 'English: theme and symbolism in a novel', 'The theme is the message. A symbol stands for an idea. The protagonist changes.'],
  ['english', '(no match)', 'English: persuasive speeches', 'Ethos, pathos and logos are appeals a speaker uses to persuade an audience.'],
  ['history', 'civics', 'Civics: the Constitution and branches of government', 'Congress makes laws, the president enforces them, the courts interpret them.'],
  ['history', 'social', 'History: the Industrial Revolution and labor reform', 'Factories grew. Child labor and long hours led to reform movements.'],
  ['history', 'era', 'History: the fall of the Roman Empire', 'Rome fell in 476 AD after invasions, weak emperors and a split into east and west.'],
  ['geography', 'physical', 'Geography: rivers and landforms', 'Rivers erode valleys and build deltas. Glaciers carve mountains.'],
  ['geography', 'human', 'Geography: population and migration', 'Urban population density rises as people migrate to cities for work.'],
  ['geography', 'maps', 'Geography: latitude and longitude on maps', 'Latitude runs east-west, longitude north-south. Map scale shows distance.'],
  ['geography', '(no match)', 'Geography: famous landmarks', 'The Eiffel Tower, Machu Picchu and the Great Wall draw visitors.'],
  ['psychology', 'methods', 'Psychology: research methods and experiments', 'An experiment has an independent variable and a control group. Correlation is not causation.'],
  ['psychology', 'bioCog', 'Psychology: memory and the brain', 'Memory has encoding, storage and retrieval. Neurons fire across the cortex.'],
  ['psychology', 'social', 'Psychology: conformity and obedience', 'Social pressure causes conformity. Obedience to authority was studied by Milgram.'],
  ['psychology', '(no match)', 'Psychology: intro to the field', 'Psychologists study behaviour and mental processes.'],
  ['economics', 'personal', 'Personal finance: budgeting and saving', 'A budget tracks income and spending. Savings earn compound interest at the bank.'],
  ['economics', 'macro', 'Economics: inflation and unemployment', 'Inflation raises prices. Unemployment rises in a recession. GDP measures output.'],
  ['economics', 'micro', 'Economics: supply and demand', 'Price rises when demand rises. A shortage happens when demand exceeds supply.'],
  ['cs', 'programming', 'Computer science: Python loops and functions', 'A for loop repeats code. A function takes input and returns output. Debug syntax errors.'],
  ['cs', 'algorithms', 'Computer science: sorting algorithms', 'Bubble sort swaps neighbours. Binary search halves the list. Big-O measures cost.'],
  ['cs', 'systems', 'Computer science: how the internet works', 'Packets travel between routers. DNS turns names into addresses.'],
  ['language', 'grammar', 'Spanish: preterite verb conjugation', 'Conjugate regular -ar verbs in the preterite tense: hablé, hablaste, habló.'],
  ['language', 'reading', 'French: ordering food conversation', 'A dialogue at a café: greeting the waiter, ordering, asking for the bill.'],
  ['language', 'vocab', 'Spanish vocabulary: food words', 'la manzana, el pan, la leche, el queso, el pollo.'],
  ['general', 'study', 'Study skills: flashcards and revision habits', 'Spaced repetition and active recall beat rereading. Build a study habit.'],
  ['general', '(no match)', "Driver's ed: road signs", 'A red octagon means stop. A yellow triangle means yield.'],
];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext();
  const page = await ctx.newPage(); const errors = []; let prompt = null;
  page.on('pageerror', e => errors.push(e.message));
  /* Answer the day call with the fixture day so the plan really saves, and
     read allowedTypes off the SAVED day - that is what lesson.html filters by. */
  await page.route('**/api/generate', r => {
    const p = JSON.parse(r.request().postData()).prompt;
    if (/^Draw ONE/.test(p)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
    prompt = p;
    const d = JSON.parse(JSON.stringify(fx.plan.days[0])); delete d.completed;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(d) }) });
  });
  await page.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
  await page.goto(BASE + 'favicon.png');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ email: 'mix@t.com', tier: 'vip', grade: '7' })); });
  const rows = []; let fails = 0;
  const FAIL = m => { fails++; console.log('FAIL ' + m); };
  for (const [want, wantSub, subj, notes] of CASES) {
    /* A fresh page per case: a retry from the last case's generation would
       otherwise land in this one. */
    await page.goto(BASE + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    prompt = null;
    const info = await page.evaluate(([subj, notes]) => {
      const st = classifySubject(subj, notes);
      const strat = getSubjectStrategy(st, subj, notes);
      window.SFStore.removeItem('studyflow_plans'); window.SFStore.removeItem('studyflow_plan');
      document.getElementById('subject-input').value = subj;
      selectedGoal = 'exam'; selectedDifficulty = 'Medium';
      const d = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      try { startGeneration(notes, 1, d, 'vip'); } catch (e) { return { err: String(e) }; }
      return { st, sub: strat.subtopic ? strat.subtopic.key : '(no match)' };
    }, [subj, notes]);
    let saved = null;
    for (let i = 0; i < 100 && !saved; i++) {
      await page.waitForTimeout(150);
      saved = await page.evaluate(() => { try { const u = JSON.parse(localStorage.getItem('studyflow_user')); const p = JSON.parse(localStorage.getItem('sfu:' + u.email + '|studyflow_plan') || 'null'); return p && p.days && p.days[0] ? p.days[0].allowedTypes : null; } catch (e) { return null; } }).catch(() => null);
    }
    if (!saved) { FAIL(subj + ': plan never saved'); continue; }
    info.palette = saved;
    if (info.err || !prompt) { FAIL(subj + ': no prompt captured ' + (info.err || '')); continue; }
    const schema = prompt.slice(prompt.indexOf('"completed":false,"questions":['));
    const types = [...schema.matchAll(/\{"type":"(\w+)"(?:,"questionType":"([\w-]+)")?/g)].map(m => m[1]);
    const counts = {}; types.forEach(t => counts[t] = (counts[t] || 0) + 1);
    const off = Object.keys(counts).filter(t => !info.palette.includes(t));
    /* The quota section, stripped of the mix's own line, must not demand a
       format the mix does not contain. */
    const qs = prompt.indexOf('QUESTION FORMAT IS NOT OPTIONAL'), qe = prompt.indexOf('WHAT A GOOD QUESTION', qs);
    const quota = qs > 0 ? prompt.slice(qs, qe) : '';
    const demanded = [...quota.matchAll(/"(\w+)"/g)].map(m => m[1]).filter(t => /^(mcq|truefalse|fill|write|classify|sequence|sentence|passage|errorspot|scenario|wordproblem|bigequation|twopart|corroborate|highlight|tracetable|matchpairs|estimate|readingset|labeldiagram)$/.test(t));
    /* Maths's quota names formats to AVOID ("ZERO fill"), so it is not read this way. */
    const contra = want === 'math' ? [] : [...new Set(demanded.filter(t => !counts[t]))];
    if (info.st !== want) FAIL(subj + ': classified ' + info.st + ', expected ' + want);
    if (wantSub !== '-' && info.sub !== wantSub) FAIL(subj + ': subtopic ' + info.sub + ', expected ' + wantSub);
    if (off.length) FAIL(`${want}/${info.sub}: asks for ${off.join(', ')}, which lesson.html drops (not on the saved day's allowedTypes)`);
    if (contra.length) FAIL(`${want}/${info.sub}: the prompt's quota demands ${contra.join(', ')}, which the mix does not contain`);
    rows.push({ subject: info.st, sub: want === 'math' ? '-' : info.sub, total: types.length, counts });
  }
  // Every subtopic's mix must be its own.
  const seen = {};
  rows.forEach(r => { const k = Object.keys(r.counts).sort().map(t => t + r.counts[t]).join(','); if (seen[k]) FAIL(`${r.subject}/${r.sub} has the same mix as ${seen[k]}`); else seen[k] = r.subject + '/' + r.sub; });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
  else rows.forEach(r => console.log(`${r.subject}/${r.sub} (${r.total}): ` + Object.entries(r.counts).sort((a, c) => c[1] - a[1]).map(([t, n]) => `${t} ${Math.round(100 * n / r.total)}%`).join(', ')));
  if (errors.length) console.log('pageerror ' + errors.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'MIX OK');
  await b.close();
})();

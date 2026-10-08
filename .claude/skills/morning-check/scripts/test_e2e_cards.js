// End to end, the way a learner gets there: the real plan builder makes a
// plan - api/generate answered by filling in EXACTLY the question list each
// day's prompt asks for, after the notes-map call (sf-topics.js) - and then
// the real lesson page runs every day of it, card by card.
//
// Written because every piece passed its own test while the whole did not:
// a history day the map built without a premade shape asked for none of the
// three history cards, and a composed language day lost its dictation.
//   node test_e2e_cards.js            (needs the suite's local server)
const { chromium } = require('./pw');
const BASE = process.env.SF_BASE || 'http://localhost:8765/';
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

function put(right, wrongs, i) { const o = wrongs.slice(0, 3); o.splice(i, 0, right); return o; }

const H = {
  subject: 'History: the French Revolution', days: 3,
  notes: 'The French Revolution began in 1789. France was split into three estates: the clergy, the nobility and the Third Estate, about 97% of the people, who paid most of the taxes. ' +
    'The king called the Estates-General in May 1789 because the government was bankrupt. The Third Estate declared itself the National Assembly and swore the Tennis Court Oath. ' +
    'On 14 July 1789 crowds stormed the Bastille. In August the Assembly issued the Declaration of the Rights of Man and of the Citizen. ' +
    'Arthur Young, an English traveller, wrote in 1787 about hungry peasants. Edmund Burke attacked the Revolution in 1790; Thomas Paine defended it in 1791. ' +
    'By 1793 the king had been executed and the Terror began. Some things changed - feudal dues ended, the Church lost its land - and some stayed the same: most people were still farmers.',
  day: (n) => ({ title: ['Causes of the French Revolution', 'The Revolution of 1789', 'From monarchy to republic'][n % 3],
    content: 'In 1789 France was bankrupt and divided into three estates. The Third Estate, most of the people, paid most of the taxes and had the least say.',
    steps: [{ action: 'The government runs out of money', why: 'Wars and debt' }, { action: 'The king calls the Estates-General', why: 'To raise taxes' }, { action: 'The Third Estate forms the National Assembly', why: 'It wanted a vote by head' }],
    keyTerms: [{ term: 'Estates-General', definition: 'An assembly of the three estates of France' }, { term: 'Third Estate', definition: 'Everyone who was not clergy or noble' }, { term: 'Bastille', definition: 'A royal fortress and prison in Paris' }, { term: 'Tennis Court Oath', definition: 'A promise not to separate until France had a constitution' }],
    concepts: [{ name: 'Estates', definition: 'The three orders of French society', why: 'Each had a different share of power', misconception: 'The estates were equal in size' }],
    misconceptions: [{ believe: 'The Revolution was only about bread', actually: 'Ideas about rights mattered too', why: 'The Declaration of the Rights of Man' }] }),
  q: {
    mcq: (t, i) => ({ question: 'Which group made up about 97% of France in 1789?', options: put('The Third Estate', ['The clergy', 'The nobility', 'The royal court'], i) }),
    scenario: (t, i) => ({ question: 'A baker in Paris in 1789 pays rising taxes but has no vote that counts. Which estate is he in?', options: put('The Third Estate', ['The First Estate', 'The Second Estate', 'The royal family'], i) }),
    fill: () => ({ question: 'On 14 July 1789 crowds stormed the ___.', answer: 'Bastille' }),
    write: () => ({ question: 'Explain why the king called the Estates-General in 1789.', modelAnswer: 'The government was bankrupt, so the king needed new taxes and called the Estates-General to approve them.' }),
    'write:claim': () => ({ question: 'Was the storming of the Bastille the real start of the Revolution?', source: 'We swear never to separate until the constitution of the kingdom is established. - Tennis Court Oath, 20 June 1789', modelAnswer: 'No. The Tennis Court Oath in June already broke the king\'s authority; the Bastille in July defended a revolution that had begun.' }),
    classify: () => ({ question: 'Sort:', categoryA: 'Causes', categoryB: 'Results', itemsA: ['Bankruptcy', 'Unfair taxes', 'Bad harvests'], itemsB: ['End of feudal dues', 'Declaration of Rights', 'A republic'] }),
    'classify:change': () => ({ itemsA: ['Feudal dues ended', 'The Church lost its land', 'The king lost his power'], itemsB: ['Most people were farmers', 'Bread was still costly', 'Paris was the capital'] }),
    sequence: () => ({ items: ['The government goes bankrupt', 'The Estates-General meets', 'The Tennis Court Oath', 'The storming of the Bastille'] }),
    passage: (t, i, v) => ({ passage: v === 'perspective' ? 'This revolution has destroyed the old order of society. The rights of men are claimed by those who have no idea of how a nation is held together. - Edmund Burke, 1790' : 'The peasants are so poor that they live on bread and water. A third of what they grow goes in taxes and dues. - Arthur Young, 1787',
      question: v === 'perspective' ? 'Why did Burke, writing in 1790, see the Revolution this way?' : 'What does Young\'s account show about France before 1789?',
      options: put(v === 'perspective' ? 'He believed order came from tradition, and feared change without it' : 'Peasants carried a heavy tax burden', v === 'perspective' ? ['He knew the Terror would come in 1793', 'He was French and lost his land', 'He supported the king of France personally'] : ['Peasants were rich', 'Nobles paid most taxes', 'Bread was cheap'], i) }),
    twopart: (t, i) => ({ question: 'Why did the Third Estate leave the Estates-General?', options: put('Its votes counted for less than the other two estates', ['It wanted to protect the king', 'It had finished its work', 'The clergy asked it to'], i), reasons: put('Voting was by estate, so two estates outvoted it', ['The meeting was too far away', 'The king closed the Bastille', 'Taxes had been cut'], (i + 2) % 4) }),
    corroborate: (t, i) => ({ sourceA: { label: 'Burke, 1790', text: 'The Revolution has destroyed the order that holds a nation together.' }, sourceB: { label: 'Paine, 1791', text: 'The Revolution has restored the natural rights of man.' }, question: 'What do Burke and Paine disagree about?', options: put('Whether the Revolution was good for France', ['When the Revolution began', 'Who stormed the Bastille', 'What the Third Estate was'], i) }),
    highlight: (t, i) => ({ question: 'Which sentence shows the Third Estate paid most of the taxes?', sentences: put('The Third Estate paid nearly all the taxes.', ['The king lived at Versailles.', 'The clergy ran the schools.', 'Paris was a large city.'], i) }),
    recall: () => ({ question: 'Name the three estates of France in 1789.', items: ['clergy / First Estate', 'nobility / Second Estate', 'Third Estate / commoners'], need: 3 }),
    whosright: () => ({ question: 'Why did the Revolution start in 1789?', claims: null }),
    conceptmap: () => ({ nodes: ['Revolution of 1789', 'Bankruptcy', 'Estates-General', 'Unfair taxes', 'National Assembly'], links: [{ from: 0, to: 1, label: 'caused by' }, { from: 0, to: 2, label: 'began at' }, { from: 1, to: 3, label: 'led to' }, { from: 2, to: 4, label: 'became' }], extra: 'Versailles' }),
    truefalse: () => ({ question: 'The Third Estate was the smallest estate.' })
  }
};

const S = {
  subject: 'Spanish: present tense verbs', days: 3,
  notes: 'Spanish present tense. Hablar: hablo, hablas, habla, hablamos, habláis, hablan. Comer: como, comes, come, comemos, coméis, comen. Vivir: vivo, vives, vive, vivimos, vivís, viven. ' +
    'Yo hablo español. ¿Tú comes en casa? Ella vive en Madrid. Nosotros hablamos con el profesor. Mi familia come a las dos. ' +
    'Vocabulary: la casa (house), el libro (book), la escuela (school), el perro (dog), la comida (food).',
  day: (n) => ({ title: ['Spanish: -ar verbs in the present', 'Spanish: -er and -ir verbs', 'Spanish: everyday sentences'][n % 3],
    content: 'Regular verbs in the present tense drop -ar, -er or -ir and add an ending for each person: hablo, hablas, habla.',
    steps: [{ action: 'Find the stem: hablar becomes habl-', why: 'Drop the -ar' }, { action: 'Add the ending for the person: yo hablo', why: 'Each person has its own ending' }],
    keyTerms: [{ term: 'hablar', definition: 'to speak' }, { term: 'comer', definition: 'to eat' }, { term: 'vivir', definition: 'to live' }, { term: 'la escuela', definition: 'school' }],
    concepts: [{ name: 'Verb endings', definition: 'The ending shows who does the action', why: 'So the pronoun is often left out', misconception: 'You always need yo or tú' }],
    misconceptions: [{ believe: 'Hablo needs yo in front', actually: 'The -o ending already says I', why: 'Spanish drops the pronoun' }] }),
  q: {
    mcq: (t, i) => ({ question: 'Which form completes "Nosotros ___ español"?', options: put('hablamos', ['hablo', 'hablan', 'hablas'], i) }),
    fill: () => ({ question: 'Ella ___ en Madrid. (vivir)', answer: 'vive' }),
    write: () => ({ question: 'Write two sentences in Spanish about what you eat at home.', modelAnswer: 'Yo como en casa. Mi familia come a las dos.' }),
    sentence: () => ({ question: 'Build the sentence: "We speak with the teacher."', words: ['Nosotros', 'hablamos', 'con', 'el', 'profesor'], translation: 'We speak with the teacher.' }),
    dictation: () => ({ text: '¿Tú comes en casa?', blank: 'comes', translation: 'Do you eat at home?' }),
    highlight: (t, i) => ({ question: 'Which sentence uses the yo form?', sentences: put('Yo hablo español.', ['Ella vive en Madrid.', 'Tú comes en casa.', 'Ellos hablan mucho.'], i) }),
    twopart: (t, i) => ({ question: 'Which is correct for "they live"?', options: put('viven', ['vive', 'vivimos', 'vives'], i), reasons: put('-ir verbs take -en for ellos', ['-ir verbs take -an for ellos', 'It matches yo', 'It is irregular'], (i + 2) % 4) }),
    matchpairs: () => ({ pairs: [{ left: 'la casa', right: 'house' }, { left: 'el libro', right: 'book' }, { left: 'la escuela', right: 'school' }, { left: 'el perro', right: 'dog' }] }),
    readingset: () => ({ title: 'La familia de Ana', passage: 'Ana vive en Madrid con su familia. Ella habla español y un poco de inglés. Su familia come a las dos. Después de comer, Ana lee un libro.',
      questions: [{ question: 'What is the main idea of the passage?', options: ['Ana\'s daily life with her family', 'How to cook', 'A trip to London', 'A school test'], correctIndex: 0, questionType: 'main-idea' },
        { question: 'What does Ana do after lunch?', options: ['She sleeps', 'She reads a book', 'She runs', 'She cooks'], correctIndex: 1, questionType: 'inference' },
        { question: 'In the passage, "come" means:', options: ['comes', 'eats', 'lives', 'speaks'], correctIndex: 1, questionType: 'vocab-in-context' }] }),
    recall: () => ({ question: 'Write all six present-tense forms of hablar.', items: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'], need: 6 }),
    truefalse: () => ({ question: '"Comemos" means "we eat".' }),
    whosright: () => ({ question: 'How do you say "I speak"?', claims: null }),
    classify: () => ({ question: 'Sort:', categoryA: '-ar verbs', categoryB: '-er verbs', itemsA: ['hablar', 'estudiar', 'trabajar'], itemsB: ['comer', 'beber', 'leer'] })
  }
};

const WHO = {
  H: [{ says: 'The government had run out of money, so the king needed new taxes.', why: 'Right - bankruptcy is why the Estates-General was called.' },
      { says: 'The people just wanted cake.', why: 'There is no evidence for this story; the crisis was debt and taxes.' },
      { says: 'Napoleon started it.', why: 'Napoleon rose to power in 1799, ten years later.' }],
  S: [{ says: 'Hablo.', why: 'Right - the -o ending says "I".' }, { says: 'Yo habla.', why: 'Habla is he or she.' }, { says: 'Hablas.', why: 'Hablas is "you speak".' }]
};

let L = H, LK = 'H', SUBJ = 'history', MAPMODE = 'compose';

function fillQ(tpl, i) {
  const t = tpl.type, v = tpl.questionType && tpl.questionType !== 'main-idea' ? tpl.questionType : (tpl.mode || (tpl.categoryA === 'Changed' ? 'change' : ''));
  const key = L.q[t + ':' + v] ? t + ':' + v : t;
  const f = L.q[key];
  if (!f) return Object.assign({}, tpl, { question: 'UNFILLED ' + t });
  const got = f(tpl, typeof tpl.correctIndex === 'number' ? tpl.correctIndex : 0, t === 'passage' ? tpl.questionType : v);
  const q = Object.assign({}, tpl, got);
  // One right classmate, wherever the template put it; two different wrong ones.
  if (t === 'whosright') {
    let w = 1; q.claims = tpl.claims.map(c => c.right ? Object.assign({ right: true }, WHO[LK][0]) : Object.assign({ right: false }, WHO[LK][w++]));
  }
  q.hint = q.hint || 'Look back at the lesson.';
  q.explanation = q.explanation || 'Because of what the notes say about this.';
  return q;
}

function schemaFrom(prompt) {
  let at = prompt.lastIndexOf('"completed":false,"questions":['); if (at >= 0) at += '"completed":false,'.length; else at = prompt.lastIndexOf('"questions":[');
  if (at < 0) return null;
  let i = at + '"questions":'.length, depth = 0, s = i, inStr = false;
  for (; i < prompt.length; i++) {
    const c = prompt[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '[' || c === '{') depth++; else if (c === ']' || c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return JSON.parse(prompt.slice(s, i));
}

const MAPS = {
  history: {
    like: { subject: 'The French Revolution', field: 'History', family: 'history', tip: 'Ask what changed, for whom, and who said so.', subtopics: [
      { name: 'Causes of the Revolution', parent: 'The French Revolution', covers: ['three estates', 'bankruptcy', 'taxes'], kind: 'mechanism', material: ['dates', 'sources', 'categories'], like: 'history/social', picture: 'flow' },
      { name: 'The events of 1789', parent: 'The French Revolution', covers: ['Estates-General', 'Tennis Court Oath', 'Bastille'], kind: 'interpretation', material: ['dates', 'sources', 'order'], like: 'history/era', picture: 'timeline' },
      { name: 'What changed and what did not', parent: 'The French Revolution', covers: ['feudal dues', 'the Church', 'farmers'], kind: 'interpretation', material: ['dates', 'categories', 'sources'], like: 'history/civics', picture: 'compare' }] },
    compose: { subject: 'The French Revolution', field: 'History', family: 'history', tip: 'Ask what changed, for whom, and who said so.', subtopics: [
      { name: 'Causes of the Revolution', parent: 'The French Revolution', covers: ['three estates', 'bankruptcy', 'taxes'], kind: 'mechanism', material: ['dates', 'categories'], like: '', picture: 'flow' },
      { name: 'The events of 1789', parent: 'The French Revolution', covers: ['Estates-General', 'Tennis Court Oath', 'Bastille'], kind: 'interpretation', material: ['dates', 'sources', 'order'], like: '', picture: 'timeline' },
      { name: 'What changed and what did not', parent: 'The French Revolution', covers: ['feudal dues', 'the Church', 'farmers'], kind: 'facts', material: ['dates'], like: '', picture: 'compare' }] }
  },
  spanish: {
    like: { subject: 'Spanish present tense', field: 'Spanish', family: 'language', tip: 'Say the sentence out loud as you build it.', subtopics: [
      { name: '-ar verbs', parent: 'Present tense', covers: ['hablar', 'endings'], kind: 'language', material: ['sentences', 'categories'], like: 'language/grammar', picture: 'concept' },
      { name: '-er and -ir verbs', parent: 'Present tense', covers: ['comer', 'vivir'], kind: 'language', material: ['sentences', 'text'], like: 'language/reading', picture: 'compare' },
      { name: 'Everyday words', parent: 'Vocabulary', covers: ['la casa', 'el libro', 'la escuela'], kind: 'facts', material: ['categories'], like: 'language/vocab', picture: 'concept' }] },
    compose: { subject: 'Spanish present tense', field: 'Spanish', family: 'language', tip: 'Say the sentence out loud as you build it.', subtopics: [
      { name: '-ar verbs', parent: 'Present tense', covers: ['hablar', 'endings'], kind: 'language', material: ['sentences', 'text'], like: '', picture: 'concept' },
      { name: '-er and -ir verbs', parent: 'Present tense', covers: ['comer', 'vivir'], kind: 'language', material: ['sentences', 'categories'], like: '', picture: 'compare' },
      { name: 'Everyday words', parent: 'Vocabulary', covers: ['la casa', 'el libro', 'la escuela'], kind: 'facts', material: ['categories'], like: '', picture: 'concept' }] }
  }
};

function label(c) {
  if (!c) return 'null';
  const q = c.q || {};
  let s = c.type;
  if (q.type && q.type !== c.type) s += '(' + q.type + ')';
  if (q.mode) s += ':' + q.mode;
  if (q.questionType && q.questionType !== 'main-idea') s += ':' + q.questionType;
  if (q.categoryA === 'Changed') s += ':change';
  if (c.isPretest) s += ' [pretest]';
  if (c.feynmanPass) s += ' [teach-back ' + c.feynmanPass + ']';
  return s;
}

async function run(subj, mapmode, days) {
  SUBJ = subj; MAPMODE = mapmode; L = subj === 'history' ? H : S; LK = subj === 'history' ? 'H' : 'S';
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await require('./fontroute')(ctx);
  const page = await ctx.newPage(); const errors = []; const asked = []; let mapCalls = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
  await page.route('**/api/generate', async r => {
    const p = JSON.parse(r.request().postData()).prompt;
    const reply = (o) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: typeof o === 'string' ? o : JSON.stringify(o) }) });
    if (/^Map the study notes/.test(p)) { mapCalls++; if (MAPMODE === 'fail') return r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"x"}' }); return reply(MAPS[SUBJ][MAPMODE]); }
    if (/^Draw ONE/.test(p) || /illustration/i.test(p.slice(0, 200))) return reply('{"type":"none"}');
    const schema = schemaFrom(p);
    if (!schema) return reply('{"questions":[]}');
    const dm = p.match(/Day (\d+) of (\d+)/); const n = dm ? +dm[1] - 1 : 0;
    asked.push({ day: n + 1, types: schema.map(t => t.type + (t.mode ? ':' + t.mode : '') + (t.questionType && t.questionType !== 'main-idea' && t.type === 'passage' ? ':' + t.questionType : '') + (t.categoryA === 'Changed' ? ':change' : '')) });
    const d = Object.assign({ day: n + 1 }, L.day(n), { questions: schema.map(fillQ) });
    return reply(d);
  });
  await page.goto(BASE + 'favicon.png');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ email: 'e2e@t.com', name: 'E2E', tier: 'vip', grade: '7' })); localStorage.setItem('studyflow_onboarded', '1'); });
  await page.goto(BASE + 'app.html?cb=' + Date.now(), { waitUntil: 'load' }); await page.waitForTimeout(500);
  await page.evaluate(({ notes, subject, days }) => {
    selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    document.getElementById('notes-input').value = notes; document.getElementById('subject-input').value = subject;
    startGeneration(notes, days, new Date(Date.now() + days * 86400000).toISOString().slice(0, 10), 'vip');
  }, { notes: L.notes, subject: L.subject, days: days });
  for (let i = 0; i < 400 && !/dashboard/.test(page.url()); i++) await page.waitForTimeout(250);
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('sfu:e2e@t.com|studyflow_plan') || 'null'));
  const out = { subj: SUBJ, map: MAPMODE, mapCalls, reachedDashboard: /dashboard/.test(page.url()), subjectType: plan && plan.subjectType, asked, saved: [], sessions: [], errors };
  if (!plan) { console.log(JSON.stringify(out, null, 1)); await b.close(); return; }
  out.saved = plan.days.map(d => ({ day: d.day, title: d.title, sub: d.subtopic && (d.subtopic.name || d.subtopic.key), types: d.questions.map(q => q.type + (q.mode ? ':' + q.mode : '') + (q.type === 'passage' && q.questionType && q.questionType !== 'main-idea' ? ':' + q.questionType : '') + (q.categoryA === 'Changed' ? ':change' : '')) }));
  for (let di = 0; di < plan.days.length; di++) {
    await page.evaluate((di) => { localStorage.setItem('sfu:e2e@t.com|studyflow_current_day', String(di)); localStorage.setItem('sfu:e2e@t.com|studyflow_minutes', '60'); }, di);
    await page.goto(BASE + 'lesson.html?cb=' + Date.now(), { waitUntil: 'load' }); await page.waitForTimeout(1400);
    const seen = []; const shots = {};
    const qlen = await page.evaluate(() => sessionCards.length);
    for (let k = 0; k < qlen; k++) {
      const info = await page.evaluate(() => {
        const c = window.currentCard; if (!c) return null;
        const el = document.getElementById('session-card');
        return { c: { type: c.type, isPretest: !!c.isPretest, feynmanPass: c.feynmanPass || 0, q: c.q ? { type: c.q.type, mode: c.q.mode, questionType: c.q.questionType, categoryA: c.q.categoryA, isFeynman: c.q.isFeynman } : null },
                 dom: { claim: !!document.querySelector('#cl-claim'), bank: !!document.querySelector('#sb-bank'), gap: !!document.querySelector('.dict-gap'), accent: !!document.querySelector('.accent-bar, .acc-bar, [data-accent]'), h2: (el && el.querySelector('h2') ? el.querySelector('h2').textContent : '') },
                 done: !!document.querySelector('#results-screen.show, .results-screen.show, #results.show') || !sessionActive };
      }).catch(() => null);
      if (!info || info.done) break;
      const lab = label(info.c);
      const dom = [info.dom.claim && 'claim-boxes', info.dom.bank && 'word-bank', info.dom.gap && 'dictation-gap', info.dom.accent && 'accent-keys'].filter(Boolean);
      seen.push(lab + (dom.length ? ' {' + dom.join(',') + '}' : '') + (info.dom.h2 && /Then and now|Make your case|Listen|Build/.test(info.dom.h2) ? ' "' + info.dom.h2.trim() + '"' : ''));
      await page.evaluate(() => showNextCard()); await page.waitForTimeout(90);
    }
    out.sessions.push({ day: di + 1, cards: seen });
  }
  await b.close();
  return out;
}

(async () => {
  const all = s => [].concat.apply([], s.sessions.map(x => x.cards));
  const has = (s, re) => all(s).some(c => re.test(c));
  for (const mode of ['compose', 'like', 'fail']) {
    const h = await run('history', mode, 2);
    const tag = '[history, map ' + mode + '] ';
    assert(h.reachedDashboard && h.saved.length === 2 && h.errors.length === 0, tag + 'plan built and saved, no page errors ' + h.errors.join('|'));
    assert(has(h, /^write:claim \{claim-boxes\}/), tag + '"Make your case" reached a session, with its three boxes');
    assert(has(h, /^passage:perspective/), tag + 'a historical perspective card reached a session');
    assert(has(h, /^classify:change "Then and now"/), tag + '"Then and now" reached a session' + (mode === 'fail' ? ' (the French Revolution is an era, not civics)' : ''));
    assert(!has(h, /truefalse/), tag + 'no true/false');
    if (fails) console.log('   ' + h.saved.map(d => 'day ' + d.day + ': ' + d.types.join(',')).join('\n   '));
    const s = await run('spanish', mode, 2);
    const t2 = '[spanish, map ' + mode + '] ';
    assert(s.reachedDashboard && s.saved.length === 2 && s.errors.length === 0, t2 + 'plan built and saved, no page errors ' + s.errors.join('|'));
    assert(s.sessions.every(x => x.cards.some(c => /^dictation \{dictation-gap,accent-keys\}/.test(c))), t2 + 'every day has a listening card, with its gap and accent keys');
    assert(s.sessions.every(x => x.cards.some(c => /^sentence \{word-bank\}/.test(c))), t2 + 'every day builds a sentence from a word bank');
    assert(has(s, /^fill \{accent-keys\}/), t2 + 'fill-ins carry the accent keys');
    if (fails) console.log('   ' + s.saved.map(d => 'day ' + d.day + ': ' + d.types.join(',')).join('\n   '));
  }
  console.log(fails ? fails + ' FAILED' : 'E2E CARDS OK');
})();

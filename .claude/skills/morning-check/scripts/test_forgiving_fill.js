// A typed answer that means the same thing is right (Nov 2026): a typo, a
// plural, filler words - and, through one model check, a word that means the
// same. Spelling practice stays exact, and extra words that go off topic or say
// something wrong are not right. Real page load, the model check answered here.
const h = require('./harness');
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const F = (question, answer) => ({ type: 'fill', question, answer, explanation: 'From the lesson.', difficulty: 'easy' });
const QS = [
  F('The ___ is the powerhouse of the cell.', 'mitochondria'),
  F('Plants make food from light in a process called ___.', 'photosynthesis'),
  F('Body cells make copies of themselves by ___.', 'mitosis'),
  F('A medicine changes how you feel. That change is its ___.', 'effect'),
  F('The control centre of the cell is the ___.', 'nucleus'),
  F('Spelling: type the word "necessary" correctly. ___', 'necessary'),
  F('The green pigment in plants is called ___.', 'chlorophyll')
];
const plan = { id: 'ff1', subject: 'Biology: cells', subjectType: 'science', createdAt: Date.now(), days: [{
  day: 1, title: 'Cells and how they work', microTopic: 'Biology › Cells',
  content: 'The mitochondria release energy. Mitosis makes two identical cells; meiosis makes sex cells. A drug can affect the body and the effect can be good or bad. The nucleus controls the cell. Chlorophyll absorbs light for photosynthesis.',
  keyTerms: [{ term: 'mitosis', definition: 'copying' }, { term: 'meiosis', definition: 'sex cells' }, { term: 'affect', definition: 'to change' }, { term: 'effect', definition: 'the result' }],
  steps: [], concepts: [], questions: QS, completed: false }] };

// the model check: "banana" and "pizza" are off topic; anything else that reaches it is judged the same
const judged = [];
const mock = async (prompt) => {
  if (!/^You are marking ONE typed answer/.test(prompt)) return { json: { result: '{"type":"none"}' } };
  const typed = (/<student>([\s\S]*?)<\/student>/.exec(prompt) || [])[1] || '';
  judged.push(typed);
  if (/boom/.test(typed)) return { status: 500, json: { error: 'x' } };
  if (/slow/.test(typed)) { await new Promise(r => setTimeout(r, 900)); return { json: { result: '{"v":"same"}' } }; }
  return { json: { result: JSON.stringify({ v: /banana|pizza|brain|affect/.test(typed) ? 'different' : 'same' }) } };
};

async function go(page, frag) {
  await page.evaluate(f => { cardIndex = sessionCards.findIndex(c => c.q && c.q.question && c.q.question.indexOf(f) >= 0); showNextCard(); }, frag);
  await page.waitForTimeout(120);
}
async function answer(page, frag, typed, wait) {
  await go(page, frag);
  await page.evaluate(v => { const i = document.getElementById('fill-input'); i.value = v; answerFillBtn(); }, typed);
  await page.waitForTimeout(wait || 150);
  return page.evaluate(() => ({ right: /correct-fb/.test(document.getElementById('feedback-box').className),
    done: currentAnswered, fb: document.getElementById('feedback-box').innerText }));
}

(async () => {
  // ---- local forgiveness, no model involved ------------------------------------
  let env = await h.open({ plan, mock, settle: 500 });
  let page = env.page;
  const T = async (frag, typed, want, why) => { const r = await answer(page, frag, typed); assert(r.done && r.right === want, (want ? 'RIGHT ' : 'WRONG ') + JSON.stringify(typed) + ' - ' + why); return r; };
  await T('powerhouse', 'mitochondria', true, 'the exact answer');
  await T('powerhouse', 'Mitochondria', true, 'capitals');
  await T('powerhouse', 'the mitochondria', true, 'an article');
  await T('powerhouse', 'mitocondria', true, 'a dropped letter');
  await T('powerhouse', 'mitochondira', true, 'two letters swapped');
  await T('powerhouse', 'mitochondrion', true, 'the singular');
  await T('powerhouse', 'I think it is the mitochondria', true, 'filler words round it');
  const r1 = await T('food from light', 'photosythesis', true, 'a dropped letter in a long word');
  assert(/You wrote/.test(r1.fb) && /photosynthesis/.test(r1.fb), 'a forgiven answer says what was written and shows the real spelling: ' + r1.fb.replace(/\s+/g, ' ').slice(0, 90));
  await T('food from light', 'photosynthesiss', true, 'a doubled letter');
  await T('copies of themselves', 'mitosis', true, 'exact');
  await T('copies of themselves', 'meiosis', false, 'a different term the lesson uses is not a typo');
  await T('copies of themselves', 'mitosiss', true, 'an extra letter');
  await T('copies of themselves', 'not mitosis', false, 'a negated answer');
  await T('copies of themselves', "I don't know", false, 'no answer');
  await T('medicine changes', 'affect', false, 'affect is not effect (the lesson uses both words)');
  await T('medicine changes', 'effects', true, 'a plural');
  await T('control centre', 'nucleous', true, 'a swapped vowel pair is a typo of nucleus? (insertion)');
  await T('control centre', 'mitochondria', false, 'another organelle');
  // spelling practice stays exact
  await T('Spelling: type', 'neccessary', false, 'spelling card: a slip is wrong');
  await T('Spelling: type', 'Necessary', true, 'spelling card: capitals are fine');
  assert(judged.length === 0, 'no model call with the check off (' + judged.length + ')');
  // ---- the recall card ------------------------------------------------------------
  const rc = (typed, items) => page.evaluate(([t, it]) => rcMatch(t, it, {}, false).kind, [typed, items]);
  const items = [['heart'], ['lungs'], ['mitochondria'], ['affect']];
  assert(await rc('the heart', items) === 'right', 'recall: an article is fine');
  assert(await rc('it is the lungs', items) === 'right', 'recall: filler words are fine');
  assert(await rc('lung', items) === 'right', 'recall: a plural slip is fine');
  assert(await rc('mitocondria', items) === 'right', 'recall: a dropped letter is fine');
  assert(await rc('effect', items) === 'wrong', 'recall: effect is not affect (the lesson uses both)');
  assert(await rc('not the heart', items) !== 'right', 'recall: a negated answer is not right');
  assert(await rc('banana', items) === 'wrong', 'recall: something else is wrong');
  await env.browser.close();

  // ---- the model check -----------------------------------------------------------
  judged.length = 0;
  env = await h.open({ plan, mock, judge: true, settle: 500 });
  page = env.page;
  await page.evaluate(() => { window.SF_JUDGE_OFF = false; });
  const J = async (frag, typed, want, why, calls) => {
    const before = judged.length;
    const r = await answer(page, frag, typed, 350);
    assert(r.done && r.right === want && judged.length - before === calls, (want ? 'RIGHT ' : 'WRONG ') + JSON.stringify(typed) + ' - ' + why + ' (' + (judged.length - before) + ' model call' + (judged.length - before === 1 ? '' : 's') + ')');
    return r;
  };
  await J('powerhouse', 'mitochondria', true, 'an exact answer is never sent', 0);
  await J('powerhouse', 'Mitochondria!', true, 'capitals and a mark are not sent', 0);
  await J('control centre', 'the nucleus of the cell', true, 'extra words from the question are not sent', 0);
  await J('control centre', 'the cells nucleus which holds the DNA', true, 'extra words that are on topic: the model says the same', 1);
  await J('control centre', 'nucleus and also pizza', false, 'extra words that go off topic: the model says different (the old rule passed this)', 1);
  await J('control centre', 'the brain of the cell', false, 'a different idea', 1);
  await J('medicine changes', 'affect', false, 'one letter from effect, but another word: the model decides', 1);
  await J('Spelling: type', 'neccessary', false, 'spelling cards never ask the model', 0);
  await J('copies of themselves', "I don't know", false, 'a negation is not sent', 0);
  const w = await answer(page, 'green pigment', 'plant colour boom', 350);
  assert(w.done, 'when the check cannot be made (a 500) the card still finishes, graded the old way');
  await go(page, 'green pigment');
  await page.evaluate(() => { const i = document.getElementById('fill-input'); i.value = 'green stuff slow'; answerFillBtn(); });
  await page.waitForTimeout(200);
  const mid = await page.evaluate(() => ({ txt: document.getElementById('feedback-box').innerText, ro: document.getElementById('fill-input').readOnly, done: currentAnswered }));
  assert(/checking your answer/i.test(mid.txt) && mid.ro && !mid.done, 'while the model checks, the card says so and holds the answer: ' + mid.txt.replace(/\s+/g, ' '));
  await page.waitForTimeout(1400);
  const fin = await page.evaluate(() => ({ done: currentAnswered, right: /correct-fb/.test(document.getElementById('feedback-box').className) }));
  assert(fin.done && fin.right, 'and finishes when the answer arrives');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join(' | '));
  await env.browser.close();

  console.log(fails ? fails + ' FAILED' : 'FORGIVING FILL OK');
})();

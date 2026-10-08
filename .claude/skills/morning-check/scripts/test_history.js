// History cards (Oct 2026): make your case (write mode "claim"), continuity and
// change (classify:change), historical perspective (passage:perspective), and the
// plan builder asking for them. Real page loads, api/generate mocked.
const h = require('./harness');
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const CLAIM = { type: 'write', mode: 'claim', question: 'Was the Stamp Act the main cause of the American Revolution?',
  source: 'No taxation without representation! <img src=x onerror="window.__xss=1">', modelAnswer: 'Partly: it united the colonies, but the Intolerable Acts and Lexington pushed them to war.', explanation: '', difficulty: 'hard' };
const CHANGE = { type: 'classify', question: 'What changed, and what stayed the same?', categoryA: 'Changed', categoryB: 'Stayed the same',
  itemsA: ['Who made tax laws', 'Colonial unity', 'Loyalty to the king'], itemsB: ['Farming way of life', 'Slavery in the South', 'English language'], explanation: 'Politics changed fast; daily life did not.', difficulty: 'medium' };
const PERSP = { type: 'passage', questionType: 'perspective', passage: 'A Boston merchant, 1766: "We are Englishmen, and ask only the rights of Englishmen."',
  question: 'Why did the merchant call himself an Englishman?', options: ['He still saw the colonies as part of Britain', 'He was born in London', 'He wanted independence already', 'He was being dishonest, as anyone today would see'],
  correctIndex: 0, explanation: 'In 1766 most colonists still thought of themselves as British. The last option judges him by what we know now.', difficulty: 'medium' };
const MCQ = { type: 'mcq', question: 'Which act taxed paper goods?', options: ['Stamp Act', 'Sugar Act', 'Tea Act', 'Quartering Act'], correctIndex: 0, explanation: '', difficulty: 'easy' };
const plan = { id: 'hist', subject: 'History: causes of the American Revolution', subjectType: 'history', createdAt: Date.now(),
  days: [{ day: 1, title: 'Road to revolution', content: 'Taxes after 1763 angered colonists, who protested.', keyTerms: [], steps: [], concepts: [], questions: [MCQ, CLAIM, CHANGE, PERSP, MCQ], completed: false }] };
(async () => {
  let prompt = '';
  const env = await h.open({ plan, mock: async (p) => { prompt = p; return { json: { result: 'SCORE: 7/10\nWHAT YOU NAILED: x\nKNOWLEDGE GAPS: y\nADVICE: z' } }; } });
  const page = env.page;
  const q = await page.evaluate(() => sessionCards.map(c => c.type + (c.q && c.q.mode ? ':' + c.q.mode : '') + (c.feynmanPass ? '#' + c.feynmanPass : '')));
  const iClaim = q.indexOf('write:claim'), passes = q.filter(x => /#/.test(x)).length;
  assert(iClaim > 0 && passes === 2 && !/claim#/.test(q.join()) && !/^write#/.test(q[iClaim + 1] || ''), 'claim card mid-practice (not just before the closing teach-it-back), both passes still there: ' + q.join(' > '));
  for (let i = 0; i < 30; i++) { const t = await page.evaluate(() => window.currentCard && window.currentCard.q && window.currentCard.q.mode); if (t === 'claim') break; await page.evaluate(() => showNextCard()); await page.waitForTimeout(80); }
  const st = await page.evaluate(() => ({ boxes: document.querySelectorAll('.cl-box').length, q: (document.querySelector('.cl-question') || {}).textContent, src: !!document.querySelector('.cl-source'), img: !!document.querySelector('.cl-source img'), xss: !!window.__xss, feyn: /Feynman/.test(document.getElementById('session-card').innerText) }));
  assert(st.boxes === 3 && /Stamp Act/.test(st.q) && !st.feyn, 'make-your-case card: the question, three boxes, not a teach-it-back card');
  assert(st.src && !st.img && !st.xss, 'the source is shown, escaped (no markup from the model reaches the page)');
  const t0 = await page.evaluate(() => totalAnswered); prompt = '';
  await page.evaluate(() => submitClaim()); await page.waitForTimeout(200);
  assert(prompt === '', 'an empty claim sends nothing');
  await page.fill('#cl-claim', 'Partly, but it was not the main cause.');
  await page.fill('#cl-evidence', 'The Stamp Act Congress united 9 colonies in 1765; the Intolerable Acts of 1774 led to war.');
  await page.evaluate(() => submitClaim()); await page.waitForTimeout(500);
  const fb = await page.evaluate(() => ({ t: totalAnswered, fb: document.getElementById('feedback-box').innerText, next: document.getElementById('btn-next').disabled }));
  assert(/grade the argument/.test(prompt) && /CLAIM: Partly/.test(prompt) && /EVIDENCE: The Stamp Act Congress/.test(prompt) && /Was the Stamp Act/.test(prompt), 'the tutor grades the ARGUMENT, and gets the claim, the evidence and the question');
  assert(/7\/10/.test(fb.fb) && /argument/i.test(fb.fb) && /One strong answer/i.test(fb.fb) && !fb.next && fb.t === t0, 'feedback shows, Next opens, and it is not in the percentage');
  for (let i = 0; i < 30; i++) { const t = await page.evaluate(() => window.currentCard && window.currentCard.type); if (t === 'classify') break; await page.evaluate(() => showNextCard()); await page.waitForTimeout(80); }
  const cl = await page.evaluate(() => document.getElementById('session-card').innerText);
  assert(/CHANGED/i.test(cl) && /STAYED THE SAME/i.test(cl), 'continuity and change sorts into Changed / Stayed the same');
  for (let i = 0; i < 30; i++) { const t = await page.evaluate(() => window.currentCard && window.currentCard.q && window.currentCard.q.questionType); if (t === 'perspective') break; await page.evaluate(() => showNextCard()); await page.waitForTimeout(80); }
  const pp = await page.evaluate(() => document.getElementById('session-card').innerText);
  assert(/HISTORICAL PERSPECTIVE/i.test(pp) && /EXCERPT/i.test(pp) && /Englishmen/.test(pp), 'perspective passage renders as a primary-source excerpt');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();

  // The plan builder: the prompt asks for all three; a claim with no model answer loses its mode.
  const { chromium } = require('./pw'); const fx = require('./fixture');
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; let pr = '';
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
  await pg.route('**/api/generate', r => {
    const x = JSON.parse(r.request().postData()).prompt;
    if (/^Draw ONE/.test(x)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
    pr = x; const d = JSON.parse(JSON.stringify(fx.plan.days[0])); delete d.completed;
    d.questions = [CLAIM, Object.assign({}, CLAIM, { question: 'Was it fair?', modelAnswer: '' }), CHANGE, PERSP, { type: 'write', mode: 'bogus', question: 'Explain the Stamp Act.', modelAnswer: 'x' }];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(d) }) });
  });
  await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ email: 'hist@t.com', tier: 'vip', grade: '8' })); });
  await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { document.getElementById('subject-input').value = 'History: the fall of the Roman Empire'; selectedGoal = 'exam'; selectedDifficulty = 'Medium';
    startGeneration('Rome fell in 476 after invasions, weak emperors and a split into east and west.', 1, new Date(Date.now() + 86400000).toISOString().slice(0, 10), 'vip'); });
  let qs = null;
  for (let i = 0; i < 100 && !qs; i++) { await pg.waitForTimeout(150); qs = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('sfu:hist@t.com|studyflow_plan')).days[0].questions; } catch (e) { return null; } }).catch(() => null); }
  const schema = pr.slice(pr.indexOf('"completed":false,"questions":['));
  assert(/"mode":"claim"/.test(schema) && /"categoryA":"Changed"/.test(schema) && /"questionType":"perspective"/.test(schema) && !/"type":"truefalse"/.test(schema), 'the history prompt asks for a claim, a change sort and a perspective, and no true/false');
  assert(/answer EITHER way/.test(pr) && /today.s values/.test(pr), 'and says how to write them (debatable question; the presentism trap)');
  const modes = (qs || []).filter(q => q.type === 'write').map(q => q.mode || '-').join(',');
  assert(modes === 'claim,-,-', 'a claim keeps its mode; one with no model answer, or a made-up mode, becomes a plain write (' + modes + ')');
  /* Events and eras had no terms, so it was the answer only when the notes
     named nothing civic or social - and "rights" sent the French Revolution
     to civics on every day, without the then-and-now card. */
  await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' }); await pg.waitForTimeout(300);
  const subs = await pg.evaluate(() => [
    ['History: the French Revolution', 'In 1789 the Third Estate declared the rights of man and stormed the Bastille.'],
    ['Civics: the Constitution and branches of government', 'Congress makes laws, the president enforces them.'],
    ['History: the Industrial Revolution and labor reform', 'Factories grew. Child labor led to reform movements.'],
    ['History: the American Revolution and the Constitution', 'The colonies declared independence in 1776.'],
    ['History: the Civil Rights Movement', 'Protest and boycotts ended legal segregation.']
  ].map(([s, n]) => resolveSubtopics('history', s, n).map(x => x.key).join('+')).join(' | '));
  assert(subs === 'era | civics | social | era+civics | social', 'history subtopics: the French Revolution is an era, civics and social still win their own (' + subs + ')');
  assert(errs.length === 0, 'plan builder: no page errors ' + errs.join('|'));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'HISTORY OK');
})();

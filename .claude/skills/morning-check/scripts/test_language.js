// The language cards (Oct 2026): accent keys and the accent prompt, the word-bank
// sentence builder, and listen-and-type. Real page loads; speech is faked where
// a voice is needed, because headless Chromium ships with none.
const h = require('./harness');
let fails = 0;
const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const day = (qs, title) => ({ day: 1, title: title || 'El pretérito', microTopic: 'Spanish › Verbs › Preterite',
  content: 'The preterite tells what happened once. Hablar becomes habló for he or she.',
  keyTerms: [{ term: 'habló', definition: 'he/she spoke' }, { term: 'comí', definition: 'I ate' }, { term: 'vivió', definition: 'he/she lived' }, { term: 'ayer', definition: 'yesterday' }],
  steps: [], concepts: [], questions: qs, completed: false });
const plan = (qs, subject, type, title) => ({ id: 'lang' + Math.random(), subject: subject || 'Spanish: the preterite', subjectType: type || 'language', createdAt: Date.now(), days: [day(qs, title)] });
const FILL = { type: 'fill', question: 'Ayer ella ___ con su madre. (hablar)', answer: 'habló', explanation: 'Preterite, third person.', difficulty: 'easy' };
const SENT = { type: 'sentence', question: 'Build: Yesterday I ate bread', words: ['Ayer', 'comí', 'pan'], translation: 'Yesterday I ate bread', explanation: 'Time word first.', difficulty: 'easy' };
const DICT = { type: 'dictation', question: 'Listen and type the missing word.', text: 'Mi abuelo vivió en Madrid.', blank: 'vivió', translation: 'My grandfather lived in Madrid.', explanation: 'Preterite of vivir.', difficulty: 'medium' };
const FAKE_SPEECH = () => { window.__spoken = []; const v = { lang: 'es-ES', name: 'Fake Spanish' };
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [v], cancel() {}, speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, lang: u.lang }); } } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; }; };
async function reach(page, type) {
  for (let i = 0; i < 25; i++) {
    const t = await page.evaluate(() => window.currentCard && (window.currentCard.q ? window.currentCard.q.type : window.currentCard.type));
    const pre = await page.evaluate(() => !!(window.currentCard && window.currentCard.isPretest));
    if (t === type && !pre) return true;
    await page.evaluate(() => showNextCard()); await page.waitForTimeout(90);
  }
  return false;
}
async function typeFill(page, v) { await page.evaluate(v => { const i = document.getElementById('fill-input'); i.value = v; answerFillBtn(); }, v); await page.waitForTimeout(150); }
(async () => {
  // 1. Fill: accent keys, accent prompt, then right.
  let env = await h.open({ plan: plan([FILL, SENT, DICT]), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
  let page = env.page;
  assert(await reach(page, 'fill'), 'reached the Spanish fill-in');
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.accent-key')).map(b => b.textContent).join(''));
  assert(/á/.test(keys) && /ñ/.test(keys) && /¿/.test(keys), 'Spanish accent keys under the box: ' + keys);
  await page.evaluate(() => { const i = document.getElementById('fill-input'); i.value = 'habl'; i.focus(); i.setSelectionRange(4, 4); });
  await page.click('.accent-key:has-text("ó")');
  assert(await page.evaluate(() => document.getElementById('fill-input').value) === 'habló', 'an accent key types at the caret');
  await page.evaluate(() => { document.getElementById('fill-input').value = ''; });
  const before = await page.evaluate(() => totalAnswered);
  await typeFill(page, 'hablo');
  let st = await page.evaluate(() => ({ t: totalAnswered, fb: document.getElementById('feedback-box').innerText, dis: document.getElementById('fill-input').disabled }));
  assert(st.t === before && /accents/i.test(st.fb) && !/habló/.test(st.fb) && !st.dis, 'accent-only miss: a prompt, ungraded, answer withheld: ' + st.fb.replace(/\n/g, ' '));
  await typeFill(page, '¡Habló!');
  st = await page.evaluate(() => ({ t: totalAnswered, c: correctCount, fb: document.getElementById('feedback-box').className }));
  assert(st.t === before + 1 && st.c >= 1 && /correct-fb/.test(st.fb), 'then the accented answer counts, punctuation and capitals aside');

  // 2. Sentence builder: tap in, a prompt first, then right.
  assert(await reach(page, 'sentence'), 'reached the sentence builder');
  const sb = await page.evaluate(() => ({ bank: document.querySelectorAll('#sb-bank .sb-word').length, seq: !!document.getElementById('seq-wrap'), dis: document.getElementById('sb-check-btn').disabled }));
  assert(sb.bank === 3 && !sb.seq && sb.dis, 'a word bank, not the ordering list; Check waits for every word');
  const tapWrong = async () => { for (const w of ['pan', 'Ayer', 'comí']) await page.click('#sb-bank .sb-word:text-is("' + w + '")'); };
  await tapWrong();
  const t0 = await page.evaluate(() => totalAnswered);
  await page.click('#sb-check-btn'); await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ t: totalAnswered, fb: document.getElementById('feedback-box').innerText, right: document.querySelectorAll('#sb-line .is-right').length, wrong: document.querySelectorAll('#sb-line .is-wrong').length }));
  assert(st.t === t0 && /in place/i.test(st.fb) && st.right + st.wrong === 3, 'first wrong check marks the line and hands it back: ' + JSON.stringify(st));
  for (let k = 0; k < 3; k++) await page.click('#sb-line .sb-word >> nth=0');
  for (const w of ['Ayer', 'comí', 'pan']) await page.click('#sb-bank .sb-word:text-is("' + w + '")');
  await page.click('#sb-check-btn'); await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ t: totalAnswered, fb: document.getElementById('feedback-box').className, next: document.getElementById('btn-next').disabled }));
  assert(st.t === t0 + 1 && /correct-fb/.test(st.fb) && !st.next, 'the right order counts and Next opens');

  // 3. Dictation with no voice: says so, still answerable as a reading gap.
  assert(await reach(page, 'dictation'), 'reached listen-and-type');
  st = await page.evaluate(() => ({ gap: document.querySelectorAll('.dict-gap').length, text: document.querySelector('.dict-text').innerText, play: !!document.querySelector('.dict-play'), nov: !!document.querySelector('.dict-novoice') }));
  assert(st.gap === 1 && !/vivió/.test(st.text) && /abuelo/.test(st.text), 'the sentence shows with one gap, and not the answer: ' + st.text);
  assert(!st.play && st.nov, 'no voice on this device: no Play button, an honest note');
  await typeFill(page, 'vivio');
  assert(/accents/i.test(await page.evaluate(() => document.getElementById('feedback-box').innerText)), 'the accent prompt works here too');
  await typeFill(page, 'vivió');
  assert(/correct-fb/.test(await page.evaluate(() => document.getElementById('feedback-box').className)), 'and the right word counts');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();

  // 4. Dictation WITH a voice; a second accent miss is graded wrong.
  env = await h.open({ plan: plan([DICT, FILL]), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
  page = env.page;
  await page.evaluate(FAKE_SPEECH);
  /* The fill-in is queued BEFORE the dictation card, so it is done first. */
  assert(await reach(page, 'fill'), 'reached the fill-in');
  await typeFill(page, 'hablo'); await typeFill(page, 'hablo');
  st = await page.evaluate(() => ({ fb: document.getElementById('feedback-box').className, txt: document.getElementById('feedback-box').innerText }));
  assert(/wrong-fb/.test(st.fb) && /habló/.test(st.txt), 'a second accent miss is wrong, and now shows the answer');
  assert(await reach(page, 'dictation'), 'reached listen-and-type (voice)');
  /* The fake voice arrived after the page loaded, so draw the card again. */
  await page.evaluate(() => { const c = window.currentCard; document.getElementById('session-card').innerHTML = renderDictation(c.q); });
  await page.click('.dict-play'); await page.click('.dict-slow');
  const sp = await page.evaluate(() => window.__spoken);
  assert(sp.length === 2 && sp[0].text === 'Mi abuelo vivió en Madrid.' && sp[0].lang === 'es-ES' && sp[1].rate < sp[0].rate, 'Play reads the WHOLE sentence in Spanish, Slower slower: ' + JSON.stringify(sp));
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();

  // 5. A history day with a nationality in its title gets no accent keys.
  env = await h.open({ plan: plan([{ type: 'fill', question: 'The Revolution began in ___.', answer: '1789', explanation: '', difficulty: 'easy' }], 'History: the French Revolution', 'history', 'Causes of the French Revolution'), mock: async () => ({ json: { result: '{"type":"none"}' } }) });
  page = env.page;
  await reach(page, 'fill');
  assert(await page.evaluate(() => document.querySelectorAll('.accent-key').length) === 0, 'no accent keys on a French Revolution history day');
  await env.browser.close();
  // 6. The plan builder asks for dictation and its validator holds the shape.
  {
    const { chromium } = require('./pw'); const fx = require('./fixture');
    const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; let prompt = '';
    pg.on('pageerror', e => errs.push(e.message));
    await pg.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
    await pg.route('**/api/generate', r => {
      const pr = JSON.parse(r.request().postData()).prompt;
      if (/^Draw ONE/.test(pr)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
      prompt = pr;
      const d = JSON.parse(JSON.stringify(fx.plan.days[0])); delete d.completed;
      d.questions = [
        { type: 'dictation', text: 'Mi abuelo vivió en Madrid.', blank: 'vivió', translation: 'My grandfather lived in Madrid.', explanation: '', difficulty: 'easy' },
        { type: 'dictation', text: 'Mi abuelo vivió en Madrid.', blank: 'comió', translation: '', explanation: '', difficulty: 'easy' },
        { type: 'dictation', text: 'Mi abuelo vivió en Madrid.', blank: 'vivió en', translation: '', explanation: '', difficulty: 'easy' },
        { type: 'dictation', text: 'Hola', blank: 'Hola', translation: '', explanation: '', difficulty: 'easy' },
        { type: 'mcq', question: 'What does "ayer" mean?', options: ['yesterday', 'today', 'tomorrow', 'now'], correctIndex: 0, explanation: '', difficulty: 'easy' }];
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(d) }) });
    });
    await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'favicon.png');
    await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ email: 'lang@t.com', tier: 'vip', grade: '7' })); });
    await pg.goto((process.env.SF_BASE || 'http://localhost:8765/') + 'app.html?cb=' + Date.now(), { waitUntil: 'load' });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { document.getElementById('subject-input').value = 'Spanish: preterite verb conjugation'; selectedGoal = 'exam'; selectedDifficulty = 'Medium';
      startGeneration('Conjugate regular verbs in the preterite: hablé, habló, comí, vivió.', 1, new Date(Date.now() + 86400000).toISOString().slice(0, 10), 'vip'); });
    let qs = null;
    for (let i = 0; i < 100 && !qs; i++) { await pg.waitForTimeout(150); qs = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('sfu:lang@t.com|studyflow_plan')).days[0].questions; } catch (e) { return null; } }).catch(() => null); }
    assert(/"type":"dictation"/.test(prompt) && /Listen and type/.test(prompt), 'the Spanish grammar prompt asks for listen-and-type');
    const d = (qs || []).filter(q => q.type === 'dictation');
    assert(d.length === 1 && d[0].blank === 'vivió', 'the validator keeps the good dictation and drops a blank not in the sentence, a two-word blank and a one-word "sentence" (' + d.length + ' kept)');
    assert(errs.length === 0, 'plan builder: no page errors ' + errs.join('|'));
    await b.close();
  }
  console.log(fails ? fails + ' FAILED' : 'LANGUAGE OK');
})();

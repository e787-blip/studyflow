// Every language the app knows, through the real plan builder and the real
// lesson page: is the plan filed as a language, do the validators keep its
// fill-in, dictation, sentence builder and recall, and does each render and
// grade a right answer as right? Oct 2026: Chinese and Japanese lost every
// fill-in and dictation to length and spacing rules, French lost a dictation
// on an elided word, and Russian, Hawaiian and Hindi plans were not language
// plans at all.
const { chromium } = require('./pw');
const BASE = process.env.SF_BASE || 'http://localhost:8765/';
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const KEYS = { es: 1, fr: 1, de: 1, it: 1, pt: 1, haw: 1, tr: 1 };
const L = [
 // subject, fill [q, answer, wrongMarks], dictation [text, blank], sentence words, recall items
 ['Spanish: present tense', ['Ella ___ en Madrid.', 'vive', ''], ['¿Tú comes en casa?', 'comes'], ['Nosotros', 'hablamos', 'español'], ['hablo', 'hablas', 'habla']],
 ['French: the passé composé', ['Elle a ___ une pomme. (manger)', 'mangé', 'mange'], ['Nous allons à la plage demain.', 'demain'], ['Je', 'parle', 'français'], ['je suis', 'tu es', 'il est']],
 ['French elision probe', ['Je vais à ___ . (école)', "l'école", 'lecole'], ["Nous allons à l'école demain.", 'école'], ['Je', 'suis', 'là'], ['un', 'deux', 'trois']],
 ['German: articles and cases', ['Das ___ liest ein Buch.', 'Mädchen', 'Madchen'], ['Wir spielen heute Fußball.', 'Fußball'], ['Ich', 'habe', 'einen', 'Hund'], ['der', 'die', 'das']],
 ['Italian: regular verbs', ['Lei ___ a Roma. (abitare)', 'abita', ''], ['Domani andiamo al mercato.', 'andiamo'], ['Io', 'parlo', 'italiano'], ['io', 'tu', 'lui']],
 ['Portuguese: everyday phrases', ['Eu ___ água. (beber)', 'bebo', ''], ['Nós falamos português em casa.', 'português'], ['Eu', 'falo', 'português'], ['um', 'dois', 'três']],
 ['Latin: first declension nouns', ['Agricola ___ amat. (puella)', 'puellam', ''], ['Puella aquam portat.', 'aquam'], ['Puella', 'aquam', 'portat'], ['puella', 'puellae', 'puellam']],
 ['Japanese: hiragana basics', ['わたしは ___ です。(student)', 'がくせい', 'かくせい'], ['わたしは がくせい です。', 'がくせい'], ['わたしは', 'がくせい', 'です'], ['あ', 'い', 'う']],
 ['Japanese: kanji, no spaces', ['私は___です。', '学生', ''], ['私は学生です。', '学生'], ['私は', '学生', 'です'], ['一', '二', '三']],
 ['Chinese: Mandarin greetings', ['我___学生。', '是', ''], ['我是学生。', '学生'], ['我', '是', '学生'], ['一', '二', '三']],
 ['Korean: polite verbs', ['저는 사과를 ___. (eat)', '먹어요', ''], ['저는 사과를 먹어요.', '먹어요'], ['저는', '사과를', '먹어요'], ['하나', '둘', '셋']],
 ['Arabic: greetings', ['أنا ___ في المدرسة.', 'طالب', ''], ['أنا طالب في المدرسة.', 'طالب'], ['أنا', 'طالب', 'هنا'], ['واحد', 'اثنان', 'ثلاثة']],
 ['Russian: present tense verbs', ['Я ___ книгу. (read)', 'читаю', ''], ['Я читаю интересную книгу.', 'читаю'], ['Я', 'читаю', 'книгу'], ['один', 'два', 'три']],
 ['Hawaiian: everyday words', ['Ua hele au i ke ___. (school)', 'kula', ''], ['Ua hele au i ke kula.', 'kula'], ['Ua', 'hele', 'au'], ['ʻekahi', 'ʻelua', 'ʻekolu']],
 ['Turkish: city names', ['Türkiye\'nin en büyük şehri ___ şehridir.', 'İstanbul', 'Istanbul'], ['Ben her gün okula gidiyorum.', 'okula'], ['Ben', 'okula', 'gidiyorum'], ['bir', 'iki', 'üç']],
 ['Greek: the alphabet', ['Το όνομά μου ___ Νίκος.', 'είναι', ''], ['Εγώ μένω στην Αθήνα.', 'Αθήνα'], ['Εγώ', 'μένω', 'εδώ'], ['άλφα', 'βήτα', 'γάμμα']],
 ['Hindi: everyday sentences', ['मैं स्कूल ___ हूँ।', 'जाता', ''], ['मैं स्कूल जाता हूँ।', 'जाता'], ['मैं', 'स्कूल', 'जाता', 'हूँ'], ['एक', 'दो', 'तीन']],
];
function day(l) {
  const [subj, f, d, s, r] = l;
  const base = { hint: 'Look back.', explanation: 'Because.', difficulty: 'Medium' };
  return { title: subj, content: 'Notes for ' + subj, steps: [], keyTerms: [], concepts: [], misconceptions: [],
    questions: [
      Object.assign({ type: 'fill', question: f[0], answer: f[1] }, base),
      Object.assign({ type: 'dictation', question: 'Listen and type the missing word.', text: d[0], blank: d[1], translation: 'x' }, base),
      Object.assign({ type: 'sentence', question: 'Build the sentence.', words: s, translation: 'meaning' }, base),
      Object.assign({ type: 'recall', question: 'Name all three.', items: r, need: 3 }, base),
      Object.assign({ type: 'mcq', question: 'Pick one', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }, base)] };
}
(async () => {
  const b = await chromium.launch(); const rows = [];
  for (const l of L) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
    await page.route('**/api/generate', r => {
      const p = JSON.parse(r.request().postData()).prompt;
      if (/^Map the study notes/.test(p)) return r.fulfill({ status: 502, body: '{}' });
      if (/^Draw ONE/.test(p)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: '{"type":"none"}' }) });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify(day(l)) }) });
    });
    await page.goto(BASE + 'favicon.png');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ email: 'lg@t.com', tier: 'vip', grade: '7' })); localStorage.setItem('studyflow_onboarded', '1'); });
    await page.goto(BASE + 'app.html?cb=' + Date.now(), { waitUntil: 'load' }); await page.waitForTimeout(300);
    const cls = await page.evaluate(([s, n]) => classifySubject(s, n), [l[0], l[0]]);
    await page.evaluate((s) => { document.getElementById('subject-input').value = s; selectedGoal = 'exam'; selectedDifficulty = 'Medium';
      startGeneration('Notes: ' + s, 1, new Date(Date.now() + 86400000).toISOString().slice(0, 10), 'vip'); }, l[0]);
    let plan = null;
    for (let i = 0; i < 120 && !plan; i++) { await page.waitForTimeout(150); plan = await page.evaluate(() => { try { const p = JSON.parse(localStorage.getItem('sfu:lg@t.com|studyflow_plan')); return p && p.days && p.days.length ? p : null; } catch (e) { return null; } }).catch(() => null); }
    const row = { subj: l[0], cls, saved: plan ? plan.days[0].questions.map(q => q.type).join(',') : 'NO PLAN' };
    if (plan) {
      await page.goto(BASE + 'lesson.html?cb=' + Date.now(), { waitUntil: 'load' }); await page.waitForTimeout(1200);
      row.lang = await page.evaluate(() => JSON.stringify(targetLang()));
      const n = await page.evaluate(() => sessionCards.length);
      for (let k = 0; k < n + 2; k++) {
        const c = await page.evaluate(() => ({ t: currentCard && currentCard.type, qt: currentCard && currentCard.q && currentCard.q.type, pre: !!(currentCard && currentCard.isPretest) })).catch(() => ({}));
        if (!c.t) break;
        if (!c.pre && (c.t === 'fill' || c.t === 'dictation') && !row[c.t]) {
          const info = await page.evaluate(() => ({ gap: !!document.querySelector('.dict-gap'), keys: [...document.querySelectorAll('.accent-key')].map(x => x.textContent).join(''), voice: !!document.querySelector('.dict-play'), dir: getComputedStyle(document.querySelector('.dict-text') || document.body).direction }));
          const ans = c.t === 'fill' ? l[1][1] : l[2][1], wrongMark = c.t === 'fill' ? l[1][2] : '';
          let prompt = '';
          if (wrongMark) {
            await page.evaluate((v) => { document.getElementById('fill-input').value = v; answerFillBtn(); }, wrongMark); await page.waitForTimeout(150);
            prompt = await page.evaluate(() => (document.getElementById('feedback-box') || {}).textContent || '');
          }
          const c0 = await page.evaluate(() => correctCount);
          const locked = await page.evaluate(() => document.getElementById('fill-input').disabled);
          if (!locked) { await page.evaluate((v) => { document.getElementById('fill-input').value = v; answerFillBtn(); }, ans); await page.waitForTimeout(150); }
          else prompt = 'GRADED-WRONG ' + prompt.slice(0, 40);
          const c1 = await page.evaluate(() => correctCount);
          row[c.t] = (info.gap ? 'gap ' : (c.t === 'dictation' ? 'NO-GAP(fell back to fill) ' : '')) + 'keys[' + info.keys + '] ' + (c.t === 'dictation' ? (info.voice ? 'voice ' : 'no-voice ') + 'dir=' + info.dir + ' ' : '') +
            (wrongMark ? 'markOnlyMiss=' + (/accent|Almost/i.test(prompt) ? 'prompt' : 'graded-wrong') + ' ' : '') + 'correctGraded=' + (c1 > c0);
        }
        if (c.t === 'sentence' && !row.sentence) {
          const words = l[3]; const c0 = await page.evaluate(() => correctCount);
          for (const w of words) await page.evaluate((w) => { const bt = [...document.querySelectorAll('#sb-bank .sb-word')].find(x => x.textContent === w); if (bt) bt.click(); }, w);
          await page.evaluate(() => { const x = document.getElementById('sb-check-btn'); if (x) x.click(); }); await page.waitForTimeout(150);
          row.sentence = 'correctGraded=' + ((await page.evaluate(() => correctCount)) > c0) + ' line="' + (await page.evaluate(() => document.getElementById('sb-line').textContent)) + '"';
        }
        if (c.t === 'recall' && !row.recall) {
          const c0 = await page.evaluate(() => correctCount);
          await page.evaluate((items) => { const ins = document.querySelectorAll('.rc-in'); items.forEach((v, i) => { if (ins[i]) { ins[i].value = v; ins[i].dispatchEvent(new Event('input', { bubbles: true })); } }); document.getElementById('rc-check-btn').click(); }, l[4]);
          await page.waitForTimeout(150);
          row.recall = 'correctGraded=' + ((await page.evaluate(() => correctCount)) > c0) + ' keys[' + (await page.evaluate(() => [...document.querySelectorAll('.accent-key')].map(x => x.textContent).join(''))) + ']';
        }
        await page.evaluate(() => showNextCard()); await page.waitForTimeout(80);
      }
    }
    row.errors = errs.join('|');
    rows.push(row);
    const code = row.lang ? (JSON.parse(row.lang) || {}).code : '';
    const ok = row.cls === 'language' && row.saved === 'fill,dictation,sentence,recall,mcq' && !row.errors &&
      ['fill', 'dictation', 'sentence', 'recall'].every(k => /correctGraded=true/.test(row[k] || '')) && /^gap /.test(row.dictation || '') &&
      (!KEYS[code] || /keys\[[^\]]+\]/.test(row.fill)) && !/markOnlyMiss=graded-wrong/.test(row.fill) &&
      /dir=(\w+)/.exec(row.dictation || 'dir=x')[1] === (code === 'ar' ? 'rtl' : 'ltr');
    assert(ok, l[0] + (ok ? '' : '  ' + JSON.stringify(row)));
    await ctx.close();
  }
  // Filing: a language only when the title leads with it.
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.route(/cdnjs|gstatic|googleapis|jsdelivr/, r => r.abort());
  await p.goto(BASE + 'favicon.png'); await p.evaluate(() => localStorage.setItem('studyflow_user', JSON.stringify({ email: 'c@t.com', tier: 'vip', grade: '7' })));
  await p.goto(BASE + 'app.html?cb=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(300);
  const CL = [['history', 'The Russian Revolution', 'In 1917 the tsar fell.'], ['history', 'Hawaiian history: the overthrow of the monarchy', 'In 1893 the queen was overthrown.'],
    ['history', 'Causes of the French Revolution', 'The Bastille.'], ['history', 'The Dutch East India Company', 'A trade empire in the 1600s.'],
    ['history', 'The Ottoman Empire and the Turkish republic', 'The republic in 1923.'], ['history', 'Russian history: the tsars', 'Peter the Great ruled the empire.'],
    ['language', 'Mandarin tones', 'Four tones.'], ['language', 'Learning Turkish', 'Merhaba'], ['language', 'Dutch: everyday phrases', 'Goedemorgen'], ['language', 'Hebrew 1', 'shalom']];
  for (const [want, s, n] of CL) { const got = await p.evaluate(([s, n]) => classifySubject(s, n), [s, n]); assert(got === want, '"' + s + '" is ' + want + (got === want ? '' : ' (got ' + got + ')')); }
  const ng = await p.evaluate(() => ['Greek mythology', 'Thai food and culture', 'Native Hawaiian culture and the kingdom'].filter(s => classifySubject(s, s) === 'language'));
  assert(ng.length === 0, 'a culture or myth title is not a language course ' + ng.join(', '));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'LANGUAGES OK');
})();

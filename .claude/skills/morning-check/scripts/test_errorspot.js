// Find the mistake: a wrong tap turns that step red and ONLY the mistake green.
// The card used to find the mistake by searching each step's onclick source for
// "true" - and the explanation is written into that source, so "It is not true
// that..." turned every other step green.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

(async () => {
  const env = await h.open({ width: 390, mock: () => ({ json: { result: '{"type":"none"}' } }) });
  const r = await env.page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    sessionActive = true;
    const steps = [{ text: '3x + 4 = 19', hasError: false }, { text: '3x = 19 + 4', hasError: true }, { text: 'x = 23 / 3', hasError: false }, { text: 'check it', hasError: false }];
    async function run(explanation, tap) {
      currentAnswered = false;
      sessionCards = [{ type: 'errorspot', q: { type: 'errorspot', question: 'Find the mistake', steps, explanation } }];
      cardIndex = 0; showNextCard(); await wait(600);
      const right = correctCount, total = totalAnswered;
      document.querySelectorAll('#session-card .error-step-btn')[tap].click(); await wait(500);
      return {
        marks: [...document.querySelectorAll('#session-card .error-step-btn')].map((b) => b.classList.contains('sel-right') ? 'green' : b.classList.contains('sel-wrong') ? 'red' : '-').join(' '),
        scored: (correctCount - right) + '/' + (totalAnswered - total),
        feedback: (document.getElementById('feedback-box') || {}).textContent || ''
      };
    }
    return {
      plain: await run('Subtract 4 from both sides.', 0),
      word: await run('It is not true that you add 4.', 0),
      found: await run('It is true that 4 should be subtracted.', 1),
      quotes: await run('Don\'t add 4; "subtract" it. true', 2)
    };
  });
  assert(r.plain.marks === 'red green - -' && r.plain.scored === '0/1', 'a wrong tap: that step red, the mistake green (' + r.plain.marks + ')');
  assert(r.word.marks === 'red green - -', 'an explanation with the word "true" marks no other step (' + r.word.marks + ')');
  assert(r.found.marks === '- green - -' && r.found.scored === '1/1', 'finding the mistake: only that step, scored right (' + r.found.marks + ', ' + r.found.scored + ')');
  assert(r.quotes.marks === '- green red -' && /subtract/.test(r.quotes.feedback), 'quotes in the explanation still work (' + r.quotes.marks + ')');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();
  console.log(fails ? fails + ' FAILED' : 'ERRORSPOT OK');
})();

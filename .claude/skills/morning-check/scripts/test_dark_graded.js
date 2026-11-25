// A graded answer stays readable. The equation, fill-in, system and
// find-the-mistake cards set pale green and red backgrounds inline, so in dark
// mode the learner's own answer was near-white text on a pale box.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

(async () => {
  for (const dark of [true, false]) {
    const env = await h.open({ width: 390, dark, mock: () => ({ json: { result: '{"type":"none"}' } }) });
    const r = await env.page.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      sessionActive = true;
      /* WCAG contrast of an element's text against everything painted behind it. */
      const rgba = (s) => { const n = (s.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number); return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1]; };
      const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));
      const lum = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (el) => {
        const chain = []; for (let n = el; n; n = n.parentElement) chain.push(rgba(getComputedStyle(n).backgroundColor));
        let back = [255, 255, 255]; for (let i = chain.length - 1; i >= 0; i--) back = over(chain[i], back);
        const text = over(rgba(getComputedStyle(el).color), back);
        const a = lum(text), b = lum(back); return Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 10) / 10;
      };
      async function open(type, q) {
        currentAnswered = false; fillAttempts = 0;
        sessionCards = [{ type, q: Object.assign({ type, difficulty: 'Easy', explanation: 'Because.', hint: 'h' }, q) }, { type, q }];
        cardIndex = 0; showNextCard(); await wait(700);
      }
      const $ = (s) => document.querySelector('#session-card ' + s);
      const all = (s) => [...document.querySelectorAll('#session-card ' + s)];
      async function submit(v) { const i = document.getElementById('fill-input'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); answerFillBtn(); await wait(900); return i; }
      const out = {};
      const eq = { question: 'Solve for x', equation: '2x + 7 = 19', answer: '6' };
      await open('bigequation', eq);
      let i = await submit('9'); i.blur(); await wait(300); out.retry = ratio(i);
      i = await submit('6'); out.right = ratio(i); out.rightMarked = getComputedStyle(i).borderTopColor;
      await open('bigequation', eq);
      for (let n = 0; n < MAX_FILL_TRIES; n++) i = await submit(String(20 + n));
      out.wrong = ratio(i); out.wrongMarked = getComputedStyle(i).borderTopColor;
      await open('fill', { question: 'Plants make food by ___.', answer: 'photosynthesis' });
      i = await submit('digestion'); await wait(400); out.fill = ratio(i);
      await open('bigequation', { question: 'Solve the system', equation: 'x + y = 5; x - y = 1', answer: 'x = 3, y = 2' });
      let boxes = all('.mx-var-in');
      boxes.forEach((b, k) => { b.value = ['3', '2'][k]; b.dispatchEvent(new Event('input', { bubbles: true })); });
      answerFillBtn(); await wait(900);
      out.system = Math.min.apply(null, boxes.map(ratio)); out.systemMarked = getComputedStyle(boxes[0]).borderTopColor;
      const steps = [{ text: '3x + 4 = 19', hasError: false }, { text: '3x = 19 + 4', hasError: true }, { text: 'x = 23 / 3', hasError: false }];
      await open('errorspot', { question: 'Find the mistake', steps, explanation: 'It is not true that you add 4: subtract it.' });
      all('.error-step-btn')[0].click(); await wait(900);
      out.steps = Math.min.apply(null, all('.error-step-btn').slice(0, 2).map(ratio));
      return out;
    });
    const t = dark ? '[dark] ' : '[light] ';
    const green = (c) => { const n = c.match(/\d+/g).map(Number); return n[1] > n[0] + 40; };
    const red = (c) => { const n = c.match(/\d+/g).map(Number); return n[0] > n[1] + 40; };
    assert(r.retry >= 4.5, t + 'an equation answer with a try left is readable (' + r.retry + ':1)');
    assert(r.right >= 4.5 && green(r.rightMarked), t + 'a right answer is readable and marked green (' + r.right + ':1, ' + r.rightMarked + ')');
    assert(r.wrong >= 4.5 && red(r.wrongMarked), t + 'a wrong answer is readable and marked red (' + r.wrong + ':1, ' + r.wrongMarked + ')');
    assert(r.fill >= 4.5, t + 'a graded fill-in is readable (' + r.fill + ':1)');
    assert(r.system >= 4.5 && green(r.systemMarked), t + 'the x and y boxes of a system are readable and marked (' + r.system + ':1, ' + r.systemMarked + ')');
    assert(r.steps >= 4.5, t + 'find the mistake: the picked and the right step are readable (' + r.steps + ':1)');
    assert(env.errors.length === 0, t + 'no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }
  console.log(fails ? fails + ' FAILED' : 'DARK GRADED OK');
})();

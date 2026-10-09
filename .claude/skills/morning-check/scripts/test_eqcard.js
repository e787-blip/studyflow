// The equation card (renderBigEquation) says each thing once. It used to put
// "Evaluate: 2x + 5 when x = 4" in the header AND in a 2.4rem Georgia box
// that wrapped to two lines, add an instruction line repeating the header,
// and ask "x = ?" on a question with nothing to solve for.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const base = { type: 'bigequation', difficulty: 'Easy', explanation: 'x', hint: 'Work it through.' };
(async () => {
  for (const dark of [false, true]) {
    const env = await h.open({ width: 390, dark, mock: () => ({ json: { result: '{"type":"none"}' } }) });
    const p = env.page;
    const card = (q) => p.evaluate((q) => {
      sessionActive = true; var sc = document.getElementById('session-card'); sc.innerHTML = renderBigEquation(q);
      var ex = sc.querySelector('.mx-expr'), inp = sc.querySelector('#fill-input'), lh = ex ? parseFloat(getComputedStyle(ex).lineHeight) : 0;
      var panel = sc.querySelector('.mx-panel');
      return { title: sc.querySelector('.card-header h2').textContent, expr: ex ? ex.textContent : '', cond: (sc.querySelector('.mx-cond') || {}).textContent || '',
        lines: ex ? Math.round(ex.getBoundingClientRect().height / lh) : 0, ph: inp.placeholder, mode: inp.getAttribute('inputmode'),
        body: sc.querySelector('.card-body').textContent, img: !!sc.querySelector('img'), bg: panel ? getComputedStyle(panel).backgroundColor : '',
        cardBg: getComputedStyle(sc.querySelector('.session-card')).backgroundColor };
    }, Object.assign({}, base, q));
    const t = dark ? '[dark] ' : '';
    const a = await card({ question: 'Evaluate: 2x + 5 when x = 4', answer: '13' });
    assert(a.title === 'Evaluate' && a.expr === '2x + 5' && a.cond === 'when x = 4', t + 'evaluate: the header is the instruction, the panel the maths, the given value under it (' + a.title + ' / ' + a.expr + ' / ' + a.cond + ')');
    assert(a.lines === 1 && a.ph === 'Your answer' && a.mode === 'decimal' && a.body.indexOf('Evaluate') === -1 && !/step by step/.test(a.body), t + 'one line, no "x = ?", no instruction line repeating the header (' + a.lines + ' lines, "' + a.ph + '")');
    const b = await card({ question: 'Solve for y: 5y − 3 = 2y + 9', answer: '4' });
    assert(b.title === 'Solve for y' && b.ph === 'y = ?' && b.lines === 1, t + 'solve for y asks "y = ?" (' + b.title + ', ' + b.ph + ')');
    const c = await card({ question: 'Solve for x', equation: '3x + 7 = 22', answer: '5' });
    assert(c.title === 'Solve for x' && c.expr === '3x + 7 = 22' && c.ph === 'x = ?', t + 'a separate equation is the panel, the question the header');
    const d = await card({ question: 'Simplify: 4(x + 3) - 2x', answer: '2x + 12' });
    assert(d.title === 'Simplify' && d.mode === 'text' && d.expr === '4(x + 3) − 2x', t + 'an answer with letters gets a keyboard with letters; a hyphen is shown as a minus (' + d.mode + ', ' + d.expr + ')');
    const e = await card({ question: 'Solve for x: 3(2x − 4) + 5 = 4(x + 1) − 7', answer: '3' });
    assert(e.lines === 1, t + 'a long equation still fits one line at 390px (' + e.lines + ')');
    const f = await card({ question: 'f(x) = 2x + 1. Find f(3).', answer: '7' });
    assert(f.expr === 'f(x) = 2x + 1' && f.cond === 'Find f(3)' && f.ph === 'f(3) = ?', t + 'a function: the definition, then what to find (' + f.ph + ')');
    const g = await card({ question: 'Find the derivative of 3x^2 + 2x', answer: '6x + 2' });
    assert(g.expr === '3x² + 2x' && !/Power rule/.test(g.body.split('Show steps')[0]), t + 'x^2 shows as x², and the calculus rules wait in the hint');
    const x = await card({ question: 'Evaluate: <img src=x onerror="window.__pwn=1"> when x = 4', answer: '1' });
    assert(!x.img && !(await p.evaluate(() => window.__pwn)), t + 'model text is escaped in the header and the panel');
    if (dark) assert(a.bg !== a.cardBg && a.bg !== 'rgb(15, 17, 23)', 'dark mode: the panel is lifted off the card, not a hole in it (' + a.bg + ')');
    assert(env.errors.length === 0, t + 'no page errors ' + env.errors.join('|'));
    await env.browser.close();
  }
  console.log(fails ? fails + ' FAILED' : 'EQCARD OK');
})();

// Every reachable board at a real card width; text size from each <text>'s screen CTM once transitions settle.
const h = require('./harness');
const FX = require('./fixtures_more');
const VW = +(process.argv[2] || 375);
(async () => {
  const { page, browser, errors } = await h.open({ width: VW, mock: async () => ({ json: { result: '{"type":"none"}' } }) });
  const names = await page.evaluate(({ FX }) => {
    const WB = window.SFWhiteboard, W = document.getElementById('session-card').clientWidth, names = [];
    const wrap = document.createElement('div'); wrap.id = 'bs-wrap'; wrap.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px'; document.body.appendChild(wrap);
    function add(name, spec) { if (!spec) return; const host = document.createElement('div'); host.setAttribute('data-name', name); wrap.appendChild(host); try { if (WB.render(host, spec, function () {})) names.push(name); } catch (e) { names.push(name + ' THREW ' + e.message); } }
    const dayS = FX[0].days[0];
    [{ type: 'mcq', question: 'Why do veins need valves?', options: ['To speed blood up', 'To stop blood flowing backwards'], correctIndex: 1, explanation: 'Blood in veins is at low pressure, so valves shut behind it and stop it sliding back.' },
     { type: 'bigequation', question: 'Solve for x', equation: 'x + 7 = 15', answer: '8', explanation: 'Subtract 7 from both sides.' },
     { type: 'wordproblem', scenario: 'A taxi charges $3 plus $2 per mile. The fare was $11.', question: 'How many miles?', answer: '4', explanation: '11 - 3 = 8, 8 / 2 = 4.' }].forEach(q => add('walkthrough/' + q.type, WB.fromWrongAnswer(q, dayS)));
    add('opening/math', WB.workedInstanceFor(FX[1].days[0], 'math'));
    add('brief/science', WB.briefFor(FX[0].days[0], 'science'));
    add('opening/econ', WB.workedInstanceFor({ title: 'Opportunity cost', content: 'x', workedExample: { problem: 'Maya picks a movie over studying', steps: [{ title: 'Notice', line: 'She gives up two hours of study', why: 'Time spent on one thing cannot be spent on another' }, { title: 'Name it', line: 'The study time is the cost', why: 'The next best choice is what you give up' }] } }, 'economics'));
    return names;
  }, { FX });
  await page.waitForTimeout(1600);
  const res = await page.evaluate(() => Array.from(document.querySelectorAll('#bs-wrap > div')).map(host => {
    const board = host.querySelector('svg.sfb-svg'); if (!board) return { name: host.getAttribute('data-name'), none: true };
    let bmin = 99, pmin = 99, pn = 0, pSmall = [];
    board.querySelectorAll('text').forEach(t => {
      if (!t.textContent.trim()) return;
      const cs = getComputedStyle(t); if (cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const m = t.getScreenCTM(); if (!m) return;
      const px = parseFloat(cs.fontSize) * Math.sqrt(m.a * m.a + m.b * m.b);
      if (t.ownerSVGElement !== board) { pn++; if (px < pmin) pmin = px; if (px < 9) pSmall.push(t.textContent.slice(0, 20) + '@' + px.toFixed(1)); }
      else if (px < bmin) bmin = px;
    });
    return { name: host.getAttribute('data-name'), boardMin: +bmin.toFixed(1), pics: pn, picMin: pn ? +pmin.toFixed(1) : null, picSmall: pSmall.slice(0, 4) };
  }));
  res.forEach(r => console.log(JSON.stringify(r)));
  console.log(errors.join('\n') || 'no page errors');
  await browser.close();
})();

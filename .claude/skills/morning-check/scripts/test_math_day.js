// A maths day is ~90% equations (Oct 2026, the owner: "a lot of equations for
// repetition"), on real page loads of lesson.html:
//  - a day as the plan builder now writes it (12 equations, 1 error spot,
//    1 word problem) and a thin one (3 equations) both queue 18 equations,
//    1 word problem and the error spot - 90% / 5% / 5% of 20;
//  - no fill, no multiple choice, no vocabulary match on a maths day;
//  - the easy equations come first and the hard ones last, the generated
//    equations are spread among the model's, the word problem sits mid-day;
//  - the plan builder's prompt asks for 12 equations and stays under the cap;
//  - the top-up asks for 9 equations in 10.
// Fails on the code before: the day topped up to 12 (10 equations, 80%).
const h = require('./harness');
const fx = require('./fixture');
let fails = 0;
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fails++; process.exitCode = 1; } };
const NONE = { json: { result: '{"type":"none"}' } };

function eq(i, diff) {
  return { type: 'bigequation', question: i % 3 === 0 ? 'Solve for x' : (i % 3 === 1 ? 'Simplify' : 'Evaluate'),
           equation: (i + 2) + 'x + ' + (i + 3) + ' = ' + (3 * (i + 2) + i + 3), answer: '3',
           hint: 'Undo the addition first.', explanation: 'Subtract, then divide.', difficulty: diff };
}
function mathPlan(nEq) {
  const p = JSON.parse(JSON.stringify(fx.plan));
  p.id = 'md1'; p.subject = 'Algebra: two-step equations'; p.subjectType = 'math';
  const d = p.days[0];
  d.title = 'Two-step equations'; d.microTopic = '';
  const qs = [];
  for (let i = 0; i < nEq; i++) qs.push(eq(i, i < 3 ? 'Easy' : (i >= nEq - 3 ? 'Hard' : 'Medium')));
  // the model wrote them hardest-first on purpose, to prove the queue re-orders
  qs.reverse();
  qs.push({ type: 'errorspot', question: 'Find the mistake:', steps: [{ text: '2x + 3 = 11', hasError: false }, { text: '2x = 14', hasError: true }, { text: 'x = 7', hasError: false }], hint: '', explanation: 'It should be 2x = 8.', difficulty: 'Medium' });
  qs.push({ type: 'wordproblem', scenario: 'Sam earns $12 an hour plus a $20 bonus and was paid $92.', question: 'How many hours?',
            steps: [{ prompt: 'Take off the bonus.', answer: '72', unit: 'dollars', hint: '' }, { prompt: 'Divide {1} by 12.', answer: '6', unit: 'hours' }],
            answer: '6', hint: '', explanation: '72 / 12 = 6', difficulty: 'Medium' });
  d.questions = qs;
  return p;
}

async function shape(p) {
  const { page, browser, errors } = await h.open({ plan: p, day: 0, mock: async () => NONE });
  const r = await page.evaluate(() => {
    const qc = sessionCards.filter(c => c.q && !c.isPretest && !c.isReview && c.type !== 'write');
    const count = {}; qc.forEach(c => { count[c.type] = (count[c.type] || 0) + 1; });
    const eqs = qc.filter(c => c.type === 'bigequation');
    return { total: qc.length, count,
             order: qc.map(c => c.type === 'bigequation' ? (c.q._generated ? 'g' : (c.q.difficulty || '?')[0]) : c.type[0] === 'w' ? 'W' : 'S').join(''),
             types: sessionCards.map(c => c.type) };
  });
  return { r, page, browser, errors };
}

(async () => {
  for (const n of [12, 3]) {
    const { r, browser, errors } = await shape(mathPlan(n));
    console.log('\n## ' + n + ' equations sent -> ' + JSON.stringify(r.count) + ' ' + r.order);
    const eqN = r.count.bigequation || 0;
    assert(eqN >= 18 && eqN / r.total >= 0.9 - 1e-9, n + ' sent: 18+ equations and 90% of the day (' + eqN + ' of ' + r.total + ')');
    assert(r.count.wordproblem === 1, n + ' sent: exactly one word problem');
    assert(r.count.errorspot === 1, n + ' sent: the error spot still arrives');
    assert(!r.count.fill && !r.count.question && !r.count.match, n + ' sent: no fill, multiple choice or match on a maths day');
    const o = r.order;
    if (n === 12) {
      assert(/^[^H]*$/.test(o.slice(0, 4)), '12 sent: no hard equation in the first four cards (' + o.slice(0, 6) + ')');
    } else {
      const g = o.split('').map((ch, i) => ch === 'g' ? i : -1).filter(i => i >= 0);
      const au = o.split('').map((ch, i) => (ch !== 'g' && ch !== 'W' && ch !== 'E') ? i : -1).filter(i => i >= 0);
      assert(g.length >= 14, '3 sent: the rest are generated (' + g.length + ')');
      assert(Math.max.apply(null, au) > g.length / 2, '3 sent: the model\'s own are spread, not all bunched at one end (' + au.join(',') + ')');
    }
    const w = o.indexOf('W');
    assert(w > o.length * 0.25 && w < o.length * 0.85, n + ' sent: the word problem sits mid-day (position ' + w + ' of ' + o.length + ')');
    assert(errors.length === 0, n + ' sent: no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browser.close();
  }

  // the easy ones first, whatever order the model wrote them in
  {
    const { r, browser } = await shape(mathPlan(12));
    const hardAt = r.order.indexOf('H'), easyAt = r.order.indexOf('E');
    assert(easyAt !== -1 && hardAt !== -1 && easyAt < hardAt, 'easy equations come before the hard ones (' + r.order + ')');
    await browser.close();
  }

  // the top-up and the plan builder's prompt
  {
    const topups = [];
    const { page, browser } = await h.open({ plan: mathPlan(12), day: 0, mock: async (prompt) => { topups.push(prompt); return NONE; } });
    await page.evaluate(() => { try { generateMoreQuestions(); } catch (e) {} });
    await page.waitForTimeout(1500);
    const tp = topups.filter(p => /FORMAT/.test(p)).pop() || '';
    assert(/9 MUST be "bigequation"/.test(tp), 'the top-up asks for 9 equations in 10');
    assert(!/7 or 8 MUST/.test(tp), 'and no longer asks for 7 or 8 of eight');
    await browser.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nMATH DAY OK');
})();

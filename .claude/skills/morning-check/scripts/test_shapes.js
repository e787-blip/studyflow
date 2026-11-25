// Shapes and graphs on maths cards (sf-shapes.js). Real lesson page: every
// generator that has a picture draws one, nothing gives the answer away, a
// question the drawing does not fit (a model's) gets none, and the card shows
// it before and after grading.
const h = require('./harness');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };

(async () => {
  const env = await h.open({ width: 375, mock: () => ({ json: { result: '{"type":"none"}' } }) });
  const p = env.page;

  /* ---- 1. every generator, many times ---- */
  const r = await p.evaluate(() => {
    const G = window.SFMathGen, F = window.SFShapes.figure;
    const gens = [genSystemEasy, genSystemSub, genSystemElim];
    Object.keys(G.families()).forEach((k) => G.equations(k).forEach((f) => gens.push(f)));
    const seen = {}, bad = [];
    const head = (g) => g.same ? g.eq : (g.q || (g.sys ? 'Solve the system' : (g.eq.indexOf('=') !== -1 ? 'Solve for x' : 'Simplify')));
    gens.forEach((f) => {
      const c = seen[f.name] = { before: 0, after: 0, wrong: 0, n: 200 };
      for (let i = 0; i < c.n; i++) {
        const g = f(), o = { head: head(g), answer: g.ans };
        const a = F(g.eq, o), b = F(g.eq, Object.assign({ done: true }, o));
        if (a) c.before++; if (b) c.after++;
        if (/NaN|undefined|Infinity/.test(a + b)) bad.push(f.name + ' bad number: ' + g.eq);
        if (/π/.test(String(g.ans)) ? F(g.eq, { head: head(g), answer: '987π' }) : F(g.eq, { head: head(g), answer: '987654' })) {
          // a probability or a line read before grading may not depend on the key; every other drawing must
          c.wrong++;
        }
        if (f.name === 'lnMidpoint') { const m = String(g.eq).replace(/−/g, '-').match(/\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/); if (m[1] === m[3] && m[2] === m[4]) bad.push('midpoint of one point: ' + g.eq); }
        if (f.name === 'geoPolygon' && /\bA octagon\b/.test(g.eq)) bad.push('grammar: ' + g.eq);
      }
    });
    const words = {};
    G.wordFor('all').forEach((f) => {
      const c = words[f.name] = { drawn: 0, n: 200 };
      for (let i = 0; i < c.n; i++) { const w = f(); const s = F(w.scenario, { head: w.question, answer: w.answer }); if (s) c.drawn++; if (/NaN|undefined|Infinity/.test(s)) bad.push(f.name + ' ' + w.scenario); }
    });
    return { seen, words, bad };
  });
  const BEFORE = ['geoRectArea', 'geoRectPerim', 'geoTriArea', 'geoCircle', 'geoPythHyp', 'geoPythLeg', 'geoVolume', 'geoTriAngle', 'geoSupp', 'geoPolygon', 'lnSlope', 'lnMidpoint', 'lnDistance',
    'fracAddSame', 'fracAddUnlike', 'fracSub', 'fracMul', 'fracDiv', 'fracSimplify', 'fracOf', 'pctOf', 'pctWhat', 'pctChange', 'pctWhole', 'pctRate', 'mapScale', 'ratioShare', 'statProb'];
  const AFTER = ['genSystemEasy', 'genSystemSub', 'genSystemElim', 'inA', 'inB', 'inC', 'inD', 'inE', 'inF', 'lnReadSlope', 'lnYAt', 'lnXAt'];
  const short = (names, key) => names.filter((n) => !r.seen[n] || r.seen[n][key] < r.seen[n].n * 0.95).map((n) => n + ' ' + (r.seen[n] ? r.seen[n][key] : 'missing'));
  assert(!short(BEFORE, 'before').length, 'every shape, points, fraction, percent and ratio question is drawn before answering ' + short(BEFORE, 'before').join(', '));
  assert(!short(AFTER, 'after').length, 'systems, inequalities and read-the-line questions are drawn once graded ' + short(AFTER, 'after').join(', '));
  assert(AFTER.every((n) => r.seen[n].before === 0), 'and never before: that picture is the answer ' + AFTER.filter((n) => r.seen[n].before).join(', '));
  const stray = Object.keys(r.seen).filter((n) => BEFORE.indexOf(n) < 0 && AFTER.indexOf(n) < 0 && (r.seen[n].before || r.seen[n].after));
  assert(!stray.length, 'no other equation gets a picture ' + stray.join(', '));
  const loose = BEFORE.filter((n) => n !== 'statProb' && r.seen[n].wrong);
  assert(!loose.length, 'a wrong answer key means no drawing ' + loose.join(', '));
  const WORDS = ['wpGarden', 'wpTrip', 'wpTwoLegs', 'wpUnits', 'wpSquarePark', 'wpFractionOf'];
  assert(WORDS.every((n) => r.words[n] && r.words[n].drawn >= 190), 'six word problems are drawn ' + WORDS.map((n) => n + ' ' + (r.words[n] || {}).drawn).join(', '));
  const halves = await p.evaluate(() => { const f = SFMathGen.wordFor('all').filter((x) => x.name === 'wpUnits')[0]; for (let i = 0; i < 2000; i++) { const w = f(); if (!/^\d+$/.test(String(w.answer))) return w.scenario + ' -> ' + w.answer; } return ''; });
  assert(!halves, 'a ribbon is always cut into a whole number of pieces ' + halves);
  assert(!r.bad.length, 'no bad numbers, no "A octagon", no midpoint of a single point ' + r.bad.slice(0, 3).join(' | '));

  /* ---- 2. questions a model might write ---- */
  const t = await p.evaluate(() => {
    const F = window.SFShapes.figure;
    const f = (text, head, answer, done) => F(text, { head, answer, done });
    return {
      diagonal: f('Rectangle: length 9 cm, width 4 cm', 'Find the diagonal', '9.85'),
      areaOfRight: f('Right triangle: legs 6 and 8', 'Find the area', '24'),
      wrongArea: f('Rectangle: length 9 cm, width 4 cm', 'Find the area', '35'),
      decimal: f('Circle: radius 2.5 cm. Leave your answer in terms of π.', 'Find the area', '6.25π'),
      metres: f('Circle: radius 5 m', 'Find the area', '25π'),
      legsUnits: f('Right triangle: legs 6 cm and 8 cm', 'Find the hypotenuse', '10 cm', true),
      noKey: f('Rectangle: length 9 cm, width 4 cm', 'Find the area', ''),
      hostile: f('Rectangle: length 9 <img src=x onerror=1>, width 4', 'Find the area', '36') + f('There are 2 <script> and 3 blue marbles in a bag. One is picked at random.', 'P', '2/5'),
      hostileAns: f('(1, 2) and (3, 8)', 'Find the slope', '3 <img src=x onerror=1>', true),
      huge: f('x'.repeat(2000), 'Find the area', '1'),
      bags: f('A class of 30 students, 2/5 of them walk to school.', 'How many do not walk?', '18')
    };
  });
  assert(t.diagonal === '' && t.areaOfRight === '' && t.wrongArea === '' && t.bags === '', 'the same words asking something else get no drawing');
  assert(/2\.5 cm/.test(t.decimal), 'a decimal length is read whole');
  assert(t.metres === '' && t.noKey === '' && t.huge === '', 'no drawing for a unit it would mislabel, a card with no key, or a huge text');
  assert(/>10</.test(t.legsUnits), 'units written after the numbers are understood');
  assert(!/<img|<script|onerror/i.test(t.hostile + t.hostileAns), 'model text never becomes markup');

  /* ---- 3. the real cards ---- */
  const cards = await p.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    sessionActive = true;
    async function card(type, q, typed) {
      currentAnswered = false;
      sessionCards = [{ type, q: Object.assign({ type, difficulty: 'Easy', hint: 'h', explanation: 'Because.' }, q) }, { type, q }];
      cardIndex = 0; showNextCard(); await wait(500);
      const sc = document.getElementById('session-card');
      const look = () => {
        const box = sc.querySelector('.sf-shape-box'), svg = box && box.querySelector('svg');
        const shown = !!svg && !box.hidden && box.getBoundingClientRect().height > 40;
        const sizes = shown ? [...svg.querySelectorAll('text')].map((x) => parseFloat(x.getAttribute('font-size')) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width) : [];
        return { shown, words: shown ? [...svg.querySelectorAll('text')].map((x) => x.textContent).join('|') : '', min: Math.min.apply(null, sizes.concat(99)),
          wide: document.documentElement.scrollWidth > window.innerWidth + 1, bg: box ? getComputedStyle(box).backgroundColor : '' };
      };
      const before = look();
      const panel = sc.querySelector('.mx-panel, .mx-prose'), box = sc.querySelector('.sf-shape-box');
      before.above = !!(panel && box && (box.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING));
      before.aid = sc.querySelectorAll('.card-body svg').length;
      /* An equation gives a second try: the first miss must not show the answer's picture. */
      let once = null;
      for (const v of [].concat(typed == null ? [] : typed)) { const i = document.getElementById('fill-input'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); answerFillBtn(); await wait(1400); if (!once) once = look(); }
      return { before, once, after: look() };
    }
    return {
      geo: await card('bigequation', { question: 'Find the area', equation: 'Rectangle: length 9 cm, width 4 cm', answer: '36' }, '36'),
      ineq: await card('bigequation', { question: 'Solve the inequality', equation: '2x ≥ 16', answer: 'x ≥ 8' }, ['x < 8', 'x > 1', 'x < 1'].slice(0, MAX_FILL_TRIES)),
      plain: await card('bigequation', { question: 'Solve for x', equation: '2x + 7 = 19', answer: '6' }, '6'),
      fence: await card('wordproblem', { question: 'How much does the fencing cost?', scenario: 'A rectangular garden is 10 m long and 7 m wide. Fencing costs $4 a metre and goes all the way round the garden.', answer: '136' }, null)
    };
  });
  const g = cards.geo;
  assert(g.before.shown && g.before.above && /9 cm\|4 cm/.test(g.before.words) && !/36/.test(g.before.words), 'geometry card: the shape is above the maths, with the givens and not the answer (' + g.before.words + ')');
  assert(/36 cm²/.test(g.after.words), 'after grading the same drawing carries the answer (' + g.after.words + ')');
  assert(g.before.min >= 9 && !g.before.wide, 'readable on a phone, nothing wider than the screen (smallest ' + g.before.min.toFixed(1) + 'px)');
  assert(!cards.ineq.once.shown, 'the first miss, with another try left, shows no number line');
  assert(!cards.ineq.before.shown && cards.ineq.after.shown && /x ≥ 8/.test(cards.ineq.after.words), 'inequality: nothing before, the number line once graded wrong');
  assert(!cards.plain.before.shown && !cards.plain.after.shown, 'an ordinary equation gets no picture');
  assert(cards.fence.before.shown && /10 m\|7 m/.test(cards.fence.before.words) && cards.fence.before.aid === 1, 'word problem: the garden is drawn, one picture only (' + cards.fence.before.aid + ')');
  assert(env.errors.length === 0, 'no page errors ' + env.errors.join('|'));
  await env.browser.close();

  const dark = await h.open({ width: 390, dark: true, mock: () => ({ json: { result: '{"type":"none"}' } }) });
  const bg = await dark.page.evaluate(async () => {
    sessionActive = true; sessionCards = [{ type: 'bigequation', q: { type: 'bigequation', question: 'Find the hypotenuse', equation: 'Right triangle: legs 6 and 8', answer: '10', difficulty: 'Easy' } }]; cardIndex = 0; showNextCard();
    await new Promise((res) => setTimeout(res, 400));
    const box = document.querySelector('.sf-shape-box'); return box ? getComputedStyle(box).backgroundColor : '';
  });
  const lum = (bg.match(/\d+/g) || [0, 0, 0]).slice(0, 3).reduce((a, v) => a + Number(v), 0) / 765;
  assert(lum > 0.85, 'dark mode: the drawing keeps a paper ground (' + bg + ')');
  assert(dark.errors.length === 0, 'no page errors in dark mode ' + dark.errors.join('|'));
  await dark.browser.close();
  console.log(fails ? fails + ' FAILED' : 'SHAPES OK');
})();

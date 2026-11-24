/* sf-mathgen.js - the made-up maths questions, by topic (Nov 2026).

   The equation card and the word-problem card used to have five one-variable
   equation shapes and four word-problem scenarios, whatever the lesson was
   about. A lesson on quadratics, fractions, inequalities, geometry or
   statistics got "7x = 70" filler. Now a lesson's TITLE picks a family of
   problems:

     SFMathGen.topicFor("Factoring quadratics")  -> "quadratics"
     SFMathGen.equations("quadratics")           -> [function, ...]   (each makes one problem)
     SFMathGen.wordFor("percent")                -> [function, ...]   (each makes one scenario)

   Every generator returns plain data and computes its own answer from the
   numbers it chose, so the answer key is arithmetic, never a guess:

     equation: { eq, ans, why, hint, q, same }
        eq    the problem as shown ("x^2 - 5x + 6 = 0", "(1, 2) and (3, 8)")
        ans   what a learner types ("x = 2 or x = 3", "3", "5/6")
        q     the card's header ("Solve for x", "Find the slope")
        same  true when the question IS the equation (a function definition)
     word problem: { scenario, question, steps[{prompt, answer, unit, hint}], answer, hint, explanation }

   No page, no DOM, no globals except window.SFMathGen, so the whole file runs
   under JavaScriptCore and every generator is tested there. Nothing here
   touches the lesson's grading: the grader reads the answer text (lesson.html:
   sysGrade handles several answers, roots, fractions, inequalities and factors).

   Rules every generator keeps:
   - whole-number or simple-fraction answers; an example that lands on 3.4285
     teaches arithmetic frustration, not the method;
   - a word-problem step prompt states ONE operation over two numbers and avoids
     the words the step checker reads as extra operations (total, each, per,
     rate, sum, plus, minus, difference, remaining, average, share);
   - a header (q) of 28 characters or fewer, or the card drops it. */
(function () {
  'use strict';
  var M = '−';   // a real minus, as the card draws it

  /* ── tiny helpers ─────────────────────────────────────────────────────── */
  function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(a) { return a[ri(0, a.length - 1)]; }
  function nz(lo, hi) { var v = 0; while (v === 0) v = ri(lo, hi); return v; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
  function sg(n) { return n < 0 ? M + (-n) : String(n); }
  function par(n) { return n < 0 ? '(' + M + (-n) + ')' : String(n); }
  function co(n) { return n === 1 ? '' : (n === -1 ? M : (n < 0 ? M + (-n) : String(n))); }
  function plus(n) { return n < 0 ? ' ' + M + ' ' + (-n) : ' + ' + n; }
  /* "ax + b" with the sign and the 1 handled. */
  function lin(a, v, b) { return co(a) + v + (b ? plus(b) : ''); }
  function frac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d); n /= g; d /= g;
    return d === 1 ? String(n) : n + '/' + d;
  }
  /* A decimal from an integer count of 10^-places. */
  function dec(n, places) {
    var neg = n < 0; n = Math.abs(n);
    var s = String(n);
    while (s.length <= places) s = '0' + s;
    var out = s.slice(0, s.length - places) + (places ? '.' + s.slice(s.length - places) : '');
    if (out.indexOf('.') !== -1) out = out.replace(/0+$/, '').replace(/\.$/, '');
    return (neg ? '-' : '') + out;
  }
  /* "x^2 + bx + c" with the signs written out. */
  function quad(b, c) { return 'x^2' + (b ? (b === 1 ? ' + x' : b === -1 ? ' ' + M + ' x' : plus(b).replace(/(\d+)$/, '$1x')) : '') + (c ? plus(c) : ''); }
  function binom(r) { return '(x' + (r < 0 ? ' ' + M + ' ' + (-r) : ' + ' + r) + ')'; }
  function ineqSign() { return pick(['<', '>', '≤', '≥']); }
  function flip(s) { return { '<': '>', '>': '<', '≤': '≥', '≥': '≤' }[s]; }
  function sayIneq(s) { return { '<': 'less than', '>': 'greater than', '≤': 'less than or equal to', '≥': 'greater than or equal to' }[s]; }

  /* ── INTEGERS ─────────────────────────────────────────────────────────── */
  function intAdd() {
    var a = nz(-15, 15), b = nz(-15, 15);
    return { q: 'Evaluate', eq: sg(a) + ' + ' + par(b), ans: String(a + b),
      hint: 'Picture a number line: start at the first number and move by the second.',
      why: 'Start at ' + sg(a) + ' and move ' + Math.abs(b) + (b < 0 ? ' to the left' : ' to the right') + ': ' + sg(a + b) + '.' };
  }
  function intSub() {
    var a = nz(-12, 15), b = nz(-12, 12);
    return { q: 'Evaluate', eq: sg(a) + ' ' + M + ' ' + par(b), ans: String(a - b),
      hint: 'Subtracting a number is the same as adding its opposite.',
      why: 'Subtracting ' + sg(b) + ' is the same as adding ' + sg(-b) + ': ' + sg(a) + ' + ' + par(-b) + ' = ' + sg(a - b) + '.' };
  }
  function intMul() {
    var a = nz(-12, 12), b = nz(-9, 9);
    if (Math.abs(a) === 1) a = 7;
    return { q: 'Evaluate', eq: sg(a) + ' × ' + par(b), ans: String(a * b),
      hint: 'Same signs give a positive answer, different signs a negative one.',
      why: 'Multiply the sizes: ' + Math.abs(a) + ' × ' + Math.abs(b) + ' = ' + Math.abs(a * b) + '. The signs are ' + ((a < 0) === (b < 0) ? 'the same, so it is positive' : 'different, so it is negative') + ': ' + sg(a * b) + '.' };
  }
  function intDiv() {
    var b = nz(-9, 9), k = nz(-12, 12);
    if (Math.abs(b) === 1) b = 4;
    var a = b * k;
    return { q: 'Evaluate', eq: sg(a) + ' ÷ ' + par(b), ans: String(k),
      hint: 'Divide the sizes, then decide the sign: same signs give a positive.',
      why: Math.abs(a) + ' ÷ ' + Math.abs(b) + ' = ' + Math.abs(k) + ', and the signs are ' + ((a < 0) === (b < 0) ? 'the same, so it is positive' : 'different, so it is negative') + ': ' + sg(k) + '.' };
  }
  function intMix() {
    var a = nz(-8, 8), b = nz(2, 9), c = nz(-20, 20);
    return { q: 'Evaluate', eq: sg(a) + ' × ' + b + ' + ' + par(c), ans: String(a * b + c),
      hint: 'Multiply first, then add.',
      why: sg(a) + ' × ' + b + ' = ' + sg(a * b) + ', then ' + sg(a * b) + ' + ' + par(c) + ' = ' + sg(a * b + c) + '.' };
  }

  /* ── ORDER OF OPERATIONS ──────────────────────────────────────────────── */
  function opsA() {
    var a = ri(2, 20), b = ri(2, 9), c = ri(2, 9);
    return { q: 'Evaluate', eq: a + ' + ' + b + ' × ' + c, ans: String(a + b * c),
      hint: 'Multiplication comes before addition.',
      why: 'Multiply first: ' + b + ' × ' + c + ' = ' + (b * c) + '. Then add: ' + a + ' + ' + (b * c) + ' = ' + (a + b * c) + '.' };
  }
  function opsB() {
    var a = ri(2, 9), b = ri(2, 9), c = ri(2, 6), d = ri(1, 9);
    var r = (a + b) * c - d;
    return { q: 'Evaluate', eq: '(' + a + ' + ' + b + ') × ' + c + ' ' + M + ' ' + d, ans: String(r),
      hint: 'Brackets first, then multiply, then subtract.',
      why: 'Brackets: ' + a + ' + ' + b + ' = ' + (a + b) + '. Multiply: ' + (a + b) + ' × ' + c + ' = ' + ((a + b) * c) + '. Subtract: ' + ((a + b) * c) + ' ' + M + ' ' + d + ' = ' + r + '.' };
  }
  function opsC() {
    var c = ri(2, 9), k = ri(2, 9), a = ri(15, 40), d = ri(1, 12);
    var b = c * k;
    return { q: 'Evaluate', eq: a + ' ' + M + ' ' + b + ' ÷ ' + c + ' + ' + d, ans: String(a - k + d),
      hint: 'Division before subtraction and addition; then work left to right.',
      why: 'Divide first: ' + b + ' ÷ ' + c + ' = ' + k + '. Then left to right: ' + a + ' ' + M + ' ' + k + ' = ' + (a - k) + ', and ' + (a - k) + ' + ' + d + ' = ' + (a - k + d) + '.' };
  }
  function opsD() {
    var a = ri(2, 6), b = ri(2, 5), c = ri(1, 9);
    return { q: 'Evaluate', eq: a + ' × ' + b + '^2 + ' + c, ans: String(a * b * b + c),
      hint: 'Exponents first, then multiply, then add.',
      why: 'The exponent first: ' + b + '^2 = ' + (b * b) + '. Then ' + a + ' × ' + (b * b) + ' = ' + (a * b * b) + ', and ' + (a * b * b) + ' + ' + c + ' = ' + (a * b * b + c) + '.' };
  }
  function opsE() {
    var s = ri(2, 6), t = ri(1, 5), d = s + t, k = ri(2, 6), m = ri(2, 5);
    var big = d * k;                                 // d divides it
    return { q: 'Evaluate', eq: big + ' ÷ (' + s + ' + ' + t + ') × ' + m, ans: String((big / d) * m),
      hint: 'Brackets first. Then divide and multiply from left to right.',
      why: 'Brackets: ' + s + ' + ' + t + ' = ' + d + '. Then ' + big + ' ÷ ' + d + ' = ' + k + ', and ' + k + ' × ' + m + ' = ' + (k * m) + '.' };
  }

  /* ── FRACTIONS ────────────────────────────────────────────────────────── */
  function fracPair(sameDen) {
    var dens = [2, 3, 4, 5, 6, 8, 10, 12];
    var b = pick(dens), d = sameDen ? b : pick(dens);
    var a = ri(1, b - 1), c = ri(1, d - 1);
    return { a: a, b: b, c: c, d: d };
  }
  function fracAddSame() {
    var p = fracPair(true), n = p.a + p.c;
    return { q: 'Add the fractions', eq: p.a + '/' + p.b + ' + ' + p.c + '/' + p.d, ans: frac(n, p.b),
      hint: 'The bottoms match, so add the tops and keep the bottom. Then simplify.',
      why: 'Same bottom, so add the tops: ' + p.a + ' + ' + p.c + ' = ' + n + ', giving ' + n + '/' + p.b + (frac(n, p.b) !== n + '/' + p.b ? ', which simplifies to ' + frac(n, p.b) : '') + '.' };
  }
  function fracAddUnlike() {
    var p = fracPair(false), L = lcm(p.b, p.d);
    var n = p.a * (L / p.b) + p.c * (L / p.d);
    return { q: 'Add the fractions', eq: p.a + '/' + p.b + ' + ' + p.c + '/' + p.d, ans: frac(n, L),
      hint: 'Find a common bottom first, then add the tops. Simplify at the end.',
      why: 'A common bottom is ' + L + ': ' + (p.a * (L / p.b)) + '/' + L + ' + ' + (p.c * (L / p.d)) + '/' + L + ' = ' + n + '/' + L + (frac(n, L) !== n + '/' + L ? ', which simplifies to ' + frac(n, L) : '') + '.' };
  }
  function fracSub() {
    var p, L, n, g = 0;
    do { p = fracPair(false); L = lcm(p.b, p.d); n = p.a * (L / p.b) - p.c * (L / p.d); g++; } while ((n <= 0) && g < 40);
    if (n <= 0) { p = { a: 3, b: 4, c: 1, d: 6 }; L = 12; n = 9 - 2; }
    return { q: 'Subtract the fractions', eq: p.a + '/' + p.b + ' ' + M + ' ' + p.c + '/' + p.d, ans: frac(n, L),
      hint: 'Common bottom first, then subtract the tops.',
      why: 'A common bottom is ' + L + ': ' + (p.a * (L / p.b)) + '/' + L + ' ' + M + ' ' + (p.c * (L / p.d)) + '/' + L + ' = ' + n + '/' + L + (frac(n, L) !== n + '/' + L ? ', which simplifies to ' + frac(n, L) : '') + '.' };
  }
  function fracMul() {
    var p = fracPair(false), n = p.a * p.c, d = p.b * p.d;
    return { q: 'Multiply the fractions', eq: p.a + '/' + p.b + ' × ' + p.c + '/' + p.d, ans: frac(n, d),
      hint: 'Multiply the tops, multiply the bottoms, then simplify.',
      why: 'Tops: ' + p.a + ' × ' + p.c + ' = ' + n + '. Bottoms: ' + p.b + ' × ' + p.d + ' = ' + d + '. So ' + n + '/' + d + (frac(n, d) !== n + '/' + d ? ', which simplifies to ' + frac(n, d) : '') + '.' };
  }
  function fracDiv() {
    var p = fracPair(false), n = p.a * p.d, d = p.b * p.c;
    return { q: 'Divide the fractions', eq: p.a + '/' + p.b + ' ÷ ' + p.c + '/' + p.d, ans: frac(n, d),
      hint: 'Keep the first, flip the second, then multiply.',
      why: 'Dividing by ' + p.c + '/' + p.d + ' is multiplying by ' + p.d + '/' + p.c + ': ' + p.a + '/' + p.b + ' × ' + p.d + '/' + p.c + ' = ' + n + '/' + d + (frac(n, d) !== n + '/' + d ? ', which simplifies to ' + frac(n, d) : '') + '.' };
  }
  function fracSimplify() {
    var g = ri(2, 6), a = ri(1, 7), b = ri(a + 1, 9);
    while (gcd(a, b) !== 1) { b++; }
    return { q: 'Simplify the fraction', eq: (a * g) + '/' + (b * g), ans: a + '/' + b,
      hint: 'Divide the top and the bottom by the same number.',
      why: 'Both ' + (a * g) + ' and ' + (b * g) + ' divide by ' + g + ': ' + (a * g) + '/' + (b * g) + ' = ' + a + '/' + b + '.' };
  }
  function fracOf() {
    var d = pick([2, 3, 4, 5, 6, 8, 10]), n = ri(1, d - 1), k = ri(2, 9);
    return { q: 'Find the amount', eq: n + '/' + d + ' of ' + (d * k), ans: String(n * k),
      hint: 'Divide by the bottom, then multiply by the top.',
      why: '1/' + d + ' of ' + (d * k) + ' is ' + (d * k) + ' ÷ ' + d + ' = ' + k + '. So ' + n + '/' + d + ' of it is ' + k + ' × ' + n + ' = ' + (n * k) + '.' };
  }

  /* ── DECIMALS ─────────────────────────────────────────────────────────── */
  function decAdd() {
    var a = ri(101, 999), b = ri(101, 999);
    return { q: 'Evaluate', eq: dec(a, 2) + ' + ' + dec(b, 2), ans: dec(a + b, 2),
      hint: 'Line up the decimal points, then add.',
      why: 'Line up the points and add: ' + dec(a, 2) + ' + ' + dec(b, 2) + ' = ' + dec(a + b, 2) + '.' };
  }
  function decSub() {
    var a = ri(500, 999), b = ri(101, 499);
    return { q: 'Evaluate', eq: dec(a, 2) + ' ' + M + ' ' + dec(b, 2), ans: dec(a - b, 2),
      hint: 'Line up the decimal points, then subtract.',
      why: 'Line up the points and subtract: ' + dec(a, 2) + ' ' + M + ' ' + dec(b, 2) + ' = ' + dec(a - b, 2) + '.' };
  }
  function decMul() {
    var a = ri(11, 99), b = ri(2, 9);
    return { q: 'Evaluate', eq: dec(a, 1) + ' × 0.' + b, ans: dec(a * b, 2),
      hint: 'Multiply as whole numbers, then count the decimal places.',
      why: a + ' × ' + b + ' = ' + (a * b) + '. There are 2 decimal places in all, so the answer is ' + dec(a * b, 2) + '.' };
  }
  function decDiv() {
    var d = ri(2, 9), k = ri(2, 15);
    return { q: 'Evaluate', eq: dec(k * d, 1) + ' ÷ 0.' + d, ans: String(k),
      hint: 'Multiply both numbers by 10 to make the divisor whole.',
      why: 'Multiply both by 10: ' + (k * d) + ' ÷ ' + d + ' = ' + k + '.' };
  }

  /* ── PERCENT ──────────────────────────────────────────────────────────── */
  var PCTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
  function pctOf() {
    var p = pick(PCTS), n = 20 * ri(2, 12);
    return { q: 'Percent of a number', eq: p + '% of ' + n, ans: String(n * p / 100),
      hint: 'Percent means out of 100: change it to a decimal or a fraction first.',
      why: p + '% = ' + p + '/100, and ' + p + '/100 × ' + n + ' = ' + (n * p / 100) + '.' };
  }
  function pctWhat() {
    var p = pick([10, 20, 25, 40, 50, 60, 75]), b = 20 * ri(2, 10), a = p * b / 100;
    return { q: 'Find the percent', eq: 'What percent is ' + a + ' of ' + b + '?', ans: p + '%',
      hint: 'Divide the part by the whole, then multiply by 100.',
      why: a + ' ÷ ' + b + ' = ' + (a / b) + ', and × 100 gives ' + p + '%.' };
  }
  function pctChange() {
    var p = pick([10, 20, 25, 50]), n = 20 * ri(2, 10), up = Math.random() < 0.5;
    var delta = n * p / 100;
    return { q: 'Percent change', eq: (up ? 'Increase ' : 'Decrease ') + n + ' by ' + p + '%', ans: String(up ? n + delta : n - delta),
      hint: 'Find the percent of the number, then add it or take it away.',
      why: p + '% of ' + n + ' is ' + delta + '. ' + (up ? n + ' + ' + delta : n + ' ' + M + ' ' + delta) + ' = ' + (up ? n + delta : n - delta) + '.' };
  }
  function pctWhole() {
    var p = pick([10, 20, 25, 40, 50]), W = 20 * ri(2, 12), part = W * p / 100;
    return { q: 'Find the whole', eq: part + ' is ' + p + '% of what number?', ans: String(W),
      hint: 'If ' + p + '% is ' + part + ', find 1% first, then multiply by 100.',
      why: p + '% is ' + part + ', so 1% is ' + (part / p) + ' and 100% is ' + (part / p) + ' × 100 = ' + W + '.' };
  }
  function pctRate() {
    var p = pick([10, 20, 25, 50]), old = 20 * ri(2, 10), up = Math.random() < 0.5;
    var neu = up ? old + old * p / 100 : old - old * p / 100;
    return { q: 'Percent change', eq: 'From ' + old + ' to ' + neu, ans: p + '%',
      hint: 'Change ÷ original, then × 100.',
      why: 'The change is ' + Math.abs(neu - old) + '. ' + Math.abs(neu - old) + ' ÷ ' + old + ' = ' + (p / 100) + ', which is ' + p + '% ' + (up ? 'more' : 'less') + '.' };
  }

  /* ── RATIOS AND PROPORTIONS ───────────────────────────────────────────── */
  function propSolve() {
    var p = ri(1, 5), q = ri(p + 1, 8), m = ri(2, 5), n = ri(2, 5);
    while (m === n) n = ri(2, 6);
    var x = p * m;
    var left = Math.random() < 0.5;
    return { q: 'Solve the proportion',
      eq: left ? 'x/' + (q * m) + ' = ' + (p * n) + '/' + (q * n) : (q * m) + '/' + (p * m) + ' = ' + (q * n) + '/x',
      ans: left ? String(x) : String(p * n),
      hint: 'Cross-multiply, then divide.',
      why: left ? 'Cross-multiply: x × ' + (q * n) + ' = ' + (q * m) + ' × ' + (p * n) + ', so x = ' + x + '.' :
                  'Cross-multiply: ' + (q * m) + ' × x = ' + (p * m) + ' × ' + (q * n) + ', so x = ' + (p * n) + '.' };
  }
  function ratioSimplify() {
    var g = ri(2, 8), a = ri(1, 6), b = ri(1, 9);
    while (gcd(a, b) !== 1 || a === b) b++;
    return { q: 'Simplify the ratio', eq: (a * g) + ' : ' + (b * g), ans: a + ':' + b,
      hint: 'Divide both numbers by their biggest common factor.',
      why: 'Both divide by ' + g + ': ' + (a * g) + ' : ' + (b * g) + ' = ' + a + ' : ' + b + '.' };
  }
  function unitRate() {
    var r = ri(3, 12), t = ri(3, 9), what = pick([['miles', 'hours'], ['pages', 'minutes'], ['dollars', 'kilograms'], ['metres', 'seconds']]);
    return { q: 'Find the unit rate', eq: (r * t) + ' ' + what[0] + ' in ' + t + ' ' + what[1] + '. How many ' + what[0] + ' in 1?', ans: String(r),
      hint: 'Divide the amount by the number of ' + what[1] + '.',
      why: (r * t) + ' ÷ ' + t + ' = ' + r + ' ' + what[0] + ' in 1 ' + what[1].replace(/s$/, '') + '.' };
  }
  function mapScale() {
    var k = ri(2, 9), c = ri(3, 12);
    return { q: 'Find the real distance', eq: 'Map scale: 1 cm = ' + k + ' km. A road is ' + c + ' cm on the map. How long is it in km?', ans: String(k * c),
      hint: 'Multiply the map length by the scale.',
      why: c + ' cm × ' + k + ' km per cm = ' + (k * c) + ' km.' };
  }
  function ratioShare() {
    var a = ri(1, 6), b = ri(2, 8), k = ri(3, 12);
    while (a === b) b++;
    var big = Math.max(a, b) * k, tot = (a + b) * k;
    return { q: 'Find the larger share', eq: 'Share ' + tot + ' in the ratio ' + a + ' : ' + b + '.', ans: String(big),
      hint: 'Add the parts, divide to find one part, then multiply.',
      why: 'The parts add up to ' + (a + b) + '. One part is ' + tot + ' ÷ ' + (a + b) + ' = ' + k + '. The larger share is ' + Math.max(a, b) + ' × ' + k + ' = ' + big + '.' };
  }

  /* ── EXPONENTS ────────────────────────────────────────────────────────── */
  function expEval() {
    var b = ri(2, 6), e = ri(2, 5);
    while (Math.pow(b, e) > 1300) e--;
    return { q: 'Evaluate', eq: b + '^' + e, ans: String(Math.pow(b, e)),
      hint: 'Multiply ' + b + ' by itself ' + e + ' times.',
      why: b + '^' + e + ' means ' + b + ' multiplied by itself ' + e + ' times: ' + (new Array(e + 1).join(b + ' × ').slice(0, -3)) + ' = ' + Math.pow(b, e) + '.' };
  }
  function expSpecial() {
    var b = ri(2, 9), z = Math.random() < 0.5;
    if (z) return { q: 'Evaluate', eq: b + '^0', ans: '1', hint: 'Anything (not zero) to the power of 0 is 1.', why: 'Any non-zero number to the power 0 is 1, so ' + b + '^0 = 1.' };
    return { q: 'Evaluate', eq: b + '^1', ans: String(b), hint: 'A power of 1 leaves the number as it is.', why: b + '^1 = ' + b + '.' };
  }
  function expNeg() {
    var b = pick([2, 3, 4, 5, 10]), e = ri(1, 3), d = Math.pow(b, e);
    return { q: 'Evaluate', eq: b + '^' + M + e, ans: '1/' + d,
      hint: 'A negative power means one over the positive power.',
      why: b + '^' + M + e + ' = 1/' + b + '^' + e + ' = 1/' + d + '.' };
  }
  function expSum() {
    var a = ri(2, 5), b = ri(2, 5);
    return { q: 'Evaluate', eq: a + '^2 + ' + b + '^2', ans: String(a * a + b * b),
      hint: 'Do each power first, then add.',
      why: a + '^2 = ' + (a * a) + ' and ' + b + '^2 = ' + (b * b) + ', so the answer is ' + (a * a + b * b) + '.' };
  }
  function expNegBase() {
    var b = ri(2, 5), e = pick([2, 3]), r = Math.pow(-b, e);
    return { q: 'Evaluate', eq: '(' + M + b + ')^' + e, ans: String(r),
      hint: 'An even power makes it positive, an odd power keeps the minus.',
      why: '(' + M + b + ')^' + e + ' = ' + b + '^' + e + ' with ' + (e % 2 ? 'a minus (an odd power)' : 'no minus (an even power)') + ' = ' + sg(r) + '.' };
  }
  function expProduct() {
    var a = ri(2, 9), b = ri(2, 9);
    return { q: 'Simplify', eq: 'x^' + a + ' × x^' + b, ans: 'x^' + (a + b),
      hint: 'Same base, so add the powers.',
      why: 'Same base: add the powers, ' + a + ' + ' + b + ' = ' + (a + b) + ', so x^' + (a + b) + '.' };
  }
  function expQuot() {
    var b = ri(2, 6), a = b + ri(2, 6);
    return { q: 'Simplify', eq: 'x^' + a + ' ÷ x^' + b, ans: 'x^' + (a - b),
      hint: 'Same base, so subtract the powers.',
      why: 'Same base: subtract the powers, ' + a + ' ' + M + ' ' + b + ' = ' + (a - b) + ', so x^' + (a - b) + '.' };
  }
  function expPower() {
    var a = ri(2, 5), b = ri(2, 4);
    return { q: 'Simplify', eq: '(x^' + a + ')^' + b, ans: 'x^' + (a * b),
      hint: 'A power of a power: multiply the powers.',
      why: 'Multiply the powers: ' + a + ' × ' + b + ' = ' + (a * b) + ', so x^' + (a * b) + '.' };
  }
  function sciStandard() {
    var m = ri(11, 99), e = ri(2, 5), neg = Math.random() < 0.3;
    var coefStr = dec(m, 1);
    var val = neg ? dec(m, 1 + e) : dec(m * Math.pow(10, e - 1), 0);
    return { q: 'Write in standard form', eq: coefStr + ' × 10^' + (neg ? M : '') + e, ans: val,
      hint: neg ? 'A negative power moves the decimal point left.' : 'A positive power moves the decimal point right.',
      why: 'Move the decimal point ' + e + ' place' + (e > 1 ? 's' : '') + (neg ? ' to the left' : ' to the right') + ': ' + val + '.' };
  }

  /* ── RADICALS ─────────────────────────────────────────────────────────── */
  function radPerfect() {
    var r = ri(2, 15);
    return { q: 'Evaluate', eq: '√' + (r * r), ans: String(r),
      hint: 'Which number multiplied by itself gives ' + (r * r) + '?',
      why: r + ' × ' + r + ' = ' + (r * r) + ', so √' + (r * r) + ' = ' + r + '.' };
  }
  function radSimplify() {
    var a = ri(2, 7), b = pick([2, 3, 5, 6, 7]);
    return { q: 'Simplify', eq: '√' + (a * a * b), ans: a + '√' + b,
      hint: 'Pull out the biggest perfect square: ' + (a * a) + ' × ' + b + '.',
      why: (a * a * b) + ' = ' + (a * a) + ' × ' + b + ', and √' + (a * a) + ' = ' + a + ', so √' + (a * a * b) + ' = ' + a + '√' + b + '.' };
  }
  function radSolve() {
    var r = ri(2, 12);
    return { q: 'Solve for x', eq: '√x = ' + r, ans: String(r * r),
      hint: 'Square both sides.',
      why: 'Square both sides: x = ' + r + '^2 = ' + (r * r) + '.' };
  }
  function radProduct() {
    var a = pick([2, 3, 5]), k = ri(2, 6);
    return { q: 'Evaluate', eq: '√' + a + ' × √' + (a * k * k), ans: String(a * k),
      hint: 'Multiply what is under the roots, then take the root.',
      why: '√' + a + ' × √' + (a * k * k) + ' = √' + (a * a * k * k) + ' = ' + (a * k) + '.' };
  }

  /* ── INEQUALITIES ─────────────────────────────────────────────────────── */
  function inA() {
    var x = ri(-6, 12), a = ri(2, 12), s = ineqSign(), add = Math.random() < 0.5;
    var rhs = add ? x + a : x - a;
    return { q: 'Solve the inequality', eq: 'x ' + (add ? '+' : M) + ' ' + a + ' ' + s + ' ' + sg(rhs), ans: 'x ' + s + ' ' + sg(x),
      hint: 'Do the opposite to both sides, just like an equation.',
      why: (add ? 'Subtract ' : 'Add ') + a + ' on both sides: x ' + s + ' ' + sg(x) + '.' };
  }
  function inB() {
    var a = ri(2, 9), x = ri(-5, 9), s = ineqSign();
    return { q: 'Solve the inequality', eq: a + 'x ' + s + ' ' + sg(a * x), ans: 'x ' + s + ' ' + sg(x),
      hint: 'Divide both sides by ' + a + '. A positive number keeps the sign the same way round.',
      why: 'Divide both sides by ' + a + ' (positive, so the sign stays): x ' + s + ' ' + sg(x) + '.' };
  }
  function inC() {
    var a = ri(2, 9), x = ri(-6, 8), s = ineqSign();
    if (x === 0) x = 3;
    return { q: 'Solve the inequality', eq: M + a + 'x ' + s + ' ' + sg(-a * x), ans: 'x ' + flip(s) + ' ' + sg(x),
      hint: 'Dividing by a negative number flips the inequality sign.',
      why: 'Divide both sides by ' + M + a + '. That is a NEGATIVE number, so the sign flips: x ' + flip(s) + ' ' + sg(x) + '.' };
  }
  function inD() {
    var a = ri(2, 6), b = nz(-9, 12), x = ri(-4, 8), s = ineqSign();
    return { q: 'Solve the inequality', eq: lin(a, 'x', b) + ' ' + s + ' ' + sg(a * x + b), ans: 'x ' + s + ' ' + sg(x),
      hint: 'Two steps, in reverse order: undo the adding, then undo the multiplying.',
      why: (b > 0 ? 'Subtract ' : 'Add ') + Math.abs(b) + ' on both sides: ' + co(a) + 'x ' + s + ' ' + sg(a * x) + '. Then divide by ' + a + ': x ' + s + ' ' + sg(x) + '.' };
  }
  function inE() {
    var a = ri(2, 6), b = ri(2, 6), s = ineqSign();
    return { q: 'Solve the inequality', eq: 'x/' + a + ' ' + s + ' ' + b, ans: 'x ' + s + ' ' + (a * b),
      hint: 'Multiply both sides by ' + a + '.',
      why: 'Multiply both sides by ' + a + ' (positive, so the sign stays): x ' + s + ' ' + (a * b) + '.' };
  }
  function inF() {
    var b = ri(8, 20), x = ri(-3, 6), s = ineqSign();
    var c = b - x;
    return { q: 'Solve the inequality', eq: b + ' ' + M + ' x ' + s + ' ' + c, ans: 'x ' + flip(s) + ' ' + sg(x),
      hint: 'Get x on its own. Watch what happens when you multiply or divide by −1.',
      why: 'Subtract ' + b + ': ' + M + 'x ' + s + ' ' + sg(c - b) + '. Divide by ' + M + '1 and flip the sign: x ' + flip(s) + ' ' + sg(b - c) + '.' };
  }

  /* ── LINES AND COORDINATES ────────────────────────────────────────────── */
  function lnSlope() {
    var x1 = ri(-4, 4), y1 = ri(-4, 6), dx = ri(1, 4), m = nz(-4, 4);
    return { q: 'Find the slope', eq: '(' + sg(x1) + ', ' + sg(y1) + ') and (' + sg(x1 + dx) + ', ' + sg(y1 + m * dx) + ')', ans: String(m),
      hint: 'Slope = change in y ÷ change in x.',
      why: 'Change in y: ' + sg(y1 + m * dx) + ' ' + M + ' ' + par(y1) + ' = ' + sg(m * dx) + '. Change in x: ' + sg(x1 + dx) + ' ' + M + ' ' + par(x1) + ' = ' + dx + '. Slope = ' + sg(m * dx) + ' ÷ ' + dx + ' = ' + sg(m) + '.' };
  }
  function lnReadSlope() {
    var m = nz(-6, 6), b = nz(-9, 9), ask = Math.random() < 0.5;
    return { q: ask ? 'What is the slope?' : 'What is the y-intercept?', eq: 'y = ' + lin(m, 'x', b), ans: String(ask ? m : b),
      hint: 'In y = mx + b, m is the slope and b is where the line crosses the y-axis.',
      why: 'The line is in the form y = mx + b with m = ' + sg(m) + ' and b = ' + sg(b) + '.' };
  }
  function lnYAt() {
    var m = nz(-5, 6), b = ri(-8, 9), x = ri(-3, 6);
    return { q: 'Find y when x = ' + sg(x), eq: 'y = ' + lin(m, 'x', b), ans: String(m * x + b),
      hint: 'Put the number in place of x.',
      why: 'y = ' + co(m) + '(' + sg(x) + ')' + plus(b) + ' = ' + sg(m * x) + plus(b) + ' = ' + sg(m * x + b) + '.' };
  }
  function lnXAt() {
    var m = nz(2, 6), b = ri(-8, 9), x = ri(-3, 8);
    return { q: 'Find x when y = ' + sg(m * x + b), eq: 'y = ' + lin(m, 'x', b), ans: String(x),
      hint: 'Put the y-value in, then solve for x.',
      why: sg(m * x + b) + ' = ' + lin(m, 'x', b) + '. Undo the ' + (b >= 0 ? 'adding' : 'subtracting') + ': ' + co(m) + 'x = ' + sg(m * x) + '. Divide by ' + m + ': x = ' + sg(x) + '.' };
  }
  function lnMidpoint() {
    var x1 = ri(-6, 6), y1 = ri(-6, 6), mx = ri(-4, 6), my = ri(-4, 6);
    var x2 = 2 * mx - x1, y2 = 2 * my - y1;
    return { q: 'Find the midpoint', eq: '(' + sg(x1) + ', ' + sg(y1) + ') and (' + sg(x2) + ', ' + sg(y2) + ')', ans: '(' + sg(mx) + ', ' + sg(my) + ')',
      hint: 'Average the x-values, then average the y-values.',
      why: 'x: (' + sg(x1) + ' + ' + par(x2) + ') ÷ 2 = ' + sg(mx) + '. y: (' + sg(y1) + ' + ' + par(y2) + ') ÷ 2 = ' + sg(my) + '.' };
  }
  function lnDistance() {
    var t = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]), k = t[0] === 6 ? 1 : ri(1, 2);
    var x1 = ri(-3, 3), y1 = ri(-3, 3);
    var dx = t[0] * k, dy = t[1] * k;
    return { q: 'Find the distance', eq: '(' + sg(x1) + ', ' + sg(y1) + ') and (' + sg(x1 + dx) + ', ' + sg(y1 + dy) + ')', ans: String(t[2] * k),
      hint: 'Make a right triangle: distance = √(change in x squared + change in y squared).',
      why: 'The changes are ' + dx + ' and ' + dy + '. √(' + (dx * dx) + ' + ' + (dy * dy) + ') = √' + (dx * dx + dy * dy) + ' = ' + (t[2] * k) + '.' };
  }

  /* ── QUADRATICS AND FACTORING ─────────────────────────────────────────── */
  function quSquare() {
    var r = ri(2, 12);
    return { q: 'Solve for x', eq: 'x^2 = ' + (r * r), ans: 'x = ' + r + ' or x = ' + M + r,
      hint: 'There are two numbers that square to give this.',
      why: 'x is ' + r + ' or ' + M + r + ', because ' + r + '^2 = ' + (r * r) + ' and (' + M + r + ')^2 = ' + (r * r) + '.' };
  }
  function quFactor() {
    var r1 = nz(-8, 8), r2 = nz(-8, 8);
    return { q: 'Factor', eq: quad(r1 + r2, r1 * r2), ans: binom(r1) + binom(r2),
      hint: 'Find two numbers that multiply to ' + sg(r1 * r2) + ' and add to ' + sg(r1 + r2) + '.',
      why: sg(r1) + ' × ' + par(r2) + ' = ' + sg(r1 * r2) + ' and ' + sg(r1) + ' + ' + par(r2) + ' = ' + sg(r1 + r2) + ', so ' + binom(r1) + binom(r2) + '.' };
  }
  function quDiffSq() {
    var r = ri(2, 12);
    return { q: 'Factor', eq: 'x^2 ' + M + ' ' + (r * r), ans: binom(r) + binom(-r),
      hint: 'A difference of two squares: a² − b² = (a + b)(a − b).',
      why: (r * r) + ' = ' + r + '^2, so x^2 ' + M + ' ' + (r * r) + ' = ' + binom(r) + binom(-r) + '.' };
  }
  function quSolve() {
    var r1 = nz(-7, 7), r2 = nz(-7, 7);
    while (r1 === r2) r2 = nz(-7, 7);
    var b = -(r1 + r2), c = r1 * r2;
    return { q: 'Solve for x', eq: quad(b, c) + ' = 0', ans: 'x = ' + sg(r1) + ' or x = ' + sg(r2),
      hint: 'Factor, then set each bracket equal to zero.',
      why: 'Factor: ' + binom(-r1) + binom(-r2) + ' = 0. Each bracket can be zero: x = ' + sg(r1) + ' or x = ' + sg(r2) + '.' };
  }
  function quExpand() {
    var r1 = nz(-7, 7), r2 = nz(-7, 7);
    var b = r1 + r2, c = r1 * r2;
    return { q: 'Expand', eq: binom(r1) + binom(r2), ans: quad(b, c),
      hint: 'Multiply every term in one bracket by every term in the other.',
      why: 'x·x = x^2; the middle terms add to ' + sg(b) + 'x; ' + sg(r1) + ' × ' + par(r2) + ' = ' + sg(c) + '. So ' + quad(b, c) + '.' };
  }
  function quDisc() {
    var a = ri(1, 3), b = nz(-8, 8), c = nz(-6, 6);
    return { q: 'Find the discriminant', eq: (a === 1 ? '' : a) + 'x^2' + plus(b).replace(/(\d+)$/, '$1x') + plus(c), ans: String(b * b - 4 * a * c),
      hint: 'The discriminant is b² − 4ac.',
      why: 'a = ' + a + ', b = ' + sg(b) + ', c = ' + sg(c) + ': ' + sg(b) + '^2 ' + M + ' 4 × ' + a + ' × ' + par(c) + ' = ' + sg(b * b - 4 * a * c) + '.' };
  }
  function quLead() {
    var a = ri(2, 4), r1 = nz(-5, 5), r2 = nz(-5, 5);
    while (r1 === r2) r2 = nz(-5, 5);
    var b = -a * (r1 + r2), c = a * r1 * r2;
    return { q: 'Solve for x', eq: a + 'x^2' + (b ? plus(b).replace(/(\d+)$/, '$1x') : '') + (c ? plus(c) : '') + ' = 0', ans: 'x = ' + sg(r1) + ' or x = ' + sg(r2),
      hint: 'Divide every term by ' + a + ' first, then factor.',
      why: 'Divide by ' + a + ': ' + quad(b / a, c / a) + ' = 0. That factors to ' + binom(-r1) + binom(-r2) + ' = 0, so x = ' + sg(r1) + ' or x = ' + sg(r2) + '.' };
  }

  /* ── GEOMETRY ─────────────────────────────────────────────────────────── */
  function geoRectArea() {
    var l = ri(3, 15), w = ri(2, 12);
    return { q: 'Find the area', eq: 'Rectangle: length ' + l + ' cm, width ' + w + ' cm', ans: String(l * w),
      hint: 'Area of a rectangle = length × width.', why: l + ' × ' + w + ' = ' + (l * w) + ' cm².' };
  }
  function geoRectPerim() {
    var l = ri(3, 15), w = ri(2, 12);
    return { q: 'Find the perimeter', eq: 'Rectangle: length ' + l + ' cm, width ' + w + ' cm', ans: String(2 * (l + w)),
      hint: 'Add all four sides: 2 × (length + width).', why: '2 × (' + l + ' + ' + w + ') = 2 × ' + (l + w) + ' = ' + (2 * (l + w)) + ' cm.' };
  }
  function geoTriArea() {
    var b = 2 * ri(2, 9), h = ri(3, 12);
    return { q: 'Find the area', eq: 'Triangle: base ' + b + ' cm, height ' + h + ' cm', ans: String(b * h / 2),
      hint: 'Area of a triangle = ½ × base × height.', why: '½ × ' + b + ' × ' + h + ' = ' + (b * h / 2) + ' cm².' };
  }
  function geoCircle() {
    var r = ri(2, 12), area = Math.random() < 0.5;
    return { q: area ? 'Find the area' : 'Find the circumference', eq: 'Circle: radius ' + r + ' cm. Leave your answer in terms of π.', ans: area ? (r * r) + 'π' : (2 * r) + 'π',
      hint: area ? 'Area = πr².' : 'Circumference = 2πr.',
      why: area ? 'π × ' + r + '^2 = ' + (r * r) + 'π cm².' : '2 × π × ' + r + ' = ' + (2 * r) + 'π cm.' };
  }
  function geoPythHyp() {
    var t = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]), k = t[0] > 5 ? 1 : ri(1, 4);
    return { q: 'Find the hypotenuse', eq: 'Right triangle: legs ' + (t[0] * k) + ' and ' + (t[1] * k), ans: String(t[2] * k),
      hint: 'a² + b² = c².',
      why: (t[0] * k) + '^2 + ' + (t[1] * k) + '^2 = ' + (t[0] * t[0] * k * k + t[1] * t[1] * k * k) + ', and √' + (t[2] * t[2] * k * k) + ' = ' + (t[2] * k) + '.' };
  }
  function geoPythLeg() {
    var t = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]), k = t[0] === 6 ? 1 : ri(1, 3);
    return { q: 'Find the missing leg', eq: 'Right triangle: hypotenuse ' + (t[2] * k) + ', one leg ' + (t[0] * k), ans: String(t[1] * k),
      hint: 'a² + b² = c², so b² = c² − a².',
      why: (t[2] * k) + '^2 ' + M + ' ' + (t[0] * k) + '^2 = ' + (t[1] * t[1] * k * k) + ', and √' + (t[1] * t[1] * k * k) + ' = ' + (t[1] * k) + '.' };
  }
  function geoVolume() {
    var l = ri(2, 9), w = ri(2, 8), h = ri(2, 9);
    return { q: 'Find the volume', eq: 'Box: length ' + l + ' cm, width ' + w + ' cm, height ' + h + ' cm', ans: String(l * w * h),
      hint: 'Volume = length × width × height.', why: l + ' × ' + w + ' × ' + h + ' = ' + (l * w * h) + ' cm³.' };
  }
  function geoTriAngle() {
    var a = ri(30, 80), b = ri(30, 80);
    while (a + b >= 150) b = ri(30, 70);
    return { q: 'Find the missing angle', eq: 'A triangle has angles ' + a + '° and ' + b + '°.', ans: String(180 - a - b),
      hint: 'The angles in a triangle add up to 180°.', why: '180 ' + M + ' ' + a + ' ' + M + ' ' + b + ' = ' + (180 - a - b) + '°.' };
  }
  function geoSupp() {
    var a = ri(20, 160), comp = Math.random() < 0.4;
    if (comp) a = ri(10, 80);
    return { q: comp ? 'Find the complement' : 'Find the supplement', eq: comp ? 'An angle measures ' + a + '°. Its complement?' : 'An angle measures ' + a + '°. Its supplement?', ans: String((comp ? 90 : 180) - a),
      hint: comp ? 'Complementary angles add to 90°.' : 'Supplementary angles add to 180°.', why: (comp ? 90 : 180) + ' ' + M + ' ' + a + ' = ' + ((comp ? 90 : 180) - a) + '°.' };
  }
  function geoPolygon() {
    var n = ri(5, 10), name = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon' }[n];
    return { q: 'Sum of the angles', eq: 'A ' + name + ' has ' + n + ' sides. What do its angles add up to?', ans: String((n - 2) * 180),
      hint: 'Sum of angles = (sides − 2) × 180°.', why: '(' + n + ' ' + M + ' 2) × 180 = ' + (n - 2) + ' × 180 = ' + ((n - 2) * 180) + '°.' };
  }

  /* ── DATA AND PROBABILITY ─────────────────────────────────────────────── */
  function list(n, lo, hi) { var a = []; for (var i = 0; i < n; i++) a.push(ri(lo, hi)); return a; }
  function statMean() {
    var n = ri(4, 6), a = list(n, 2, 15), s = a.reduce(function (x, y) { return x + y; }, 0);
    var adj = (n - (s % n)) % n; a[0] += adj; s += adj;
    return { q: 'Find the mean', eq: a.join(', '), ans: String(s / n),
      hint: 'Add them all up, then divide by how many there are.',
      why: 'The numbers add up to ' + s + '. There are ' + n + ' of them: ' + s + ' ÷ ' + n + ' = ' + (s / n) + '.' };
  }
  function statMedian() {
    var n = pick([5, 7]), a = list(n, 2, 30);
    var sorted = a.slice().sort(function (x, y) { return x - y; });
    return { q: 'Find the median', eq: a.join(', '), ans: String(sorted[(n - 1) / 2]),
      hint: 'Put them in order first. The median is the middle one.',
      why: 'In order: ' + sorted.join(', ') + '. The middle one is ' + sorted[(n - 1) / 2] + '.' };
  }
  function statMedianEven() {
    var a = list(6, 2, 30), sorted = a.slice().sort(function (x, y) { return x - y; });
    if ((sorted[2] + sorted[3]) % 2) { sorted[3]++; a = sorted.slice(); a.sort(function () { return Math.random() - .5; }); sorted = a.slice().sort(function (x, y) { return x - y; }); }
    var med = (sorted[2] + sorted[3]) / 2;
    return { q: 'Find the median', eq: a.join(', '), ans: String(med),
      hint: 'With an even count, take the two middle numbers and find halfway between them.',
      why: 'In order: ' + sorted.join(', ') + '. The middle two are ' + sorted[2] + ' and ' + sorted[3] + ', and halfway between is ' + med + '.' };
  }
  function statMode() {
    var m = ri(2, 20), a = [], v;
    while (a.length < 4) { v = ri(1, 25); if (v !== m && a.indexOf(v) === -1) a.push(v); }
    a.push(m, m, m);
    a.sort(function () { return Math.random() - .5; });
    return { q: 'Find the mode', eq: a.join(', '), ans: String(m),
      hint: 'The mode is the number that appears most often.',
      why: m + ' appears three times, more than any other number.' };
  }
  function statRange() {
    var a = list(6, 1, 40), mx = Math.max.apply(null, a), mn = Math.min.apply(null, a);
    return { q: 'Find the range', eq: a.join(', '), ans: String(mx - mn),
      hint: 'Range = biggest − smallest.',
      why: 'The biggest is ' + mx + ' and the smallest is ' + mn + ': ' + mx + ' ' + M + ' ' + mn + ' = ' + (mx - mn) + '.' };
  }
  function statMissing() {
    var n = ri(4, 6), mean = ri(6, 20), a = list(n - 1, mean - 4, mean + 4);
    var last = mean * n - a.reduce(function (x, y) { return x + y; }, 0);
    if (last < 0 || last > 60) { a = []; for (var i = 0; i < n - 1; i++) a.push(mean); last = mean; }
    return { q: 'Find the missing number', eq: 'The mean of ' + n + ' numbers is ' + mean + '. The others are ' + a.join(', ') + '. What is the last one?', ans: String(last),
      hint: 'The numbers must add up to the mean times how many there are.',
      why: 'They must add up to ' + mean + ' × ' + n + ' = ' + (mean * n) + '. The known ones add to ' + (mean * n - last) + ', so the last is ' + last + '.' };
  }
  function statProb() {
    var r = ri(2, 8), b = ri(2, 8), thing = pick([['red', 'blue', 'marbles in a bag'], ['green', 'yellow', 'counters in a cup'], ['black', 'white', 'socks in a drawer']]);
    var which = Math.random() < 0.5;
    var n = which ? r : b;
    return { q: 'Find the probability', eq: 'There are ' + r + ' ' + thing[0] + ' and ' + b + ' ' + thing[1] + ' ' + thing[2] + '. One is picked at random. P(' + (which ? thing[0] : thing[1]) + ')?', ans: frac(n, r + b),
      hint: 'Probability = favourable outcomes ÷ all outcomes. Simplify.',
      why: n + ' of the ' + (r + b) + ' are ' + (which ? thing[0] : thing[1]) + ', so ' + n + '/' + (r + b) + (frac(n, r + b) !== n + '/' + (r + b) ? ' = ' + frac(n, r + b) : '') + '.' };
  }

  /* ── NUMBER THEORY AND ROUNDING ───────────────────────────────────────── */
  function ntGcf() {
    var g = ri(2, 9), a = ri(2, 6), b = ri(2, 8);
    while (gcd(a, b) !== 1 || a === b) b++;
    return { q: 'Greatest common factor', eq: 'Greatest common factor of ' + (g * a) + ' and ' + (g * b), ans: String(g),
      hint: 'List the factors of each and pick the biggest one they share.', why: 'The biggest number that divides both ' + (g * a) + ' and ' + (g * b) + ' is ' + g + '.' };
  }
  function ntLcm() {
    var a = ri(2, 9), b = ri(2, 9);
    while (a === b) b = ri(2, 9);
    var L = lcm(a, b);
    return { q: 'Least common multiple', eq: 'Least common multiple of ' + a + ' and ' + b, ans: String(L),
      hint: 'List the multiples of each until one matches.', why: 'The smallest number in both times tables is ' + L + '.' };
  }
  function ntFactors() {
    var n = pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 45, 48]), c = 0;
    for (var i = 1; i <= n; i++) if (n % i === 0) c++;
    return { q: 'Count the factors', eq: 'How many factors does ' + n + ' have?', ans: String(c),
      hint: 'Factors come in pairs: 1 and the number, then 2 and its partner, and so on.', why: n + ' has ' + c + ' factors.' };
  }
  function ntRound() {
    var places = pick([['tenth', 1], ['hundredth', 2]]), v = ri(1000, 9999) / 1000;
    var s = v.toFixed(3), r = (Math.round(v * Math.pow(10, places[1])) / Math.pow(10, places[1])).toFixed(places[1]);
    return { q: 'Round the number', eq: 'Round ' + s + ' to the nearest ' + places[0], ans: dec(Math.round(parseFloat(r) * Math.pow(10, places[1])), places[1]),
      hint: 'Look at the digit after the place you are rounding to. 5 or more rounds up.', why: 'Rounded to the nearest ' + places[0] + ', ' + s + ' becomes ' + r + '.' };
  }
  function ntRoundWhole() {
    var p = pick([['ten', 10], ['hundred', 100], ['thousand', 1000]]), n = ri(1001, 98999);
    var r = Math.round(n / p[1]) * p[1];
    return { q: 'Round the number', eq: 'Round ' + n + ' to the nearest ' + p[0], ans: String(r),
      hint: 'Look at the digit to the right of the place you are rounding to.', why: n + ' is closest to ' + r + '.' };
  }

  /* ── MORE ALGEBRA: multi-step, both sides, two-variable ───────────────── */
  function msDist() {
    var a = ri(2, 6), b = ri(1, 9), x = ri(1, 10);
    return { q: 'Solve for x', eq: a + '(x + ' + b + ') = ' + (a * (x + b)), ans: String(x),
      hint: 'Either expand the bracket first, or divide both sides by ' + a + '.',
      why: 'Divide both sides by ' + a + ': x + ' + b + ' = ' + (x + b) + '. Subtract ' + b + ': x = ' + x + '.' };
  }
  function msBoth() {
    var c = ri(1, 5), a = c + ri(1, 5), x = ri(1, 10), b = ri(1, 12);
    var d = a * x + b - c * x;
    return { q: 'Solve for x', eq: lin(a, 'x', b) + ' = ' + lin(c, 'x', d), ans: String(x),
      hint: 'Get every x on one side first.',
      why: 'Subtract ' + co(c) + 'x from both sides: ' + co(a - c) + 'x + ' + b + ' = ' + d + '. Subtract ' + b + ': ' + co(a - c) + 'x = ' + (d - b) + '. Divide by ' + (a - c) + ': x = ' + x + '.' };
  }
  function msNeg() {
    var a = ri(2, 7), b = ri(1, 15), x = ri(-4, 8);
    return { q: 'Solve for x', eq: M + a + 'x ' + (b < 0 ? M : '+') + ' ' + Math.abs(b) + ' = ' + sg(-a * x + b), ans: String(x),
      hint: 'Undo the adding or subtracting first, then divide by the negative.',
      why: 'Subtract ' + b + ' from both sides: ' + M + a + 'x = ' + sg(-a * x) + '. Divide by ' + M + a + ': x = ' + sg(x) + '.' };
  }
  function msDivStep() {
    var a = ri(2, 6), b = ri(1, 9), x = a * ri(1, 8);
    return { q: 'Solve for x', eq: 'x/' + a + ' + ' + b + ' = ' + (x / a + b), ans: String(x),
      hint: 'Subtract ' + b + ', then multiply both sides by ' + a + '.',
      why: 'Subtract ' + b + ': x/' + a + ' = ' + (x / a) + '. Multiply by ' + a + ': x = ' + x + '.' };
  }
  function msTwoDist() {
    var a = ri(2, 5), b = ri(2, 5), c = ri(1, 7), d = ri(1, 9), x = ri(1, 8);
    var e = a * (b * x - c) + d;
    return { q: 'Solve for x', eq: a + '(' + co(b) + 'x ' + M + ' ' + c + ') + ' + d + ' = ' + e, ans: String(x),
      hint: 'Subtract ' + d + ', divide by ' + a + ', then undo the rest.',
      why: 'Subtract ' + d + ': ' + a + '(' + co(b) + 'x ' + M + ' ' + c + ') = ' + (e - d) + '. Divide by ' + a + ': ' + co(b) + 'x ' + M + ' ' + c + ' = ' + (e - d) / a + '. Add ' + c + ' and divide by ' + b + ': x = ' + x + '.' };
  }
  function evalTwo() {
    var a = ri(2, 6), b = ri(2, 6), x = ri(1, 7), y = ri(1, 7);
    return { q: 'Evaluate', eq: a + 'x + ' + b + 'y when x = ' + x + ' and y = ' + y, ans: String(a * x + b * y),
      hint: 'Put each number in place of its letter.',
      why: a + '(' + x + ') + ' + b + '(' + y + ') = ' + (a * x) + ' + ' + (b * y) + ' = ' + (a * x + b * y) + '.' };
  }
  function evalPower() {
    var a = ri(2, 5), x = ri(2, 5), b = ri(1, 9);
    return { q: 'Evaluate', eq: a + 'x^2 + ' + b + ' when x = ' + x, ans: String(a * x * x + b),
      hint: 'Square first, then multiply, then add.',
      why: x + '^2 = ' + (x * x) + '. ' + a + ' × ' + (x * x) + ' = ' + (a * x * x) + '. ' + (a * x * x) + ' + ' + b + ' = ' + (a * x * x + b) + '.' };
  }
  function fnEval() {
    var a = nz(-4, 6), b = ri(-8, 9), x = ri(-3, 7);
    var def = 'f(x) = ' + lin(a, 'x', b);
    return { same: true, q: def + '. Find f(' + sg(x) + ').', eq: def + '. Find f(' + sg(x) + ').', ans: String(a * x + b),
      hint: 'Put the number in place of x.',
      why: 'f(' + sg(x) + ') = ' + co(a) + '(' + sg(x) + ')' + plus(b) + ' = ' + sg(a * x + b) + '.' };
  }
  function fnSquare() {
    var c = ri(1, 9), x = ri(2, 7);
    return { same: true, q: 'g(x) = x^2 ' + M + ' ' + c + '. Find g(' + x + ').', eq: 'g(x) = x^2 ' + M + ' ' + c + '. Find g(' + x + ').', ans: String(x * x - c),
      hint: 'Square the number, then subtract.', why: 'g(' + x + ') = ' + x + '^2 ' + M + ' ' + c + ' = ' + (x * x) + ' ' + M + ' ' + c + ' = ' + (x * x - c) + '.' };
  }

  /* ══ WORD PROBLEMS ══════════════════════════════════════════════════════ */
  function st(prompt, answer, unit, hint) { return { prompt: prompt, answer: String(answer), unit: unit || '', hint: hint || '' }; }

  function wpTickets() {
    var adult = ri(6, 14), child = ri(3, adult - 2), kids = ri(2, 5), adults = ri(2, 5);
    var cost = child * kids, T = cost + adult * adults;
    return { scenario: 'A family goes to the cinema. Adult tickets are $' + adult + ' and child tickets are $' + child + '. They buy ' + kids + ' child tickets and some adult tickets, and pay $' + T + ' in all.',
      question: 'How many adult tickets did they buy?',
      steps: [st('Multiply ' + kids + ' by ' + child + ' to find the child ticket cost.', cost, 'dollars', 'Each child ticket costs $' + child + '.'),
              st('Subtract {1} from ' + T + '.', T - cost, 'dollars', 'What is left was spent on adult tickets.'),
              st('Divide {2} by ' + adult + ' to find the adult tickets.', adults, 'tickets', 'Each adult ticket costs $' + adult + '.')],
      answer: String(adults), hint: 'Take the child tickets away first, then divide what is left by the adult price.',
      explanation: kids + ' child tickets cost $' + cost + '. That leaves $' + (T - cost) + ' for adults, and $' + (T - cost) + ' ÷ $' + adult + ' = ' + adults + ' adult tickets.' };
  }
  function wpGarden() {
    var l = ri(5, 14), w = ri(3, 10), c = ri(2, 6), p = 2 * (l + w);
    return { scenario: 'A rectangular garden is ' + l + ' m long and ' + w + ' m wide. Fencing costs $' + c + ' a metre and goes all the way round the garden.',
      question: 'How much does the fencing cost?',
      steps: [st('Add ' + l + ' and ' + w + '.', l + w, 'metres', 'That is one length plus one width.'),
              st('Multiply {1} by 2 to find the distance round the garden.', p, 'metres', 'A rectangle has two lengths and two widths.'),
              st('Multiply {2} by ' + c + ' to find the cost.', p * c, 'dollars', 'Each metre costs $' + c + '.')],
      answer: String(p * c), hint: 'Find the distance round the garden first, then multiply by the price of a metre.',
      explanation: 'The distance round is 2 × (' + l + ' + ' + w + ') = ' + p + ' m. At $' + c + ' a metre the fencing costs $' + (p * c) + '.' };
  }
  function wpTax() {
    var rate = pick([4, 5, 8, 10]), meal = 25 * ri(2, 8), tax = meal * rate / 100;
    while (tax !== Math.round(tax)) { meal += 25; tax = meal * rate / 100; }
    return { scenario: 'A meal costs $' + meal + ' before tax. Sales tax is ' + rate + '%.',
      question: 'What is the price including tax?',
      steps: [st('Find ' + rate + '% of ' + meal + '.', tax, 'dollars', rate + '% means ' + rate + ' out of every 100.'),
              st('Add {1} and ' + meal + ' to get the final price.', meal + tax, 'dollars', 'The tax is added to the price.')],
      answer: String(meal + tax), hint: 'Work out the tax first, then add it on.',
      explanation: rate + '% of $' + meal + ' is $' + tax + ', so the meal costs $' + meal + ' + $' + tax + ' = $' + (meal + tax) + '.' };
  }
  function wpInterest() {
    var P = 100 * ri(2, 10), r = ri(2, 8), t = ri(2, 5), one = P * r / 100;
    return { scenario: 'Ines puts $' + P + ' in a savings account that pays ' + r + '% simple interest a year. She leaves it for ' + t + ' years.',
      question: 'How much interest does she earn?',
      steps: [st('Find ' + r + '% of ' + P + '.', one, 'dollars', 'That is one year of interest.'),
              st('Multiply {1} by ' + t + ' for the years.', one * t, 'dollars', 'The same amount is earned every year.')],
      answer: String(one * t), hint: 'Find one year of interest, then multiply by the number of years.',
      explanation: r + '% of $' + P + ' is $' + one + ' a year. Over ' + t + ' years that is $' + (one * t) + '.' };
  }
  function wpTrip() {
    var s = 10 * ri(4, 9), h = ri(2, 5), extra = 5 * ri(4, 20);
    return { scenario: 'A car drives at ' + s + ' km/h for ' + h + ' hours. Then it drives ' + extra + ' km more along the same road.',
      question: 'How far does the car travel altogether?',
      steps: [st('Multiply ' + s + ' by ' + h + '.', s * h, 'km', 'Distance = speed × time.'),
              st('Add {1} and ' + extra + '.', s * h + extra, 'km', 'Join the two parts of the trip.')],
      answer: String(s * h + extra), hint: 'Use distance = speed × time for the first part, then add the rest.',
      explanation: s + ' km/h × ' + h + ' h = ' + (s * h) + ' km, and ' + (s * h) + ' + ' + extra + ' = ' + (s * h + extra) + ' km.' };
  }
  function wpTwoLegs() {
    var s1 = 10 * ri(3, 9), t1 = ri(1, 4), s2 = 10 * ri(3, 9), t2 = ri(1, 4);
    return { scenario: 'A train travels ' + (s1 * t1) + ' km at ' + s1 + ' km/h, then ' + (s2 * t2) + ' km at ' + s2 + ' km/h.',
      question: 'How many hours does the whole journey take?',
      steps: [st('Divide ' + (s1 * t1) + ' by ' + s1 + '.', t1, 'hours', 'Time = distance ÷ speed.'),
              st('Divide ' + (s2 * t2) + ' by ' + s2 + '.', t2, 'hours', 'Do the second part the same way.'),
              st('Add {1} and {2}.', t1 + t2, 'hours', 'Join the two times.')],
      answer: String(t1 + t2), hint: 'Find the time for each part, then add them.',
      explanation: 'First part: ' + t1 + ' h. Second part: ' + t2 + ' h. The journey takes ' + (t1 + t2) + ' hours.' };
  }
  function wpRecipe() {
    var base = ri(2, 5), cookies = 6 * ri(1, 3), f = ri(2, 5), item = pick(['cups of flour', 'eggs', 'spoons of sugar']);
    var want = cookies * f;
    return { scenario: 'A recipe uses ' + base + ' ' + item + ' to make ' + cookies + ' cookies. Maya wants to make ' + want + ' cookies.',
      question: 'How many ' + item + ' does she need?',
      steps: [st('Divide ' + want + ' by ' + cookies + ' to find the scale factor.', f, '', 'How many times bigger is the batch?'),
              st('Multiply ' + base + ' by {1}.', base * f, item, 'Scale the amount up by the same factor.')],
      answer: String(base * f), hint: 'Find how many times bigger the batch is, then scale the amount.',
      explanation: want + ' ÷ ' + cookies + ' = ' + f + ', so she needs ' + base + ' × ' + f + ' = ' + (base * f) + ' ' + item + '.' };
  }
  function wpConsecutive() {
    var n = ri(5, 40);
    return { scenario: 'Three whole numbers in a row (consecutive numbers) add up to ' + (3 * n) + '.',
      question: 'What is the smallest of the three?',
      steps: [st('Divide ' + (3 * n) + ' by 3 to find the middle number.', n, '', 'The middle number is also the one halfway between the others.'),
              st('Subtract 1 from {1}.', n - 1, '', 'The smallest is one less than the middle.')],
      answer: String(n - 1), hint: 'The middle number is the mean of the three.',
      explanation: (3 * n) + ' ÷ 3 = ' + n + ' is the middle, so the numbers are ' + (n - 1) + ', ' + n + ' and ' + (n + 1) + '. The smallest is ' + (n - 1) + '.' };
  }
  function wpAge() {
    var k = ri(2, 5), young = ri(5, 14), who = pick([['Lena', 'her brother'], ['Omar', 'his sister'], ['Priya', 'her cousin']]);
    var T = young * (k + 1);
    return { scenario: who[0] + ' is ' + k + ' times as old as ' + who[1] + '. Their ages add up to ' + T + '.',
      question: 'How old is ' + who[1] + '?',
      steps: [st('Add 1 and ' + k + ' to count the equal parts.', k + 1, 'parts', who[1].charAt(0).toUpperCase() + who[1].slice(1) + ' is 1 part and ' + who[0] + ' is ' + k + ' parts.'),
              st('Divide ' + T + ' by {1}.', young, 'years', 'Each part is the same size.')],
      answer: String(young), hint: 'Count the parts, then divide the ages between them.',
      explanation: 'There are 1 + ' + k + ' = ' + (k + 1) + ' parts. ' + T + ' ÷ ' + (k + 1) + ' = ' + young + ', so ' + who[1] + ' is ' + young + '.' };
  }
  function wpSavings() {
    var have = ri(5, 40), per = ri(4, 12), weeks = ri(3, 10), goal = have + per * weeks, item = pick(['a bike helmet', 'a game', 'new headphones', 'a skateboard']);
    return { scenario: 'Jo has $' + have + ' and saves $' + per + ' every week. He wants ' + item + ' that costs $' + goal + '.',
      question: 'How many weeks must he save?',
      steps: [st('Subtract ' + have + ' from ' + goal + '.', goal - have, 'dollars', 'He already has some of it.'),
              st('Divide {1} by ' + per + ' to find the weeks.', weeks, 'weeks', 'He saves $' + per + ' a week.')],
      answer: String(weeks), hint: 'Take away what he has, then divide by his weekly saving.',
      explanation: '$' + goal + ' − $' + have + ' = $' + (goal - have) + ' still needed. At $' + per + ' a week that is ' + weeks + ' weeks.' };
  }
  function wpAverage() {
    var a = ri(70, 95), b = ri(70, 95), c = ri(70, 95), target = ri(80, 90);
    var need = target * 4 - (a + b + c);
    if (need < 50 || need > 100) { a = 80; b = 90; c = 76; target = 85; need = 340 - 246; }
    return { scenario: 'Jada scored ' + a + ', ' + b + ' and ' + c + ' on her first three tests. She wants a mean of ' + target + ' over four tests.',
      question: 'What must she score on the fourth test?',
      steps: [st('Add ' + a + ' and ' + b + '.', a + b, 'points', 'Start with the first two scores.'),
              st('Add {1} and ' + c + '.', a + b + c, 'points', 'Now add the third.'),
              st('Multiply ' + target + ' by 4.', target * 4, 'points', 'Four tests at the mean she wants.'),
              st('Subtract {2} from {3}.', need, 'points', 'What is still needed from the fourth test.')],
      answer: String(need), hint: 'Find the points she needs in all, then take away what she has.',
      explanation: 'To average ' + target + ' over 4 tests she needs ' + (target * 4) + ' points. She has ' + (a + b + c) + ', so she needs ' + need + '.' };
  }
  function wpUnits() {
    var m = ri(3, 9), cm = pick([20, 25, 40, 50]);
    var pieces = m * 100 / cm;
    return { scenario: 'A ribbon is ' + m + ' m long. It is cut into pieces that are each ' + cm + ' cm long.',
      question: 'How many pieces are there?',
      steps: [st('Multiply ' + m + ' by 100 to change metres to centimetres.', m * 100, 'cm', '1 metre is 100 centimetres.'),
              st('Divide {1} by ' + cm + '.', pieces, 'pieces', 'How many ' + cm + ' cm pieces fit?')],
      answer: String(pieces), hint: 'Use the same unit for both lengths first.',
      explanation: m + ' m = ' + (m * 100) + ' cm, and ' + (m * 100) + ' ÷ ' + cm + ' = ' + pieces + ' pieces.' };
  }
  function wpTemperature() {
    var c = 5 * ri(2, 9), nine = c * 9, fifth = nine / 5;
    return { scenario: 'To change degrees Celsius to Fahrenheit you multiply by 9, divide by 5, then add 32. The temperature is ' + c + '°C.',
      question: 'What is the temperature in °F?',
      steps: [st('Multiply ' + c + ' by 9.', nine, '', 'First step of the rule.'),
              st('Divide {1} by 5.', fifth, '', 'Second step of the rule.'),
              st('Add {2} and 32.', fifth + 32, '°F', 'Last step of the rule.')],
      answer: String(fifth + 32), hint: 'Follow the three steps in order.',
      explanation: c + ' × 9 = ' + nine + ', ÷ 5 = ' + fifth + ', + 32 = ' + (fifth + 32) + '°F.' };
  }
  function wpGrowth() {
    var pct = pick([10, 20, 25, 50]), pop = 200 * ri(2, 20), up = pct * pop / 100;
    var place = pick(['town', 'school', 'fan club']);
    return { scenario: 'A ' + place + ' has ' + pop + ' people. Next year it grows by ' + pct + '%.',
      question: 'How many people are there next year?',
      steps: [st('Find ' + pct + '% of ' + pop + '.', up, 'people', 'That is the increase.'),
              st('Add {1} and ' + pop + '.', pop + up, 'people', 'New size = old size + increase.')],
      answer: String(pop + up), hint: 'Find the increase, then add it to the starting number.',
      explanation: pct + '% of ' + pop + ' is ' + up + ', so there are ' + pop + ' + ' + up + ' = ' + (pop + up) + ' people.' };
  }
  function wpSquarePark() {
    var side = ri(5, 40);
    return { scenario: 'A square park has a perimeter of ' + (4 * side) + ' m.',
      question: 'What is the area of the park in square metres?',
      steps: [st('Divide ' + (4 * side) + ' by 4 to find one side.', side, 'metres', 'A square has four equal sides.'),
              st('Multiply {1} by {1}.', side * side, 'm²', 'Area = side × side.')],
      answer: String(side * side), hint: 'Find one side first, then square it.',
      explanation: (4 * side) + ' ÷ 4 = ' + side + ' m per side, and ' + side + ' × ' + side + ' = ' + (side * side) + ' m².' };
  }
  function wpBulk() {
    var pack = pick([6, 8, 10, 12]), price = ri(2, 9), packs = ri(3, 9), need = pack * packs;
    var item = pick(['pencils', 'markers', 'stickers']);
    return { scenario: item.charAt(0).toUpperCase() + item.slice(1) + ' are sold in packs of ' + pack + ' for $' + price + ' a pack. A teacher needs ' + need + '.',
      question: 'How much will the teacher spend?',
      steps: [st('Divide ' + need + ' by ' + pack + ' to find the packs.', packs, 'packs', 'How many packs hold ' + need + '?'),
              st('Multiply {1} by ' + price + '.', packs * price, 'dollars', 'Each pack costs $' + price + '.')],
      answer: String(packs * price), hint: 'Find the number of packs, then multiply by the price of one.',
      explanation: need + ' ÷ ' + pack + ' = ' + packs + ' packs, and ' + packs + ' × $' + price + ' = $' + (packs * price) + '.' };
  }
  function wpChange() {
    var a = ri(2, 5), pa = ri(2, 6), b = ri(2, 5), pb = ri(1, 4), cost = a * pa + b * pb, paid = 5 * (Math.floor(cost / 5) + ri(1, 3));
    return { scenario: 'Eli buys ' + a + ' notebooks at $' + pa + ' and ' + b + ' pens at $' + pb + '. He pays with $' + paid + '.',
      question: 'How much change does he get?',
      steps: [st('Multiply ' + a + ' by ' + pa + '.', a * pa, 'dollars', 'The notebooks.'),
              st('Multiply ' + b + ' by ' + pb + '.', b * pb, 'dollars', 'The pens.'),
              st('Add {1} and {2}.', cost, 'dollars', 'What he spends.'),
              st('Subtract {3} from ' + paid + '.', paid - cost, 'dollars', 'What is left from the bill he paid with.')],
      answer: String(paid - cost), hint: 'Work out the bill first, then take it from the money he paid.',
      explanation: 'The bill is $' + (a * pa) + ' + $' + (b * pb) + ' = $' + cost + '. Change = $' + paid + ' − $' + cost + ' = $' + (paid - cost) + '.' };
  }
  function wpFractionOf() {
    var d = pick([4, 5, 8, 10]), n = ri(1, d - 1), k = ri(2, 8), cls = d * k;
    var verb = pick([['walk to school', 'walk'], ['play sport', 'play sport'], ['bring lunch', 'bring lunch']]);
    return { scenario: 'In a class of ' + cls + ' students, ' + n + '/' + d + ' of them ' + verb[0] + '.',
      question: 'How many students ' + verb[1] + '?',
      steps: [st('Divide ' + cls + ' by ' + d + '.', k, 'students', 'Find one ' + (d === 4 ? 'quarter' : '1/' + d) + ' of the class.'),
              st('Multiply {1} by ' + n + '.', n * k, 'students', 'Take ' + n + ' of those parts.')],
      answer: String(n * k), hint: 'Divide by the bottom of the fraction, then multiply by the top.',
      explanation: cls + ' ÷ ' + d + ' = ' + k + ', and ' + k + ' × ' + n + ' = ' + (n * k) + ' students.' };
  }
  function wpReverse() {
    var p = pick([20, 25, 40]), k = ri(2, 9), O = 20 * k, S = O * (100 - p) / 100;
    return { scenario: 'A bike is on sale at ' + p + '% off. The sale price is $' + S + '.',
      question: 'What was the original price?',
      steps: [st('Subtract ' + p + ' from 100.', 100 - p, 'percent', 'This is the percent of the price you still pay.'),
              st('Divide ' + S + ' by {1}.', S / (100 - p), '', 'This is the price of 1 percent.'),
              st('Multiply {2} by 100.', O, 'dollars', '100 percent is the whole original price.')],
      answer: String(O), hint: 'The sale price is a percent of the original. Find 1% first.',
      explanation: 'You pay ' + (100 - p) + '% of the original. ' + S + ' ÷ ' + (100 - p) + ' = ' + (S / (100 - p)) + ' for 1%, so 100% is $' + O + '.' };
  }
  function wpCoins() {
    var q = ri(2, 8), d = ri(2, 9), val = q * 25 + d * 10;
    return { scenario: 'A jar holds only quarters and dimes. There are ' + q + ' quarters and ' + d + ' dimes.',
      question: 'How many cents are in the jar?',
      steps: [st('Multiply ' + q + ' by 25.', q * 25, 'cents', 'A quarter is 25 cents.'),
              st('Multiply ' + d + ' by 10.', d * 10, 'cents', 'A dime is 10 cents.'),
              st('Add {1} and {2}.', val, 'cents', 'Join the two amounts.')],
      answer: String(val), hint: 'Find the value of each kind of coin, then add.',
      explanation: q + ' quarters are ' + (q * 25) + ' cents and ' + d + ' dimes are ' + (d * 10) + ' cents: ' + val + ' cents.' };
  }
  function wpWork() {
    var rate = ri(3, 9), hrs = ri(3, 8), days = ri(2, 6), items = pick(['boxes', 'cakes', 'toys']);
    return { scenario: 'A bakery packs ' + rate + ' ' + items + ' every hour. It works ' + hrs + ' hours a day for ' + days + ' days.',
      question: 'How many ' + items + ' are packed?',
      steps: [st('Multiply ' + rate + ' by ' + hrs + '.', rate * hrs, items, 'This is one day of packing.'),
              st('Multiply {1} by ' + days + '.', rate * hrs * days, items, 'Repeat it for every day.')],
      answer: String(rate * hrs * days), hint: 'Work out one day first, then multiply by the days.',
      explanation: rate + ' × ' + hrs + ' = ' + (rate * hrs) + ' a day, and ' + (rate * hrs) + ' × ' + days + ' = ' + (rate * hrs * days) + '.' };
  }
  function wpDiscountCoupon() {
    var price = ri(10, 40), n = ri(2, 5), coupon = ri(2, 9);
    var total = price * n - coupon;
    return { scenario: 'Shirts cost $' + price + ' each. Sam buys ' + n + ' shirts and uses a $' + coupon + ' coupon on the bill.',
      question: 'How much does he pay?',
      steps: [st('Multiply ' + n + ' by ' + price + '.', n * price, 'dollars', 'The bill before the coupon.'),
              st('Subtract ' + coupon + ' from {1}.', total, 'dollars', 'The coupon comes off the bill.')],
      answer: String(total), hint: 'Find the bill first, then take the coupon off.',
      explanation: n + ' × $' + price + ' = $' + (n * price) + ', and $' + (n * price) + ' − $' + coupon + ' = $' + total + '.' };
  }

  /* ══ CATALOGUE ══════════════════════════════════════════════════════════ */
  var EQ = {
    integers:    [intAdd, intSub, intMul, intDiv, intMix],
    arithmetic:  [opsA, opsB, opsC, opsD, opsE],
    fractions:   [fracAddSame, fracAddUnlike, fracSub, fracMul, fracDiv, fracSimplify, fracOf],
    decimals:    [decAdd, decSub, decMul, decDiv],
    percent:     [pctOf, pctWhat, pctChange, pctWhole, pctRate],
    ratios:      [propSolve, ratioSimplify, unitRate, mapScale, ratioShare],
    exponents:   [expEval, expSpecial, expNeg, expSum, expNegBase, expProduct, expQuot, expPower, sciStandard],
    radicals:    [radPerfect, radSimplify, radSolve, radProduct],
    inequalities:[inA, inB, inC, inD, inE, inF],
    lines:       [lnSlope, lnReadSlope, lnYAt, lnXAt, lnMidpoint, lnDistance],
    quadratics:  [quSquare, quFactor, quDiffSq, quSolve, quExpand, quDisc, quLead],
    geometry:    [geoRectArea, geoRectPerim, geoTriArea, geoCircle, geoPythHyp, geoPythLeg, geoVolume, geoTriAngle, geoSupp, geoPolygon],
    data:        [statMean, statMedian, statMedianEven, statMode, statRange, statMissing, statProb],
    numbers:     [ntGcf, ntLcm, ntFactors, ntRound, ntRoundWhole],
    multistep:   [msDist, msBoth, msNeg, msDivStep, msTwoDist, evalTwo],
    functions:   [fnEval, fnSquare, evalPower]
  };
  /* Added to the general algebra mix, so an "Algebra" day is not five shapes. */
  var GENERAL_EXTRA = [msDist, msBoth, msNeg, msDivStep, evalTwo, evalPower];

  var WP = {
    all: [wpTickets, wpGarden, wpTax, wpInterest, wpTrip, wpTwoLegs, wpRecipe, wpConsecutive, wpAge, wpSavings, wpAverage, wpUnits,
          wpTemperature, wpGrowth, wpSquarePark, wpBulk, wpChange, wpFractionOf, wpReverse, wpCoins, wpWork, wpDiscountCoupon],
    systems:     [wpTickets, wpAge, wpCoins, wpConsecutive, wpChange],
    percent:     [wpTax, wpInterest, wpGrowth, wpReverse, wpDiscountCoupon],
    ratios:      [wpRecipe, wpFractionOf, wpBulk, wpUnits],
    fractions:   [wpFractionOf, wpRecipe],
    decimals:    [wpChange, wpBulk, wpDiscountCoupon],
    geometry:    [wpGarden, wpSquarePark],
    lines:       [wpTrip, wpTwoLegs, wpSavings],
    inequalities:[wpSavings, wpAverage],
    data:        [wpAverage, wpConsecutive],
    numbers:     [wpConsecutive, wpUnits, wpBulk],
    multistep:   [wpTickets, wpAge, wpConsecutive, wpSavings],
    integers:    [wpTemperature, wpChange],
    arithmetic:  [wpChange, wpWork, wpCoins]
  };

  /* A lesson's title -> a family. Order matters: the narrower family goes first
     ("factors and multiples" is number theory, "factoring quadratics" is not). */
  var TOPICS = [
    ['systems',      /system|simultaneous|elimination|two equations|two unknowns|two variables/],
    ['inequalities', /inequalit/],
    ['numbers',      /\bgcf\b|\blcm\b|greatest common|least common|\bprime|multiples|factors and|rounding|round(?:ing)? numbers|place value/],
    ['quadratics',   /quadratic|polynomial|trinomial|factori[sz]ing|\bfactor\b|parabola|zero.product|completing the square/],
    ['radicals',     /radical|square root|\bsurd/],
    ['exponents',    /exponent|\bpowers?\b|indices|index law|scientific notation/],
    ['lines',        /\bslope\b|linear function|\blines?\b|y-intercept|coordinate|midpoint|distance formula|graphing/],
    ['functions',    /function|f\(x\)/],
    ['geometry',     /\barea\b|perimeter|volume|geometry|pythagor|triangle|circle|\bangles?\b|polygon/],
    ['data',         /\bmean\b|median|\bmode\b|statistic|\bdata\b|probabilit|\brange\b/],
    ['multistep',    /multi.?step|both sides|variables on both|literal equation|equations with (?:fractions|decimals|brackets|parentheses)/],
    ['fractions',    /fraction/],
    ['decimals',     /decimal/],
    ['percent',      /percent|%|discount|interest|\btax\b|markup/],
    ['ratios',       /\bratios?\b|proportion|unit rate|scale drawing|\brates?\b/],
    ['integers',     /integer|negative number|signed number/],
    ['arithmetic',   /order of operations|pemdas|bodmas|arithmetic|operations with whole/],
  ];

  function topicFor(title) {
    var t = String(title == null ? '' : title).toLowerCase();
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i][1].test(t)) return TOPICS[i][0];
    return '';
  }
  function equations(key) { return EQ[key] ? EQ[key].slice() : null; }
  function wordFor(key) { return (WP[key] || WP.all).slice(); }

  /* What the plan builder asks the model for on a lesson of this family: the card's
     header for each of the 12 equation cards, and one rule saying how to write the
     problem and the answer so the card and the grader can read them. app.html uses
     it; the topic is matched by topicFor above, so there is ONE list of families. */
  function rep12(a) { var o = []; for (var i = 0; i < 12; i++) o.push(a[i % a.length]); return o; }
  var PROMPTS = {
    inequalities: { forms: rep12(['Solve the inequality']),
      rule: 'every bigequation is an INEQUALITY to solve: question "Solve the inequality", equation like "3x - 5 > 10", answer written like "x > 5" (use ≤ ≥ or <= >=). Include some that divide by a negative number so the sign flips. Whole numbers only.' },
    quadratics: { forms: rep12(['Factor', 'Expand', 'Solve for x', 'Factor', 'Solve for x', 'Find the discriminant']),
      rule: 'question "Factor": equation "x^2 + 5x + 6", answer "(x + 2)(x + 3)". Question "Expand": equation "(x + 3)(x + 2)", answer "x^2 + 5x + 6". Question "Solve for x": equation "x^2 - 5x + 6 = 0", answer EVERY root, "x = 2 or x = 3". Question "Find the discriminant": equation "x^2 + 3x - 4", answer a number. Whole-number roots.' },
    fractions: { forms: rep12(['Add the fractions', 'Subtract the fractions', 'Multiply the fractions', 'Divide the fractions', 'Simplify the fraction', 'Find the amount']),
      rule: 'equation like "2/3 + 1/6", "3/4 × 2/5" or "12/18"; answer a fraction in LOWEST TERMS written "5/6" (or a whole number).' },
    decimals: { forms: rep12(['Evaluate']), rule: 'equation like "3.4 + 2.75" or "4.5 × 0.6"; answer a decimal without trailing zeros.' },
    percent: { forms: rep12(['Percent of a number', 'Find the percent', 'Percent change', 'Find the whole']),
      rule: 'equation is the short problem, like "15% of 80", "What percent is 12 of 48?", "Increase 60 by 25%" or "30 is 20% of what number?"; answer a number ("12") or a percent ("25%"). Whole-number answers only.' },
    ratios: { forms: rep12(['Solve the proportion', 'Simplify the ratio', 'Find the unit rate']),
      rule: 'question "Solve the proportion": equation "x/6 = 10/15", answer a number; "Simplify the ratio": equation "18 : 24", answer "3:4"; "Find the unit rate": equation "36 miles in 4 hours. How many miles in 1 hour?", answer a number.' },
    exponents: { forms: rep12(['Evaluate', 'Simplify']),
      rule: 'write powers with ^: "2^5", "(-2)^3", "x^3 * x^4", "x^9 / x^4", "(x^2)^3". Answers like "32", "x^7", or "1/8" for a negative power.' },
    radicals: { forms: rep12(['Evaluate', 'Simplify', 'Solve for x']),
      rule: 'use √: "√144" (answer 12), "√50" (answer "5√2", fully simplified), "√x = 7" (answer 49).' },
    lines: { forms: rep12(['Find the slope', 'What is the slope?', 'Find the midpoint', 'Find the distance', 'What is the y-intercept?']),
      rule: 'give two points as "(1, 2) and (3, 8)" or a line as "y = 2x + 3"; answer a number, or a point "(2, 5)" for a midpoint. Whole-number answers.' },
    functions: { forms: rep12(['Evaluate the function']),
      rule: 'question "Evaluate the function", equation "f(x) = 3x + 2. Find f(4).", answer a number.' },
    geometry: { forms: rep12(['Find the area', 'Find the perimeter', 'Find the hypotenuse', 'Find the volume', 'Find the missing angle']),
      rule: 'the equation field describes the shape in words with its numbers ("Rectangle: length 9 cm, width 4 cm", "Right triangle: legs 6 and 8"); answer a plain number, or "25π" when asked in terms of π.' },
    data: { forms: rep12(['Find the mean', 'Find the median', 'Find the mode', 'Find the range']),
      rule: 'equation is the list "4, 8, 6, 10, 12"; answer a number. Make the mean a whole number and the mode unique.' },
    numbers: { forms: rep12(['Greatest common factor', 'Least common multiple', 'Round the number']),
      rule: 'equation like "Greatest common factor of 24 and 36" or "Round 4.867 to the nearest tenth"; answer a number.' },
    integers: { forms: rep12(['Evaluate']), rule: 'equation like "-7 + (-5)", "(-8) × 6" or "-56 ÷ 8" with negative numbers; answer an integer.' },
    arithmetic: { forms: rep12(['Evaluate']), rule: 'equation is a multi-step expression for the ORDER OF OPERATIONS, like "3 + 4 × 2" or "(6 + 2) × 5 - 4"; answer a whole number.' },
    multistep: { forms: rep12(['Solve for x']), rule: 'multi-step equations: brackets, x on both sides, negative coefficients, fractions like "x/3 + 4 = 9"; whole-number answers.' }
  };
  function promptFor(key) { return PROMPTS[key] || null; }

  window.SFMathGen = {
    promptFor: promptFor,
    topicFor: topicFor,
    equations: equations,
    wordFor: wordFor,
    general: GENERAL_EXTRA.slice(),
    families: function () { var o = {}; for (var k in EQ) if (EQ.hasOwnProperty(k)) o[k] = EQ[k].length; return o; },
    wordCount: function () { return WP.all.length; }
  };
})();

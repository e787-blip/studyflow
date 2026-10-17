// The question lint in sf-questions.js (Oct 2026): no model call, data in,
// data out. Runs under Node OR macOS's JavaScriptCore:
//   node test_lint.js
//   jsc -e "var SF_REPO='/path/to/repo/'" test_lint.js
// Fails on the code before the lint: a keyless mcq kept as option A, padding
// with "Option N", no shuffle, "All of the above" kept, a TF defaulted to True.
var out = (typeof console !== 'undefined' && console.log) ? function (s) { console.log(s); } : print;
var src;
if (typeof require === 'function') src = require('fs').readFileSync(require('path').join(__dirname, '../../../../sf-questions.js'), 'utf8');
else src = readFile(SF_REPO + 'sf-questions.js');
var window = {};
(new Function('window', src))(window);
var Q = window.SFQuestions, fails = 0;
function ok(c, m) { if (!c) fails++; out((c ? 'PASS ' : 'FAIL ') + m); }
function mcq(o) { var q = { type: 'mcq', question: 'Which organelle makes ATP in a plant cell?', explanation: 'x', difficulty: 'Easy' }; for (var k in o) q[k] = o[k]; return q; }
function run(qs) { return Q.sanitizeDayQuestions({ questions: JSON.parse(JSON.stringify(qs)) }).questions; }
function keyText(q) { return q.options[q.correctIndex]; }

ok(Q && typeof Q.lintQuestion === 'function' && typeof Q.lintDay === 'function', 'lintQuestion and lintDay are exported');

// 1. No key: dropped, never graded against A.
ok(run([mcq({ options: ['Mitochondrion', 'Ribosome', 'Vacuole', 'Wall'] })]).length === 0, 'an mcq with no key is dropped');
ok(run([mcq({ options: ['Mitochondrion', 'Ribosome'], correctIndex: 7 })]).length === 0, 'an out-of-range key is dropped');
ok(run([mcq({ options: ['Mitochondrion', '', 'Vacuole'], correctIndex: 1 })]).length === 0, 'a key pointing at an empty option is dropped');
// Recovered from the other fields models use.
var r = run([mcq({ options: ['Ribosome', 'Mitochondrion', 'Vacuole'], correctLetter: 'B' })]);
ok(r.length === 1 && keyText(r[0]) === 'Mitochondrion', 'a letter key is recovered');
r = run([mcq({ options: ['Ribosome', 'Mitochondrion', 'Vacuole'], answer: 'mitochondrion' })]);
ok(r.length === 1 && keyText(r[0]) === 'Mitochondrion', 'an answer-text key is recovered');
r = run([mcq({ options: ['Ribosome', 'Mitochondrion', 'Vacuole'], correctIndex: '1' })]);
ok(r.length === 1 && keyText(r[0]) === 'Mitochondrion', 'a numeric-string key is recovered');

// 2. No junk padding.
r = run([mcq({ options: ['Mitochondrion', 'Ribosome'], correctIndex: 0 })]);
ok(r.length === 1 && r[0].options.length === 2 && !/Option \d/.test(r[0].options.join('|')), 'two options stay two - no "Option 3" padding');
r = run([mcq({ options: ['Mitochondrion', 'Option 2', 'Option 3', 'Ribosome'], correctIndex: 0 })]);
ok(r.length === 1 && r[0].options.length === 2, 'model-written "Option N" placeholders are removed');

// 3. "All of the above" and duplicates.
ok(run([mcq({ options: ['Sun', 'Water', 'All of the above'], correctIndex: 2 })]).length === 0, 'an "All of the above" KEY is dropped (its meaning was its position)');
r = run([mcq({ options: ['Mitochondrion', 'Ribosome', 'None of the above', 'Both A and B'], correctIndex: 0 })]);
ok(r.length === 1 && r[0].options.length === 2 && keyText(r[0]) === 'Mitochondrion', '"None of the above" / "Both A and B" distractors are removed');
r = run([mcq({ options: ['The mitochondrion', 'the Mitochondrion.', 'Ribosome', 'Ribosome '], correctIndex: 0 })]);
ok(r.length === 1 && r[0].options.length === 2, 'a distractor equal to the answer, and a repeated distractor, are removed');
ok(run([mcq({ options: ['Mitochondrion', 'mitochondrion'], correctIndex: 0 })]).length === 0, 'a card whose only distractor IS the answer is dropped');

// 4. Shuffle and spread.
var day = [], i;
for (i = 0; i < 8; i++) day.push(mcq({ question: 'Question number ' + i + ' about a distinct cell part ' + 'abcdefgh'[i] + 'x' + i, options: ['Right ' + i, 'Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i], correctIndex: 0 }));
var pos = [0, 0, 0, 0], allRight = true;
for (var t = 0; t < 20; t++) {
  run(day).forEach(function (q, j) { pos[q.correctIndex]++; if (keyText(q) !== 'Right ' + j) allRight = false; });
}
ok(allRight, 'after shuffling every key still points at the right answer (160 cards)');
ok(pos[0] === 40 && pos[1] === 40 && pos[2] === 40 && pos[3] === 40, 'keys are dealt evenly across A-D: ' + pos.join('/'));

// 5. True/false.
ok(run([{ type: 'truefalse', question: 'Plants make glucose.', correct: 'maybe' }]).length === 0, 'a TF with no key is dropped (was: defaulted to True)');
r = run([{ type: 'truefalse', question: 'Plants make glucose.', correct: true }, { type: 'truefalse', question: 'Plants eat soil.', correct: 'false' }]);
ok(r.length === 2 && r[0].correct === 'True' && r[1].correct === 'False', 'boolean and lower-case TF keys are normalised');
r = run([1, 2, 3].map(function (n) { return { type: 'truefalse', question: 'Statement ' + n + ' about leaves', correct: 'True' }; }));
ok(r[0]._lint && r[0]._lint.indexOf('tf-all-true') !== -1, 'a day of all-True statements is flagged');

// 6. Same question twice.
r = run([mcq({ question: 'Which organelle makes ATP in a plant cell?', options: ['A1', 'B1'], correctIndex: 0 }),
         mcq({ question: 'Which organelle makes ATP in a plant cell?', options: ['A2', 'B2'], correctIndex: 0 }),
         { type: 'fill', question: 'Which organelle makes ATP in a plant cell? The ___', answer: 'mitochondrion' }]);
ok(r.length === 2, 'the same mcq stem twice is cut to one; a different type on it stays');

// 7. Flags, never drops.
r = run([mcq({ options: ['Because the inner membrane folds increase the surface area for the electron transport chain', 'Heat', 'Light'], correctIndex: 0 })]);
ok(r.length === 1 && r[0]._lint.indexOf('answer-longest') !== -1, 'a much-longest answer is flagged, not dropped');

// 8. A teacher's edit keeps their order and their wording.
r = Q.sanitizeDayQuestions({ questions: [mcq({ options: ['Sun', 'Water', 'All of the above'], correctIndex: 2 })] }, { edit: true }).questions;
ok(r.length === 1 && r[0].correctIndex === 2 && r[0].options.join() === 'Sun,Water,All of the above', 'edit mode: no shuffle, the teacher\'s "All of the above" stays');
ok(Q.sanitizeDayQuestions({ questions: [mcq({ options: ['Sun', 'Water'] })] }, { edit: true }).questions.length === 0, 'edit mode still refuses a card with no key');

// 9. The top-up path: one at a time, then lintDay places them.
var tq = [mcq({ options: ['Right', 'W1', 'W2'], correctIndex: 0 }), { type: 'truefalse', question: 'Leaves are green.', correct: 'nope' }];
var kept = tq.filter(Q.lintQuestion);
kept = Q.lintDay(kept);
ok(kept.length === 1 && keyText(kept[0]) === 'Right' && kept[0]._lintPlace === undefined, 'lintQuestion + lintDay: keyless TF dropped, mcq placed with key intact');

// 10. Other types untouched.
r = run([{ type: 'fill', question: 'Plants make ___ in the chloroplast', answer: 'glucose' }, { type: 'sequence', question: 'Order', items: ['a', 'b', 'c'] }]);
ok(r.length === 2, 'fill and sequence pass through');

out(fails ? fails + ' FAILED' : 'LINT OK');

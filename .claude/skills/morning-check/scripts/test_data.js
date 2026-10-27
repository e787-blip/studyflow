// sf-data.js (Oct 2026): the numbers a lesson's notes give, the chart, the
// table, and the questions built from them. Data in, data out - no page.
//   node test_data.js
//   jsc -e "var SF_REPO='/path/to/repo/'" test_data.js
// Fails on the code before (no sf-data.js).
var out = (typeof console !== 'undefined' && console.log) ? function (s) { console.log(s); } : print;
var src;
if (typeof require === 'function') src = require('fs').readFileSync(require('path').join(__dirname, '../../../../sf-data.js'), 'utf8');
else src = readFile(SF_REPO + 'sf-data.js');
var window = {};
(new Function('window', 'document', 'module', src))(window, undefined, undefined);
var D = window.SFData, fails = 0;
function ok(c, m) { if (!c) fails++; out((c ? 'PASS ' : 'FAIL ') + m); }
function cp(o) { return JSON.parse(JSON.stringify(o)); }

var LUX = { title: 'Oxygen made at each light level', chart: 'line', takeaway: 'More light, more oxygen - until it levels off.',
  cols: [{ name: 'Light', unit: 'lux' }, { name: 'O2 made', unit: 'mL/min' }],
  rows: [['1000', '0.8'], ['5000', '3.1'], ['10000', '5.9'], ['20000', '6.2']] };
var PENS = { title: 'Packs of pens', chart: 'bars', rule: { col: 2, op: 'divide', a: 1, b: 0 },
  cols: [{ name: 'Pens' }, { name: 'Total', unit: '$' }, { name: 'Per pen', unit: '$' }],
  rows: [['24', '24.00', '1.00'], ['4', '6.00', '1.50'], ['10', '12.00', '1.20']] };
var SALES = { title: 'Monthly sales', chart: 'bars', cols: [{ name: 'Month' }, { name: 'Sales', unit: '$1,000s' }],
  rows: [['April', 98], ['May', 100], ['June', 102]] };
var WATER = { title: 'Fresh water', chart: 'donut', cols: [{ name: 'Where' }, { name: 'Share', unit: '%' }],
  rows: [['Ice', '68.7'], ['Groundwater', '30.1'], ['Lakes and rivers', '1.2']] };

ok(D && typeof D.check === 'function' && typeof D.questions === 'function', 'SFData is exported');

// 1. Subjects
ok(D.allowed('science') && D.allowed('economics') && D.allowed('general'), 'science, economics and general get data cards');
ok(!D.allowed('math') && !D.allowed('history') && !D.allowed('english') && !D.allowed('language'), 'maths, history, English and language never do');

// 2. Check
var m = D.check(cp(LUX));
ok(m && m.rows.length === 4 && m.xNum && m.chart === 'line', 'a clean table is kept, numeric rows, line chart');
ok(m && m.cols[1].dp === 1, 'a column keeps the decimals the notes used');
ok(D.check(null) === null && D.check([]) === null && D.check('x') === null, 'nothing, an array or a string is refused');
ok(D.check(Object.assign(cp(LUX), { example: true })) === null, 'an "example" table is refused: no invented numbers');
ok(D.check(Object.assign(cp(LUX), { rows: LUX.rows.slice(0, 2) })) === null, 'two rows are refused');
var bad = cp(LUX); bad.rows[1][1] = 'lots'; ok(D.check(bad) === null, 'a word where a number belongs is refused');
var ragged = cp(LUX); ragged.rows[2] = ['10000']; ok(D.check(ragged) === null, 'a short row is refused');
var dup = cp(SALES); dup.rows[2][0] = 'april'; ok(D.check(dup) === null, 'two rows with the same name are refused');
var hostile = cp(SALES); hostile.title = '<script>alert(1)</script>Sales'; hostile.rows[0][0] = '<img src=x onerror=alert(1)>';
var hm = D.check(hostile);
ok(hm && hm.title.indexOf('<') === -1 && hm.rows[0].label.indexOf('<') === -1, 'markup is stripped from titles and row names');
ok(D.check({ cols: LUX.cols, rows: LUX.rows, '__proto__': { chart: 'line' } }) !== undefined, 'a __proto__ key does not throw');

// 3. Charts fall back honestly
ok(D.check(Object.assign(cp(SALES), { chart: 'line' })).chart === 'bars', 'a line asked for over named rows becomes bars');
ok(D.check(cp(WATER)).chart === 'donut', 'a donut that adds to 100 is a donut');
var w2 = cp(WATER); w2.rows[0][1] = '80'; ok(D.check(w2).chart === 'bars', 'a donut that adds to 111 becomes bars');
ok(D.check(Object.assign(cp(LUX), { chart: 'scatter' })).chart === 'line', 'a scatter of four points becomes a line');
var svg = D.chart(D.check(cp(LUX)), 320);
ok(/^<svg/.test(svg) && svg.indexOf('<script') === -1 && /sfd-line/.test(svg), 'the line chart draws');
ok(/^<svg/.test(D.chart(D.check(cp(WATER)), 320)) && /^<svg/.test(D.chart(D.check(cp(SALES)), 320)), 'the donut and the bars draw');
var fig = D.figure(D.check(hostile), 320);
ok(fig.indexOf('<img') === -1 && fig.indexOf('<script') === -1 && /Chart/.test(fig) && /<table/.test(fig), 'the figure has both views and no hostile markup');
ok(/data-view="table"/.test(D.figure(D.check(Object.assign(cp(SALES), { chart: 'none' })), 320)) &&
   !/sfd-seg/.test(D.figure(D.check(Object.assign(cp(SALES), { chart: 'none' })), 320)), 'chart "none" shows the table with no switch');

// 4. Rules
var pm = D.check(cp(PENS));
ok(pm && pm.rule && pm.rule.text === 'Per pen = Total ÷ Pens', 'a rule that holds on every row is kept and named');
var pb = cp(PENS); pb.rows[2][2] = '1.30';
ok(D.check(pb).rule === null, 'a rule broken on one row is dropped (the table stays)');
ok(D.check(Object.assign(cp(PENS), { rule: { col: 2, op: 'explode', a: 1, b: 0 } })).rule === null, 'an unknown operation is dropped');
ok(D.check(Object.assign(cp(PENS), { rule: { col: 9, op: 'divide', a: 1, b: 0 } })).rule === null, 'a column that is not there is dropped');

// 5. Questions: every key is arithmetic on the table
var q = D.questions(D.check(cp(LUX)), { title: 'Light and photosynthesis', dayIndex: 0 });
ok(q.read && q.read.type === 'readtable' && q.read.mode === 'delta', 'ordered rising rows give a "rise" question');
var rd = q.read, steps = [2.3, 2.8, 0.3];
var want = /most/.test(rd.question) ? 1 : 2;
ok(rd.correctIndex === want, 'the key is the step the table says (' + rd.options[rd.correctIndex] + ')');
ok(q.second === null, 'no rule and not a data day: no second question');
var sq = D.questions(D.check(cp(SALES)), { title: 'Reading sales data', dayIndex: 0 });
ok(sq.read && (sq.read.mode === 'max' || sq.read.mode === 'min') && sq.read.options[sq.read.correctIndex] === (sq.read.mode === 'max' ? 'June' : 'April'),
   'named rows give a highest / lowest question with the right row');
ok(sq.second && sq.second.type === 'badgraph' && sq.second.y0 > 0 && sq.second.y0 < 98, 'close numbers on a data day give "spot the bad graph", axis cut under the lowest');
ok(sq.second && /starts at/.test(sq.second.options[sq.second.correctIndex]), 'its key is the cut axis');
var bars = D.badBars(sq.second, 320, sq.second.y0);
ok(new RegExp('>' + sq.second.y0 + '<').test(bars), 'the cut axis prints its own starting value');
var spread = cp(SALES); spread.rows = [['April', 20], ['May', 60], ['June', 100]];
ok(D.questions(D.check(spread), { title: 'Reading sales data' }).second === null, 'numbers far apart never get a bad graph (the cut would not mislead)');
var VIS = cp(SALES); VIS.title = 'Visitors to the museum';
ok(D.questions(D.check(VIS), { title: 'Museums', dayIndex: 0 }).second === null, 'not a data day and not every third day: no bad graph');
ok(D.questions(D.check(VIS), { title: 'Museums', dayIndex: 2 }).second !== null, 'every third day: a bad graph');
var fq = D.questions(D.check(cp(PENS)), { title: 'Unit price' });
ok(fq.second && fq.second.type === 'filltable' && fq.second.blanks.join() === '1,2' && fq.second.answers.join() === '1.5,1.2',
   'a rule gives "complete the table": the example row kept, the others blank, answers from the table');
var tie = cp(SALES); tie.rows[0][1] = 100;   /* 100, 100, 102: the lowest is a tie */
var tq = D.questions(D.check(tie), { title: 'x' }).read;
ok(tq && tq.mode === 'max' && tq.options[tq.correctIndex] === 'June', 'a tie is never asked about: the lowest is tied, so it asks for the highest');

// 6. Formatting
ok(D.show(1914, 0, true) === '1914' && D.show(20000, 0) === '20,000' && D.show(1.5, 2) === '1.50', 'years have no comma, thousands do, decimals are kept');

out(fails ? fails + ' FAILED' : 'DATA OK');

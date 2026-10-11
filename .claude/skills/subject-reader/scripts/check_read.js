// Checks for sf-subject-read.js, the idea-based reader. Pure logic, ~1 second.
//   node .claude/skills/subject-reader/scripts/check_read.js
//   (no Node?) jsc .claude/skills/morning-check/browser/noderun.js -- "$PWD/.claude/skills/subject-reader/scripts/check_read.js"
// Prints PASS/FAIL per check and "READER OK" when everything holds.
const { T, S } = require('./load')();
const FIX = require('./fixtures');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const base = e => String(e).split(':')[0];
const ONE = ['labeldiagram','corroborate','tracetable','sequence','classify','errorspot','estimate','wordproblem',
  'recall','selfcheck','conceptmap','whosright','readchart'];
const count = l => { const c = {}; l.forEach(e => c[base(e)] = (c[base(e)] || 0) + 1); return c; };
const produce = l => l.filter(e => T.PRODUCE[base(e)]).length;
const clone = o => JSON.parse(JSON.stringify(o));
const I = (claim, nature, confusedWith, core) => ({ claim, nature, confusedWith: confusedWith || '', core: !!core });
const P = (name, parent, ideas) => ({ name, parent, picture: '', ideas });
const mk = (parts, family) => ({ subject: 'x', field: 'Field', family: family || 'general', parts });
const matOf = st => { const m = {}; st.material.forEach(k => m[k] = 1); return m; };

// 1. Every hand-written subject reads, and every part it makes is sound.
const results = {};
for (const f of FIX) {
  const r = S.read(clone(f.raw), clone(f.ctx));
  results[f.name] = r;
  ok(r && r.subtopics.length >= 1, f.name + ': reads into ' + (r ? r.subtopics.length : 0) + ' part(s)');
  if (!r) continue;
  r.subtopics.forEach(st => {
    const c = count(st.types), m = matOf(st);
    const why = [];
    if (st.types.length < 6 || st.types.length > S.DAY_MAX) why.push('length ' + st.types.length);
    if (st.slots.length !== st.types.length) why.push('slots/types differ');
    Object.keys(c).forEach(b => { if (c[b] > (ONE.indexOf(b) >= 0 ? 1 : 2)) why.push(b + ' x' + c[b]); });
    st.types.forEach(e => { if (!T.allowed(e, m, r.family)) why.push(e + ' not allowed'); });
    if (produce(st.types) < Math.ceil(st.types.length / 3)) why.push('only ' + produce(st.types) + ' produce');
    ok(!why.length, '  ' + st.name + ': ' + st.types.length + ' cards, ' + produce(st.types) + ' produce' + (why.length ? ' - ' + why.join(', ') : ''));
  });
}

// 2. The family policy is sf-topics.js's, unchanged.
const fam = n => results[n] && results[n].family;
ok(fam('music theory') === 'general', 'general stays general when the model says general');
ok(fam('nursing pharmacology') === 'science', 'general is upgraded to the model\'s family (science)');
ok(fam('photosynthesis (science, local type stands)') === 'science', 'a family the local classifier chose stands over the model\'s (history)');
ok(fam('Spanish preterite') === 'language' && fam('French Revolution (history)') === 'history', 'language and history hold');
ok(S.read(clone(FIX[0].raw), { localType: 'math', days: 3 }) === null, 'maths never reaches the reader');
ok(S.read(mk([P('Alpha', 'p', [I('a claim that is long enough', 'term'), I('another long enough claim', 'term'), I('a third claim long enough', 'term')])], 'math'), { localType: 'general', days: 3 }).family === 'general',
   'a model that says maths cannot upgrade general to maths');
ok(S.read(clone(FIX[0].raw), { localType: 'bogus', days: 3 }).family === 'general', 'an unknown local type is treated as general');

// 3. Family rules hold everywhere.
const all = [];
FIX.forEach(f => results[f.name] && results[f.name].subtopics.forEach(st => all.push({ f: f.name, fam: results[f.name].family, st })));
ok(all.length >= 14, 'positive count: ' + all.length + ' parts made across ' + FIX.length + ' subjects');
ok(!all.filter(a => a.fam === 'history').some(a => a.st.types.some(e => base(e) === 'truefalse')), 'history has no true/false');
ok(!all.some(a => a.st.types.some(e => base(e) === 'wordproblem')), 'no word problem outside economics');
ok(!all.filter(a => a.fam !== 'language').some(a => a.st.types.some(e => base(e) === 'dictation')), 'dictation only on a language day');
ok(all.filter(a => a.fam === 'language').some(a => a.st.types.some(e => base(e) === 'sentence')), 'a language day builds sentences (positive)');
ok(all.filter(a => a.fam === 'language').some(a => a.st.types.some(e => base(e) === 'dictation')), 'a language day dictates (positive)');

// 4. "Who's right?" exists only where the notes name a real mistake.
const confusedClaims = {};
FIX.forEach(f => f.raw.parts.forEach(p => p.ideas.forEach(d => { if (d.confusedWith) confusedClaims[d.claim] = 1; })));
const wr = [];
all.forEach(a => a.st.slots.forEach(s => { if (base(s.type) === 'whosright') wr.push(s); }));
ok(wr.length >= 3, 'positive count: ' + wr.length + ' who\'s-right cards made');
ok(wr.every(s => confusedClaims[s.claim]), 'every who\'s-right card is built from an idea with a named mistake');
const stripped = clone(FIX[0].raw); stripped.parts.forEach(p => p.ideas.forEach(d => d.confusedWith = ''));
ok(!S.read(stripped, FIX[0].ctx).subtopics.some(st => st.types.some(e => base(e) === 'whosright')), 'with no named mistakes there is no who\'s-right card');

// 5. A format exists because the material can carry it.
const terms = S.read(mk([P('Words', 'Vocab', [1,2,3,4].map(i => I('Term number ' + i + ' means a thing', 'term')))]), { localType: 'general', days: 2 });
ok(terms && terms.subtopics[0].types.length >= 6, 'four terms still fill a day (' + (terms && terms.subtopics[0].types.length) + ' cards)');
ok(!terms.subtopics[0].types.some(e => ['sequence', 'labeldiagram', 'estimate', 'tracetable', 'sentence', 'dictation', 'readchart', 'errorspot'].indexOf(base(e)) >= 0),
   'notes with only terms get no ordering, labelling, estimate, trace or sentence card');
const consid = results['contract law'].subtopics.filter(s => /consideration/i.test(s.name))[0];
ok(consid && !consid.types.some(e => base(e) === 'sequence'), 'a part with no steps or events has no ordering card (invariant 6)');
const steps = results['music theory'].subtopics.filter(s => /interval/i.test(s.name))[0];
ok(steps && steps.types.some(e => ['sequence', 'tracetable', 'errorspot'].indexOf(base(e)) >= 0), 'a part with a step idea gets a step format (positive)');
const hist = results['French Revolution (history)'].subtopics.map(s => s.types.join()).join();
ok(/sequence:chronology/.test(hist), 'dated events earn a chronology card (positive)');
ok(/passage:sourcing/.test(hist), 'a source idea earns a sourcing card (positive)');

// 6. A day is as long as the notes support, and the floor holds.
const eight = S.read(mk([P('Eight', 'p', [I('Cause one is stated here', 'cause'), I('Step two is done like so', 'step'), I('Tell apart one and two', 'distinction'),
  I('Term four means this', 'term'), I('Source five says this', 'source'), I('Rule six decides this', 'rule'), I('The thing has seven parts', 'composition'), I('Event eight happened in 1850', 'event')])]), { localType: 'general', days: 1 });
ok(eight.subtopics[0].types.length === 8, 'eight different ideas make an eight-card day, with no filler (' + eight.subtopics[0].types.length + ')');
const choosing = S.read(mk([P('Confusables', 'p', [1,2,3,4,5,6,7,8].map(i => I('Thing ' + i + ' differs from its twin', 'distinction', i % 2 ? 'Mixing up thing ' + i : '')))]), { localType: 'general', days: 1 });
ok(produce(choosing.subtopics[0].types) >= Math.ceil(choosing.subtopics[0].types.length / 3), 'eight all-choosing ideas still produce a third (' + produce(choosing.subtopics[0].types) + '/' + choosing.subtopics[0].types.length + ')');
const long = S.read(mk([P('Long', 'p', [1,2,3,4,5,6,7,8,9].map(i => I('Plain term ' + i + ' means something', 'term')).concat(
  [I('Core cause alpha is the key idea', 'cause', '', true), I('Core cause beta is the key idea', 'cause', '', true), I('Core cause gamma is the key idea', 'cause', '', true)]))]), { localType: 'general', days: 1 });
const lc = long.subtopics[0].slots.map(s => s.claim);
ok(long.subtopics[0].types.length <= 10, 'twelve ideas are cut to a ten-card day');
ok(lc.filter(c => /Core cause/.test(c)).length === 3, 'the ideas the notes stress survive the cut');
ok(long.subtopics[0].slots.filter(s => s.nature === 'term').length <= 7, 'no one kind of idea takes the whole day while others remain');

// 7. Parts group when days are short, and nothing is lost.
const seven = mk([1,2,3,4,5,6,7].map(i => P('Part ' + i, 'Parent ' + i, [1,2,3].map(j => I('Idea ' + j + ' of part ' + i + ' is stated', j === 1 ? 'cause' : 'term')))));
[1, 2, 4, 7].forEach(days => {
  const r = S.read(clone(seven), { localType: 'general', days });
  const names = {}; r.subtopics.forEach(s => s.parts.forEach(p => names[p] = 1));
  ok(r.subtopics.length === Math.min(days, 6) && Object.keys(names).length === 7, days + ' day(s): ' + r.subtopics.length + ' part(s), all 7 original parts still named');
});
const es = results['Spanish preterite'];
const esNames = {}; es.subtopics.forEach(s => s.parts.forEach(p => esNames[p] = 1));
ok(Object.keys(esNames).length === 3 && es.subtopics.every(s => s.types.length >= 6), 'thin parts fold into their neighbours, none is lost (' + es.subtopics.map(s => s.name).join(' | ') + ')');

// 8. Hostile and malformed input: null or valid, never a throw, never markup.
const goodIdeas = [I('A claim that is long enough', 'term'), I('Another claim long enough', 'cause'), I('A third claim long enough', 'step')];
const hostile = [
  null, undefined, 'prose with no json', '{"parts":"x"}', '[]', 42, {}, { parts: [] }, { parts: [null, 1, 'a', [], {}] },
  mk([{ name: 'A', ideas: 'nope' }]), mk([{ name: 'A', ideas: [null, 1, 'x', [], { nature: 'term' }, { claim: 'long enough claim' }] }]),
  mk([P('Alpha', 'p', [I('claim long enough here', '__proto__'), I('claim long enough here two', 'toString'), I('claim long enough here three', 'constructor')])]),
  mk([P('<script>alert(1)</script>', '<img src=x onerror=1>', goodIdeas.map(d => Object.assign({}, d, { claim: '<script>alert(1)</script> ' + d.claim, confusedWith: '<b>bad</b> mistake' })))]),
  mk([P('Alpha', 'p', [I('x'.repeat(5000), 'term'), I('y'.repeat(5000), 'cause'), I('z'.repeat(5000), 'step')])]),
  mk(new Array(100).fill(0).map((_, i) => P('Part ' + i, 'p' + i, goodIdeas.map(d => Object.assign({}, d, { claim: d.claim + ' ' + i }))))),
  { family: { toString: 1 }, subject: ['a'], parts: [{ name: { a: 1 }, ideas: goodIdeas }] },
  mk([P('Alpha', 'p', [{ claim: { a: 1 }, nature: 'term' }, { claim: ['x'], nature: 'cause' }])])
];
let threw = 0, bad = 0, valid = 0;
hostile.forEach((h, i) => {
  try {
    const r = S.read(h, { localType: 'general', days: 3 });
    if (r) { valid++; if (/[<>]/.test(JSON.stringify(r))) bad++; }
  } catch (e) { threw++; console.log('   threw on #' + i + ': ' + e); }
});
ok(threw === 0, hostile.length + ' hostile inputs, none throws');
ok(bad === 0, 'no angle bracket reaches any output string');
ok(valid >= 3, 'positive count: ' + valid + ' hostile inputs still read into a valid plan');
const big = S.read(hostile[13], { localType: 'general', days: 3 });
ok(big && big.subtopics[0].slots.every(s => s.claim.length <= 140), 'a 5000-character claim is cut to 140');
const many = S.read(hostile[14], { localType: 'general', days: 6 });
ok(many && many.subtopics.length <= 6, 'a hundred parts read as at most six');

// 9. It drops into the slot generateDay reads, and is deterministic.
const need = ['key', 'label', 'name', 'parent', 'parts', 'covers', 'kind', 'material', 'types', 'guide', 'mandate', 'visual', 'focus'];
let shape = 0, shapeTotal = 0;
all.forEach(a => { shapeTotal++; const s = a.st;
  if (need.every(k => s[k] !== undefined) && s.dynamic === true && s.like === '' && Array.isArray(s.types) && !!T.KINDS[s.kind] &&
      s.material.every(m => !!T.MATERIALS[m]) && s.slots.every(x => s.mandate.indexOf(x.claim) >= 0)) shape++; });
ok(shape === shapeTotal, 'all ' + shapeTotal + ' parts carry every field a premade subtopic does, and the mandate lists every idea');
ok(JSON.stringify(S.read(clone(FIX[1].raw), FIX[1].ctx)) === JSON.stringify(S.read(clone(FIX[1].raw), FIX[1].ctx)), 'the same answer always gives the same plan');
ok(JSON.stringify(S.read(JSON.stringify(FIX[1].raw), FIX[1].ctx)) === JSON.stringify(S.read(clone(FIX[1].raw), FIX[1].ctx)), 'a JSON string reads like the object');
ok(S.read('Here you go:\n```json\n' + JSON.stringify(FIX[1].raw) + '\n```', FIX[1].ctx) !== null, 'JSON wrapped in prose and a code fence still reads');

// 10. Subjects with different ideas do not end up with the same day.
const lists = {}; let dup = 0;
all.forEach(a => { const k = a.st.types.join(); if (lists[k]) { dup++; console.log('   same mix: ' + lists[k] + ' / ' + a.f + ' > ' + a.st.name); } lists[k] = a.f + ' > ' + a.st.name; });
ok(Object.keys(lists).length >= all.length * 0.8, Object.keys(lists).length + ' distinct mixes in ' + all.length + ' parts (' + dup + ' repeats)');

// 11. The prompt asks about ideas and never names a format.
const notes = 'word '.repeat(6000);
const p8 = S.prompt({ subject: 'Music', notes: notes.slice(0, 8000), days: 5 }), p30 = S.prompt({ subject: 'Music', notes, days: 5 });
ok(p8.length === p30.length, 'notes are capped: 8 000 and 30 000 characters give the same prompt (' + p8.length + ')');
ok(p30.length < 20000, 'the prompt fits with room to spare (' + p30.length + ' of 60 000)');
ok(Object.keys(S.NATURES).every(k => p30.indexOf('\n                      ' + k) >= 0 || p30.indexOf(k) >= 0), 'the prompt lists every kind of idea');
const names = /\b(mcq|multiple[- ]choice|true\/false|truefalse|fill[- ]in|wordproblem|errorspot|tracetable|matchpairs|whosright|labeldiagram|dictation|twopart|readchart|selfcheck|conceptmap)\b/i;
ok(!names.test(p30), 'the prompt names no question format');
const exm = p30.match(/\n(\{"subject":"Camera[\s\S]*?"\})\n\nNow describe/);
let exOk = false;
try { const r = exm && S.read(exm[1], { localType: 'general', days: 4 }); exOk = !!r && r.subtopics.length >= 1 && r.subtopics[0].slots.length >= 6; } catch (e) { exOk = false; }
ok(exOk, 'the prompt\'s own example reads into a valid day');

console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nREADER OK');

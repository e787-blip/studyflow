// Unit checks for sf-topics.js, the subtopic skill. Pure Node, ~2 seconds.
//   node .claude/skills/subtopics/scripts/check_topics.js
// Prints PASS/FAIL per check and "TOPICS OK" when everything holds.
const { T, SUBTOPICS } = require('./load')();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const base = e => String(e).split(':')[0];
const MATS = Object.keys(T.MATERIALS), KINDS = Object.keys(T.KINDS);
const KNOWN = ['mcq','truefalse','fill','write','classify','sequence','sentence','passage','errorspot','scenario',
  'wordproblem','twopart','corroborate','highlight','tracetable','matchpairs','estimate','readingset','labeldiagram',
  'dictation','recall','selfcheck','conceptmap','whosright','readchart'];
const CAP1 = ['labeldiagram','corroborate','tracetable','sequence','classify','errorspot','estimate','wordproblem',
  'recall','selfcheck','conceptmap','whosright','readchart'];
const produce = l => l.filter(e => T.PRODUCE[base(e)]).length;
function needsMet(e, mat) {
  const need = T.NEEDS[e] || T.NEEDS[base(e)];
  return !need || need.some(n => mat[n]);
}

// 1. Inheriting a premade subtopic whose material supports everything gives
//    back EXACTLY its research-tuned list.
const ALL = {}; MATS.forEach(k => ALL[k] = 1);
let same = 0, total = 0;
for (const fam of Object.keys(SUBTOPICS)) for (const st of SUBTOPICS[fam]) {
  total++;
  const out = T.compose('mechanism', ALL, fam, st.types);
  if (JSON.stringify(out) === JSON.stringify(st.types)) same++;
  else console.log('   ' + fam + '/' + st.key + '\n     was ' + st.types + '\n     now ' + out);
}
ok(same === total && total === 25, 'all ' + total + ' premade mixes survive inheritance unchanged (' + same + ')');

// 2. Every composition, exhaustively: 6 kinds x 8192 material sets x 5
//    families, scratch and inherited. history and language are here for
//    their family rules (no true/false; dictation only on language).
const FAMS = ['general', 'economics', 'science', 'history', 'language'];
let n = 0, bad = [];
function checkMix(out, mat, fam, label, floor, seed) {
  n++;
  const counts = {};
  out.forEach(e => counts[base(e)] = (counts[base(e)] || 0) + 1);
  const why = [];
  if (out.length < 7 || out.length > 10) why.push('length ' + out.length);
  out.forEach(e => {
    if (KNOWN.indexOf(base(e)) < 0) why.push('unknown type ' + e);
    if (!needsMet(e, mat)) why.push(e + ' without its material');
  });
  if (counts.bigequation) why.push('bigequation');
  if (counts.wordproblem && fam !== 'economics') why.push('wordproblem on ' + fam);
  if (counts.dictation && fam !== 'language') why.push('dictation on ' + fam);
  if (counts.truefalse && fam === 'history') why.push('truefalse on history');
  // The caps bound what compose ADDS; an inherited list's own counts stand.
  const own = {}; (seed || []).forEach(e => own[base(e)] = (own[base(e)] || 0) + 1);
  Object.keys(counts).forEach(b => { if (counts[b] > Math.max(CAP1.indexOf(b) >= 0 ? 1 : 2, own[b] || 0)) why.push(counts[b] + 'x ' + b); });
  if (produce(out) < floor) why.push('produce ' + produce(out) + ' < ' + floor);
  const again = JSON.stringify(T.compose.apply(null, label.args));
  if (again !== JSON.stringify(out)) why.push('not deterministic');
  if (why.length && bad.length < 8) bad.push(label.name + ': ' + why.join(', ') + ' -> ' + out.join(','));
  return why.length === 0;
}
const archList = [];
for (const fam of Object.keys(SUBTOPICS)) for (const st of SUBTOPICS[fam]) archList.push(st);
for (let bits = 0; bits < (1 << MATS.length); bits++) {
  const mat = {}; MATS.forEach((k, i) => { if (bits & (1 << i)) mat[k] = 1; });
  for (const kind of KINDS) {
    // The judge adds a kind's own material before composing; mirror it.
    const m = Object.assign({}, mat);
    if (kind === 'language') m.sentences = 1;
    if (kind === 'procedure') m.procedure = 1;
    for (const fam of FAMS) {
      checkMix(T.compose(kind, m, fam, null), m, fam, { name: kind + '/' + fam + '/' + Object.keys(m), args: [kind, m, fam, null] }, 3);
    }
    // Inherited: every archetype against a sample of material sets.
    if (bits % 97 === 0) for (const st of archList) {
      const floor = Math.min(produce(st.types), 4);
      checkMix(T.compose(kind, m, 'general', st.types), m, 'general', { name: 'inherit ' + st.key + '/' + Object.keys(m), args: [kind, m, 'general', st.types] }, floor, st.types);
    }
  }
}
ok(bad.length === 0, n + ' compositions: right length, known types only, every format backed by its material, caps held, ' +
   'no bigequation, wordproblem only on economics, producing floor held, deterministic' + (bad.length ? '\n   ' + bad.join('\n   ') : ''));

// 3. The family policy.
const fam = (local, model) => { const t = T.judge({ family: model, subtopics: [{ name: 'Part one' }] }, { localType: local, days: 3 }); return t ? t.family : null; };
ok(fam('general', 'science') === 'science', 'general is upgraded to the family the model names');
ok(fam('general', 'math') === 'general', 'general is never upgraded to maths');
ok(fam('history', 'general') === 'history' && fam('science', 'history') === 'science', 'a family the local classifier chose stands');
ok(fam('math', 'math') === null, 'maths never reaches the skill');
ok(fam('general', 'astrology') === 'general' && fam(undefined, 'cs') === 'cs', 'an unknown family is general');

// 4. The judge refuses what is not a map, and survives hostile input.
const hostile = ['', 'lol', '[]', 'null', '{}', '{"subtopics":"x"}', '{"subtopics":[{"name":""},{"name":{"a":1}},null,5,[]]}',
  { subtopics: [{ name: 'Ab' }] }, { subtopics: [{ name: 'A' }] }, 42, null, undefined, [], { subtopics: { length: 3 } }];
const refused = hostile.map(h => T.judge(h, { localType: 'general', days: 3, archetypes: SUBTOPICS }));
ok(refused.filter((r, i) => i !== 7).every(r => r === null) && refused[7] && refused[7].subtopics.length === 1,
   'junk (and a one-letter name) comes back null; a bare named part is accepted');
const evil = T.judge({ subject: '<img src=x onerror=alert(1)>', field: 'x'.repeat(500), family: '__proto__', tip: '<script>x</script> say why',
  subtopics: [{ name: '<script>alert(1)</script> Part', parent: { toString: 1 }, covers: ['<b>x</b>', { a: 1 }, 'ok'],
    material: ['__proto__', 'constructor', 'parts', 'toString'], kind: 'constructor', like: '__proto__/x', picture: 'hasOwnProperty',
    ask: 'Ask: <a href=javascript:1>x</a>'.repeat(20) }] }, { localType: 'general', days: 3, archetypes: SUBTOPICS });
const flat = JSON.stringify(evil);
ok(evil && flat.indexOf('<') < 0 && flat.indexOf('>') < 0 && flat.indexOf(' ') < 0, 'no angle brackets or line separators survive anywhere in the output');
ok(evil.family === 'general' && evil.subtopics[0].kind === 'mechanism' && evil.subtopics[0].like === '' &&
   JSON.stringify(evil.subtopics[0].material) === '["parts"]' && evil.subtopics[0].visual === '' && evil.field.length <= 32,
   'prototype keys are not families, kinds, materials, pictures or archetypes; lengths are capped');

// 5. Fitting parts to days: never more parts than days (or 6), nothing dropped.
const names = ['Intervals', 'Triads', 'Chord progressions', 'Cadences', 'Time signatures', 'Syncopation', 'Dynamics', 'Timbre'];
const parents = ['Harmony', 'Harmony', 'Harmony', 'Harmony', 'Rhythm', 'Rhythm', 'Expression', 'Expression'];
let fitOk = true, fitMsg = [];
for (let parts = 1; parts <= 8; parts++) for (let days = 1; days <= 9; days++) for (const mixParents of [true, false]) {
  const subs = names.slice(0, parts).map((nm, i) => ({ name: nm, parent: mixParents ? parents[i] : 'P' + i, covers: ['a' + i, 'b' + i], kind: 'facts' }));
  const t = T.judge({ field: 'Music', subtopics: subs }, { localType: 'general', days: days, archetypes: SUBTOPICS });
  const cap = Math.min(days, 6);
  const text = t.subtopics.map(s => (s.name + ' ' + s.covers.join(' ')).toLowerCase()).join(' | ');
  const lost = names.slice(0, parts).filter(nm => text.indexOf(nm.toLowerCase()) < 0);
  const keys = t.subtopics.map(s => s.key);
  if (t.subtopics.length !== Math.min(parts, cap) || lost.length || new Set(keys).size !== keys.length) {
    fitOk = false; if (fitMsg.length < 4) fitMsg.push(parts + ' parts/' + days + ' days: ' + t.subtopics.length + ' subtopics, lost ' + lost);
  }
}
ok(fitOk, 'parts fit the days (min(parts, days, 6)), every part is still named somewhere, keys unique' + (fitMsg.length ? '\n   ' + fitMsg.join('\n   ') : ''));
const two = T.judge({ field: 'Music', subtopics: names.slice(0, 5).map((nm, i) => ({ name: nm, parent: parents[i] })) }, { localType: 'general', days: 2 });
ok(two.subtopics.map(s => s.name).join('|') === 'Harmony|Time signatures', 'short plans generalise siblings under their parent: ' + two.subtopics.map(s => s.name).join('|'));
const dup = T.judge({ subtopics: [{ name: 'Triads' }, { name: 'triads!' }, { name: 'Cadences' }] }, { localType: 'general', days: 5 });
ok(dup.subtopics.length === 2, 'the same part named twice is one part');

// 6. "like" inherits a premade shape, and the material still decides.
const life = T.judge({ family: 'science', subtopics: [{ name: 'Leaf anatomy', kind: 'mechanism', material: ['parts', 'order', 'categories'], like: 'science/life' }] }, { localType: 'general', days: 3, archetypes: SUBTOPICS });
ok(JSON.stringify(life.subtopics[0].types) === JSON.stringify(SUBTOPICS.science[0].types) && life.subtopics[0].like === 'science/life' &&
   /For this kind of material in general: ASK: the order of a real process/.test(life.subtopics[0].guide),
   'like:"science/life" with matching material inherits its exact mix and guide');
const bare = T.judge({ subtopics: [{ name: 'Nutrients', kind: 'facts', material: [], like: 'science/life' }] }, { localType: 'general', days: 3, archetypes: SUBTOPICS });
ok(!bare.subtopics[0].types.some(e => /labeldiagram|sequence|classify/.test(e)), 'but without parts, order or categories it drops the labelling, ordering and sorting cards: ' + bare.subtopics[0].types);
ok(T.judge({ subtopics: [{ name: 'Memory', like: 'psychology/biocog' }] }, { localType: 'general', days: 3, archetypes: SUBTOPICS }).subtopics[0].like === 'psychology/bioCog', 'archetype keys match regardless of case');

// 7. The prompt: everything the model is asked to choose from, the notes capped.
const p = T.prompt({ subject: 'Music theory', notes: 'N'.repeat(20000), days: 5, archetypes: SUBTOPICS });
ok(p.length < 17000 && (p.match(/N/g) || []).length <= 8000 + 40, 'prompt reads at most the 8000 characters the days read (' + p.length + ' chars)');
ok(Object.keys(T.FAMILIES).every(k => p.indexOf('     ' + k) >= 0) && KINDS.every(k => p.indexOf(k) >= 0) &&
   MATS.every(k => p.indexOf(k) >= 0) && /science\/life \(Life science\)/.test(p) && /general\/study/.test(p),
   'prompt lists every family, kind, material and premade subtopic');
ok(/"subtopics":\[\{"name":"","parent":""/.test(p.slice(-400)), 'prompt ends with the shape to return');

console.log(fails ? fails + ' FAILED' : 'TOPICS OK');

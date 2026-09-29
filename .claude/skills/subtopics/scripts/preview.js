// See what the subtopic skill makes of a description, without a browser.
//
//   node preview.js                               the demo map at 1, 2, 3 and 7 days
//   node preview.js answer.json [days] [family]   judge a saved model answer
//   node preview.js --mix <kind> <m1,m2> [family] [like]   one mix
//   node preview.js --prompt notes.txt [subject] [days]    the prompt and its size
//
// family is the LOCAL classifier's answer (default general), like is a premade
// "family/key". Everything runs through the real sf-topics.js and the real
// SUBTOPICS table from app.html.
const fs = require('fs');
const { T, SUBTOPICS } = require('./load')();
const NAME = { mcq: 'MCQ', truefalse: 'True/False', fill: 'Fill', write: 'Write', classify: 'Classify', sequence: 'Sequence',
  sentence: 'Sentence', passage: 'Passage', errorspot: 'Errorspot', scenario: 'Scenario', wordproblem: 'Wordproblem',
  twopart: 'Two-part', corroborate: 'Corroborate', highlight: 'Find-the-evidence', tracetable: 'Trace table',
  matchpairs: 'Match pairs', estimate: 'Estimate', readingset: 'Reading set', labeldiagram: 'Label the diagram' };
function tally(types) {
  const order = [], c = {};
  types.forEach(t => { const b = t.split(':')[0]; if (!c[b]) { c[b] = 0; order.push(b); } c[b]++; });
  return order.map(b => c[b] + ' ' + (NAME[b] || b)).join(', ');
}
const produce = l => l.filter(e => T.PRODUCE[e.split(':')[0]]).length;
function show(t, days) {
  if (!t) { console.log('  judge returned null - the plan would be built the old way (premade keyword match)'); return; }
  console.log('  field ' + (t.field || '-') + ' | family ' + t.family + (t.modelFamily && t.modelFamily !== t.family ? ' (model said ' + t.modelFamily + ')' : '') +
              ' | ' + t.subtopics.length + ' part' + (t.subtopics.length === 1 ? '' : 's') + (days ? ' for ' + days + ' day' + (days === 1 ? '' : 's') : ''));
  t.subtopics.forEach((s, i) => {
    console.log('\n  ' + (i + 1) + '. ' + s.focus);
    console.log('     ' + s.kind + ' [' + s.material.join(', ') + ']' + (s.like ? ' like ' + s.like : ''));
    console.log('     ' + tally(s.types) + '   (' + produce(s.types) + '/' + s.types.length + ' produce)');
    console.log('     ' + s.guide.slice(0, 160) + (s.guide.length > 160 ? '...' : ''));
  });
  if (t.tip) console.log('\n  tip: ' + t.tip);
}
const a = process.argv.slice(2);
if (a[0] === '--mix') {
  const mat = {}; (a[2] || '').split(',').filter(Boolean).forEach(k => mat[k] = 1);
  const like = a[4] ? (SUBTOPICS[a[4].split('/')[0]] || []).find(s => s.key.toLowerCase() === (a[4].split('/')[1] || '').toLowerCase()) : null;
  const out = T.compose(a[1], mat, a[3] || 'general', like ? like.types : null);
  console.log(out.join(', ') + '\n' + tally(out) + '   (' + produce(out) + '/' + out.length + ' produce)');
} else if (a[0] === '--prompt') {
  const p = T.prompt({ subject: a[2] || '', notes: fs.readFileSync(a[1], 'utf8'), days: +a[3] || 5, archetypes: SUBTOPICS });
  console.log(p + '\n\n--- ' + p.length + ' characters');
} else if (a[0]) {
  const days = +a[1] || 5;
  show(T.judge(fs.readFileSync(a[0], 'utf8'), { localType: a[2] || 'general', days, archetypes: SUBTOPICS }), days);
} else {
  const demo = { subject: 'Intervals, triads and progressions', field: 'Music', family: 'general', tip: 'Name the chord, say what it does in the key, and spell an example.',
    subtopics: [
      { name: 'Intervals', parent: 'Harmony', covers: ['half steps', 'major and minor thirds', 'perfect fifth'], kind: 'procedure', material: ['calculation', 'categories'], ask: 'Count the half steps between two named notes and name the interval', avoid: 'Defining interval with no notes to measure', picture: 'drawing' },
      { name: 'Triads', parent: 'Harmony', covers: ['root, third, fifth', 'major against minor'], kind: 'mechanism', material: ['parts', 'categories'], ask: 'Build a triad on a given root', avoid: 'Naming triad types with no notes', picture: 'parts' },
      { name: 'Chord progressions', parent: 'Harmony', covers: ['I-IV-V-I', 'tonic, subdominant, dominant'], kind: 'application', material: ['order', 'cases'], ask: 'Say which chord resolves a described progression', avoid: 'Listing Roman numerals', picture: 'flow' },
      { name: 'Time signatures', parent: 'Rhythm', covers: ['4/4', 'beats per measure'], kind: 'facts', material: ['numbers'], picture: 'concept' }] };
  for (const d of [7, 3, 2, 1]) { console.log('\n=== music theory, ' + d + '-day plan'); show(T.judge(demo, { localType: 'general', days: d, archetypes: SUBTOPICS }), d); }
}

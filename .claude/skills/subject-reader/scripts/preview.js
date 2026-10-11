// See what the idea-based reader makes of an answer, without a browser.
//
//   node preview.js                              every hand-written subject (fixtures.js)
//   node preview.js <name>                       one fixture, by part of its name
//   node preview.js answer.json [days] [family]  a saved model answer (new format)
//   node preview.js --prompt notes.txt [subject] [days]   the prompt and its size
//
// (no Node?) jsc .claude/skills/morning-check/browser/noderun.js -- "$PWD/.claude/skills/subject-reader/scripts/preview.js" [args]
const fs = require('fs');
const { T, S } = require('./load')();
const base = e => String(e).split(':')[0];
const produce = l => l.filter(e => T.PRODUCE[base(e)]).length;
function show(r) {
  if (!r) { console.log('  read() returned null - the plan would be built the old way'); return; }
  console.log('  ' + (r.subject || '-') + ' | field ' + (r.field || '-') + ' | family ' + r.family +
              (r.modelFamily && r.modelFamily !== r.family ? ' (model said ' + r.modelFamily + ')' : '') +
              ' | ' + r.subtopics.length + ' part' + (r.subtopics.length === 1 ? '' : 's'));
  r.subtopics.forEach((s, i) => {
    console.log('\n  ' + (i + 1) + '. ' + s.focus);
    console.log('     ' + s.types.length + ' cards, ' + produce(s.types) + ' produce   [' + s.material.join(', ') + ']');
    s.slots.forEach((x, n) => console.log('     ' + (n + 1) + '. ' + (x.type + '            ').slice(0, 20) + (x.nature + '          ').slice(0, 12) + x.claim));
  });
  if (r.tip) console.log('\n  tip: ' + r.tip);
}
const a = process.argv.slice(2);
if (a[0] === '--prompt') {
  const p = S.prompt({ subject: a[2] || '', notes: fs.readFileSync(a[1], 'utf8'), days: +a[3] || 5 });
  console.log(p + '\n\n--- ' + p.length + ' characters');
} else if (a[0] && /\.json$/.test(a[0])) {
  const days = +a[1] || 5;
  show(S.read(fs.readFileSync(a[0], 'utf8'), { localType: a[2] || 'general', days }));
} else {
  const FIX = require('./fixtures');
  FIX.filter(f => !a[0] || f.name.toLowerCase().indexOf(a[0].toLowerCase()) >= 0).forEach(f => {
    console.log('\n=== ' + f.name + ' (' + f.ctx.days + ' days, local type ' + f.ctx.localType + ')');
    show(S.read(JSON.parse(JSON.stringify(f.raw)), f.ctx));
  });
}

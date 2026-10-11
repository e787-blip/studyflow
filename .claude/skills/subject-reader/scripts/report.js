// Reads what run_models.py saved and compares the idea reader (new) with the
// live subtopic map (old), model by model, on the same notes.
//   report.js <out dir>
const fs = require('fs');
const { T, S, SUBTOPICS } = require('./load')();
const dir = process.argv[2].replace(/\/$/, '');
const results = JSON.parse(fs.readFileSync(dir + '/results.json', 'utf8'));
const base = e => String(e).split(':')[0];
const produce = l => l.filter(e => T.PRODUCE[base(e)]).length;
const tally = l => { const c = {}; l.forEach(e => c[base(e)] = (c[base(e)] || 0) + 1); return Object.keys(c).map(k => c[k] + ' ' + k).join(', '); };
const names = []; results.forEach(r => { if (names.indexOf(r.name) < 0) names.push(r.name); });
const flags = [];
names.forEach(name => {
  const rows = results.filter(r => r.name === name);
  console.log('\n== ' + name + '  (' + rows[0].ctx.localType + ', ' + rows[0].ctx.days + ' days)');
  rows.forEach(r => {
    const tag = '  ' + (r.model + '                              ').slice(0, 28) + (r.kind === 'new' ? 'new ' : 'old ') + (r.seconds != null ? r.seconds.toFixed(1) + 's ' : '-- ');
    if (r.error) { console.log(tag + 'FAILED: ' + r.error); flags.push(name + ' / ' + r.model + ' / ' + r.kind + ': call failed'); return; }
    const raw = fs.readFileSync(r.file, 'utf8');
    if (r.seconds > 20) flags.push(name + ' / ' + r.model + ' / ' + r.kind + ': ' + r.seconds.toFixed(1) + 's is over the 20 s cap, so the app would give up and fall back');
    if (r.kind === 'new') {
      const o = T.parse(raw), plan = S.read(raw, r.ctx);
      if (!plan) { console.log(tag + 'read() returned null'); flags.push(name + ' / ' + r.model + ': new answer unusable'); return; }
      const nat = {}; let ideas = 0, bad = 0;
      (o.parts || []).forEach(p => (p.ideas || []).forEach(d => { ideas++; if (S.NATURES[d && d.nature]) nat[d.nature] = (nat[d.nature] || 0) + 1; else bad++; }));
      const top = Object.keys(nat).sort((a, b) => nat[b] - nat[a])[0];
      if (top && nat[top] > ideas / 2) flags.push(name + ' / ' + r.model + ': more than half the ideas are "' + top + '"');
      if (bad) flags.push(name + ' / ' + r.model + ': ' + bad + ' idea(s) had a nature outside the list');
      console.log(tag + plan.subtopics.length + ' parts, ' + ideas + ' ideas | family ' + plan.family + (plan.modelFamily && plan.modelFamily !== plan.family ? ' (model: ' + plan.modelFamily + ')' : '') +
        ' | cards ' + plan.subtopics.map(s => s.types.length).join('/') + ' | produce ' + plan.subtopics.map(s => produce(s.types)).join('/'));
      console.log('      natures: ' + Object.keys(nat).map(k => k + ' ' + nat[k]).join(', '));
      plan.subtopics.forEach(s => console.log('      - ' + s.name + ': ' + tally(s.types)));
    } else {
      const plan = T.judge(raw, { localType: r.ctx.localType, days: r.ctx.days, subject: r.ctx.subject, archetypes: SUBTOPICS });
      if (!plan) { console.log(tag + 'judge() returned null'); return; }
      console.log(tag + plan.subtopics.length + ' parts | family ' + plan.family + ' | cards ' + plan.subtopics.map(s => s.types.length).join('/') + ' | produce ' + plan.subtopics.map(s => produce(s.types)).join('/'));
      plan.subtopics.forEach(s => console.log('      - ' + s.name + ': ' + tally(s.types)));
    }
  });
});
console.log(flags.length ? '\nTO LOOK AT:\n  ' + flags.join('\n  ') : '\nNo flags.');

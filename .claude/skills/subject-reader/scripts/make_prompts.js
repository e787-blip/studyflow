// Prints {name: {ctx, newPrompt, oldPrompt}} as JSON for run_models.py.
//   make_prompts.js <subjects.json>      [{name, subject, localType, days, notes}]
// newPrompt is this prototype's; oldPrompt is the live sf-topics.js one, so the
// two can be compared on the same notes by the same model.
const fs = require('fs');
const { T, S, SUBTOPICS } = require('./load')();
const subjects = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = {};
subjects.forEach(s => {
  const f = { subject: s.subject, notes: s.notes, days: s.days };
  out[s.name] = {
    ctx: { localType: s.localType || 'general', days: s.days, subject: s.subject },
    newPrompt: S.prompt(f),
    oldPrompt: T.prompt(Object.assign({ archetypes: SUBTOPICS }, f))
  };
});
console.log(JSON.stringify(out));

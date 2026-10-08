// Loads the REAL sf-topics.js and the REAL premade SUBTOPICS table out of
// app.html, so a test can never pass against a copy that has drifted.
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '../../../..');
function load() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(REPO, 'sf-topics.js'), 'utf8'), ctx, { filename: 'sf-topics.js' });
  const app = fs.readFileSync(path.join(REPO, 'app.html'), 'utf8');
  const m = app.match(/var SUBTOPICS = (\{[\s\S]*?\n  \});/);
  if (!m) throw new Error('SUBTOPICS not found in app.html - did its declaration move?');
  const SUBTOPICS = vm.runInNewContext('(' + m[1] + ')');
  return { T: ctx.window.SFTopics, SUBTOPICS, REPO };
}
module.exports = load;

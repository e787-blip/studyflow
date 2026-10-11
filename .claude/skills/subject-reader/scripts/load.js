// Loads the REAL sf-topics.js (which sf-subject-read.js depends on) and the
// prototype itself into one context. Runs under Node or, with
// morning-check/browser/noderun.js, under macOS's own JavaScriptCore.
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '../../../..');
function load() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(REPO, 'sf-topics.js'), 'utf8'), ctx, { filename: 'sf-topics.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sf-subject-read.js'), 'utf8'), ctx, { filename: 'sf-subject-read.js' });
  const app = fs.readFileSync(path.join(REPO, 'app.html'), 'utf8');
  const m = app.match(/var SUBTOPICS = (\{[\s\S]*?\n  \});/);
  if (!m) throw new Error('SUBTOPICS not found in app.html - did its declaration move?');
  const SUBTOPICS = vm.runInNewContext('(' + m[1] + ')');
  return { T: ctx.window.SFTopics, S: ctx.window.SFSubjectRead, SUBTOPICS, REPO };
}
module.exports = load;

// Parse every inline <script> of every page, and every standalone .js, in JSC.
// Classic scripts via new Function; module scripts via checkModuleSyntax.
var REPO = process.argv[2];
var fs = require('fs');
var files = process.argv.slice(3);
var fails = 0, n = 0;
files.forEach(function (f) {
  var src = fs.readFileSync(REPO + '/' + f, 'utf8');
  if (/\.js$/.test(f)) {
    n++;
    try { if (/^\s*(export|import)\s/m.test(src)) checkModuleSyntax(src); else new Function('require', 'module', 'exports', src); }
    catch (e) { fails++; console.log('FAIL ' + f + ': ' + e.message); }
    return;
  }
  var re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, m, i = 0;
  while ((m = re.exec(src))) {
    if (m[1] && /src=/.test(m[1])) continue;
    i++; n++;
    var isModule = m[1] && /type=["']?module/.test(m[1]);
    var isData = m[1] && /type=["']?(application\/(ld\+)?json|text\/template)/.test(m[1]);
    try {
      if (isData) JSON.parse(m[2]);
      else if (isModule) checkModuleSyntax(m[2]);
      else new Function(m[2]);
    } catch (e) { fails++; console.log('FAIL ' + f + ' block ' + i + (isModule ? ' (module)' : '') + ': ' + e.message); }
  }
});
console.log(n + ' scripts parsed, ' + fails + ' failed');
console.log(fails ? 'PARSE FAIL' : 'PARSE OK');

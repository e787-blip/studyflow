const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(src))) {
    if (m[1] && /src=/.test(m[1])) continue;
    i++;
    try { new Function(m[2]); console.log(f, 'block', i, 'OK', m[2].length); }
    catch (e) { console.log(f, 'block', i, 'FAIL', e.message); process.exitCode = 1; }
  }
}

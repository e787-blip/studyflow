// Serve Google Fonts from local copies so screenshots use the app's real fonts.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'fonts');
module.exports = async function (ctx) {
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(DIR, 'fonts.css'), 'utf8') }));
  await ctx.route('https://fonts.gstatic.com/**', r => {
    const f = r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_');
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(p) });
  });
};

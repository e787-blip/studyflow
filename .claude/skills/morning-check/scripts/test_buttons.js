// One button on every page (Nov 2026, sf-buttons.css). The main button used to
// be 40, 47, 48, 49, 50, 52 and 54px tall with four corner styles, three blues
// and four press feels, because every page carried its own .btn. This loads
// each page that uses the shared file and fails if a .btn differs: height,
// corners, type, colour, shadow, and the press. It counts the buttons it
// measured, because "no button was wrong" is also what a page with no buttons
// looks like.
const { chromium } = require('./pw');
let fails = 0; const assert = (c, m) => { if (!c) { fails++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m); };
const BASE = process.env.SF_BASE || 'http://localhost:8765/';
// page -> fewest visible .btn it must show (so a renamed class cannot hide a page)
const PAGES = { index: 5, about: 1, pricing: 3, login: 2, 'teacher-login': 1, contact: 1, parent: 0, app: 2, dashboard: 3 };
// These two send anyone without a teacher session to sign-in, so a plain load measures the
// SIGN-IN page and passes for the wrong reason. They are measured from their own markup
// (scripts stripped, every hidden panel shown) - which covers the static buttons and every
// CSS rule; buttons the page's script writes later are covered by the stray-rule check.
const STATIC = { teacher: 3, 'teacher-build': 8 };

function measure() {
  const rows = [];
  document.querySelectorAll('.btn').forEach(el => {
    // Layout size (offsetHeight), not getBoundingClientRect: a card that is still
    // scaling in (the reveal) or a 3D scene would read smaller than it is.
    if (el.offsetWidth < 20 || el.offsetHeight < 20) return;
    const cs = getComputedStyle(el);
    rows.push({ cls: el.className, h: el.offsetHeight, rad: cs.borderTopLeftRadius, fs: cs.fontSize, fw: cs.fontWeight,
      ff: cs.fontFamily.split(',')[0].replace(/"/g, ''), bg: cs.backgroundColor, sh: cs.boxShadow,
      small: el.classList.contains('btn-sm'), text: el.classList.contains('btn-text'),
      off: el.disabled || el.getAttribute('aria-disabled') === 'true',
      primary: el.classList.contains('btn-primary') || el.classList.contains('btn-blue') });
  });
  // The press, read from the stylesheets: the .btn:active rule in sf-buttons.css, and any
  // OTHER rule on a .btn that presses with transform (the old per-page feels).
  let press = null; const strays = [];
  for (const ss of document.styleSheets) {
    let rules; try { rules = ss.cssRules; } catch (e) { continue; }
    const shared = /sf-buttons\.css/.test(ss.href || '');
    const walk = (list, inMedia) => { for (const r of list) {
      if (r.cssRules && !r.selectorText) { walk(r.cssRules, true); continue; }
      const sel = r.selectorText || ''; if (!sel) continue;
      if (shared) { if (!inMedia && /\.btn:active/.test(sel) && r.style.scale) press = String(parseFloat(r.style.scale)); continue; }
      if (/(^|,)\s*\.btn(-primary|-blue|-secondary|-outline|-light|-glass|-text|-sm)?\s*(:active)?\s*(,|$)/.test(sel)) {
        const s = r.style; if (s.transform || s.scale || s.borderRadius || s.minHeight || s.height || s.padding) strays.push(sel);
      }
    } };
    walk(rules, false);
  }
  return { rows, press, strays };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const seen = {};
  for (const [name, min] of Object.entries(Object.assign({}, PAGES, STATIC))) {
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    if (STATIC[name]) {
      // Written into a same-origin HTML page with document.write (setContent is not in every harness;
      // an image document does not load the stylesheets written into it).
      await page.goto(BASE + 'privacy.html');
      await page.evaluate(async ({ name, base }) => {
        const t = await (await fetch(base + name + '.html')).text();
        document.open(); document.write(t.replace(/<script[\s\S]*?<\/script>/gi, '').replace('<head>', '<head><base href="' + base + '">')); document.close();
      }, { name, base: BASE });
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => document.querySelectorAll('body *').forEach(el => { if (/^(TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return; el.removeAttribute('hidden'); if (getComputedStyle(el).display === 'none') el.style.setProperty('display', 'block', 'important'); }));
    } else {
      // A signed-in learner, seeded the way harness.js does (an init script is not in every harness).
      await page.goto(BASE + 'favicon.png');
      await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('studyflow_user', JSON.stringify({ name: 'Test Learner', email: 't@example.com', tier: 'free', grade: '7' })); localStorage.setItem('studyflow_onboarded', '1'); } catch (e) {} });
      await page.goto(BASE + name + '.html?cb=' + Date.now(), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      assert(page.url().indexOf('/' + name + '.html') > -1, name + ': stayed on its own page (' + page.url().replace(BASE, '') + ')');
    }
    await page.waitForTimeout(800);
    const m = await page.evaluate(measure);
    assert(m.rows.length >= min, name + ': measured ' + m.rows.length + ' buttons (needs ' + min + '+)');
    const key = r => [r.small ? 40 : 48, r.small ? '10px' : '12px'].join('/');
    const bad = m.rows.filter(r => {
      const want = r.small ? { h: 40, rad: '10px', fs: '14px' } : { h: 48, rad: '12px', fs: '15px' };
      if (r.text && !r.small) return Math.abs(r.h - 48) > 0.6;
      return Math.abs(r.h - want.h) > 0.6 || r.rad !== want.rad;
    });
    assert(bad.length === 0, name + ': every button is 48px with 12px corners (40px with 10px for .btn-sm)' + (bad.length ? ' - ' + bad.map(r => r.cls + ' ' + Math.round(r.h) + 'px ' + r.rad).join('; ') : ''));
    const off = m.rows.filter(r => !r.small && (r.fs !== '15px' || r.fw !== '600' || r.ff !== 'DM Sans'));
    assert(off.length === 0, name + ': type is DM Sans 15px 600' + (off.length ? ' - ' + off.map(r => r.cls + ' ' + r.fs + '/' + r.fw + ' ' + r.ff).join('; ') : ''));
    const prim = m.rows.filter(r => r.primary && !r.off);
    assert(prim.every(r => r.bg === 'rgb(53, 103, 224)' || r.bg === 'rgb(42, 82, 212)'), name + ': every primary is #3567e0' + (prim.length ? '' : ' (none on this page)'));
    assert(m.rows.every(r => r.sh === 'none'), name + ': flat, no shadow on any button');
    assert(m.press === '0.97', name + ': the press is scale .97 (' + m.press + ')');
    assert(m.strays.length === 0, name + ': no page-local rule re-sizes or re-presses a .btn' + (m.strays.length ? ' - ' + m.strays.join(' | ') : ''));
    assert(errs.length === 0, name + ': no page errors ' + errs.join('|'));
    seen[name] = m.rows.length; await page.close();
  }
  console.log('measured', JSON.stringify(seen));
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'BUTTONS OK');
})();

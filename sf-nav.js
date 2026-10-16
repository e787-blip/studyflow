/* sf-nav.js — the site's top navigation, ONE copy for every page that has it.

   Every page used to carry its own nav, and they drifted: a white bar on
   Terms, another on Help, a third on the Parent view, a capsule variant on
   Our story and Plans. This file is the fix by construction. A page loads it
   as the first thing in <body> and the nav appears where the tag is:

       <script src="sf-nav.js"></script>

   It is index.html's nav in the state that page shows once you scroll past
   the hero: the logo, the light glass pill with the lens under the page you
   are on, "My Dashboard" for whoever is signed in, and the blue "Build my
   plan" button, all on the frosted bar. Same sizes, same colours, same
   breakpoints (the pill goes below 1080px, My Dashboard below 640px).

   index.html keeps its own copy: its nav turns from white-on-navy to this
   one as the 3D hero scrolls away, and its script drives that. If you change
   the nav, change this file AND the nav block in index.html.

   Why it looks the way it does:
   - It is a script, not a stylesheet, so the CSS lands in the same moment as
     the markup. A <link> added by a script is not render-blocking, and the
     nav would flash unstyled.
   - It carries its own fonts. Terms and Privacy never loaded Inter, so the
     logo's "StudyFlow" fell back to the system font, and none of the old
     pages loaded DM Sans 700, so the button was a faked bold.
   - Everything is pinned (font, size, line-height, colours): the pages have
     their own generic `nav {}` and `a {}` rules and different body
     line-heights (Terms is 1.7), and any of them leaking in is what made
     the old navs look different from page to page.
   - It does not animate in. index.html's nav slides in once when you arrive;
     on a page you clicked through to, a nav that re-enters every time reads
     as a different nav.
   - The lens is placed first with no transition, and `.ready` turns the
     transition on after: otherwise it slides in from the left on every load.

   A signed-in student's "Build my plan" goes straight to app.html instead of
   through sign-up, as on index.html. That is done for every such link on the
   page, once the page has loaded, because this script runs before the page's
   own buttons exist.

   ONE BAR ON EVERY PAGE. The screens inside the app use it too, in "app"
   mode, because their bars had drifted the same way (four logos at three
   sizes, three bar colours, a different button on each):

       <template id="sf-nav-controls"> ...the page's own buttons... </template>
       <script src="sf-nav.js" data-mode="app" data-home="dashboard.html" data-id="topbar"></script>

   App mode is the same frosted bar, the same logo at the same size and the
   same padding, but it takes room in the page (sticky, not fixed) and swaps
   the site links for the page's controls: the template's children go on the
   right, and one marked data-sf-slot="mid" goes between the logo and them
   (the session's time bar). They are moved, not copied, before the page's
   own script runs, so ids and inline handlers work as they did. The nav
   offers the button styles the controls use - .nav-dashboard (outlined
   pill), .nav-cta (solid pill), .nav-icon (round icon button), .nav-chip -
   so a page does not style its own; .nav-wide is hidden on a phone. Dark mode follows body.dark or
   html.dark, whichever the page uses. The logo drops its word and keeps its mark
   only where the controls need the room: on a phone when there is a mid
   slot (the session), and under 360px on any app page.

   data-home is where the logo goes (a learner mid-session should not land
   on the marketing page); data-id gives the nav the id the page's script
   already looks for. */
(function () {
  'use strict';
  if (document.querySelector('nav.site-nav')) return;   // index.html builds its own

  var self = document.currentScript;

  var CSS = [
    'nav.site-nav, nav.site-nav *, nav.site-nav *::before, nav.site-nav *::after { box-sizing: border-box; }',
    'nav.site-nav {',
    '  --sfn-ease: cubic-bezier(.16, 1, .3, 1);',
    '  position: fixed; z-index: 100; left: 0; right: 0; top: calc(.6rem + env(safe-area-inset-top, 0px));',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  margin: 0; padding: 0 max(16px, 2rem); min-height: 0; border: 0; box-shadow: none; background: none;',
    '  pointer-events: none;',
    "  font: 400 16px/1.6 'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;",
    '  letter-spacing: normal; text-transform: none; text-align: left;',
    '  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;',
    '}',
    /* The frosted bar behind everything: the light state of index.html's nav. */
    'nav.site-nav::before {',
    '  content: ""; position: absolute; z-index: -1; left: 0; right: 0; pointer-events: none;',
    '  top: calc(-.6rem - env(safe-area-inset-top, 0px)); bottom: -.6rem;',
    '  background: rgba(245, 247, 252, .93);',
    '  -webkit-backdrop-filter: blur(16px) saturate(160%); backdrop-filter: blur(16px) saturate(160%);',
    '  border-bottom: 1px solid rgba(26, 40, 90, .07); box-shadow: 0 1px 0 rgba(255, 255, 255, .7);',
    '}',
    'nav.site-nav .nav-logo { pointer-events: auto; display: inline-flex; text-decoration: none; }',
    'nav.site-nav .nav-logo svg { width: 150px; height: 38px; }',
    'nav.site-nav .logo-study { fill: #1a1d2e; }',
    'nav.site-nav .nav-pill {',
    '  position: absolute; left: 50%; transform: translateX(-50%);',
    '  display: flex; align-items: center; gap: .15rem; padding: .38rem .45rem;',
    '  background: rgba(253, 253, 255, .8); border: 1px solid rgba(26, 29, 46, .08); border-radius: 999px;',
    '  -webkit-backdrop-filter: blur(22px) saturate(170%); backdrop-filter: blur(22px) saturate(170%);',
    '  box-shadow: 0 2px 20px rgba(26, 40, 90, .10), inset 0 1.5px 0 rgba(255, 255, 255, .95), inset 0 -1px 0 rgba(26, 40, 90, .05);',
    '  pointer-events: auto;',
    '}',
    'nav.site-nav .nav-pill a {',
    '  position: relative; z-index: 1; font-size: .84rem; font-weight: 500; line-height: 1.6; color: #5b6378; text-decoration: none;',
    '  padding: .42rem .85rem; border-radius: 999px; white-space: nowrap; transition: background-color .2s, color .2s;',
    '}',
    'nav.site-nav .nav-pill a:hover { background: #eef3ff; color: #1a1d2e; }',
    'nav.site-nav .nav-pill a[aria-current] { color: #2851c8; }',
    /* The lens that rests under the page you are on (iOS 26 tab bars do the same). */
    'nav.site-nav .nav-lens {',
    '  position: absolute; left: 0; top: .38rem; bottom: .38rem; width: var(--lw, 0px); border-radius: 999px; pointer-events: none;',
    '  transform: translateX(var(--lx, 0px)); opacity: var(--lo, 0);',
    '  background: #e3ecff; box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .9), 0 1px 3px rgba(26, 40, 90, .1);',
    '}',
    'nav.site-nav .nav-pill.ready .nav-lens { transition: transform .6s var(--sfn-ease), width .6s var(--sfn-ease), opacity .3s ease; }',
    'nav.site-nav .nav-right { display: flex; align-items: center; gap: .6rem; pointer-events: auto; }',
    'nav.site-nav .nav-dashboard {',
    '  display: inline-flex; align-items: center; font-size: .84rem; font-weight: 600; line-height: 1.6; white-space: nowrap;',
    '  color: #2851c8; text-decoration: none; padding: .5rem 1.05rem; border-radius: 999px;',
    '  background: rgba(74, 124, 246, .08); border: 1px solid rgba(74, 124, 246, .24);',
    '  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);',
    '  transition: background-color .2s, border-color .2s, color .2s;',
    '}',
    'nav.site-nav .nav-dashboard:hover { background: rgba(74, 124, 246, .14); border-color: rgba(74, 124, 246, .4); }',
    'nav.site-nav .nav-cta {',
    '  display: inline-flex; align-items: center; font-size: .84rem; font-weight: 700; line-height: 1.6; white-space: nowrap;',
    '  color: #fff; background: #3567e0; text-decoration: none; padding: .52rem 1.15rem; border-radius: 999px;',
    '  box-shadow: 0 4px 16px -4px rgba(53, 103, 224, .55);',
    '  transition: background-color .2s, color .2s, box-shadow .2s;',
    '}',
    'nav.site-nav .nav-cta:hover { background: #2851c8; }',
    'nav.site-nav a:focus-visible { outline: 2.5px solid #4a7cf6; outline-offset: 3px; }',
    '@media (pointer: coarse) { nav.site-nav .nav-cta, nav.site-nav .nav-dashboard { min-height: 44px; } }',
    '@media (max-width: 1080px) { nav.site-nav .nav-pill { display: none; } }',
    '@media (max-width: 640px) {',
    '  nav.site-nav .nav-dashboard { display: none; }',
    '  nav.site-nav .nav-logo svg { width: 132px; height: 34px; }',
    '}',
    /* ── App mode: the same bar, holding the page's own controls ── */
    'nav.site-nav.is-app { position: sticky; top: 0; padding-top: calc(.6rem + env(safe-area-inset-top, 0px)); padding-bottom: .6rem; gap: .75rem; }',
    'nav.site-nav.is-app::before { top: 0; bottom: 0; }',
    'nav.site-nav.is-app .nav-logo { flex-shrink: 0; }',
    'nav.site-nav .nav-mid { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; pointer-events: auto; }',
    'nav.site-nav.is-app .nav-right { flex-shrink: 0; gap: .5rem; }',
    'nav.site-nav button { font: inherit; }',
    'nav.site-nav [hidden] { display: none !important; }',
    'nav.site-nav .nav-icon {',
    '  width: 38px; height: 38px; padding: 0; border: 0; border-radius: 999px; flex-shrink: 0;',
    '  display: inline-grid; place-items: center; background: transparent; color: #1a1d2e; cursor: pointer;',
    '  transition: background-color .2s, transform .18s var(--sfn-ease);',
    '}',
    'nav.site-nav .nav-icon:hover { background: #eef3ff; }',
    'nav.site-nav .nav-icon:active, nav.site-nav .nav-dashboard:active, nav.site-nav .nav-cta:active { transform: scale(.94); transition-duration: 80ms; }',
    'nav.site-nav .nav-dashboard, nav.site-nav .nav-cta { gap: .35rem; cursor: pointer; font-family: inherit; }',
    'nav.site-nav button.nav-dashboard, nav.site-nav button.nav-cta { border-style: solid; }',
    'nav.site-nav button.nav-cta { border: 0; }',
    'nav.site-nav .nav-chip {',
    '  display: inline-flex; align-items: center; height: 28px; padding: 0 .75rem; border-radius: 999px;',
    '  font-size: .74rem; font-weight: 600; line-height: 1; color: #2851c8; background: rgba(74, 124, 246, .08);',
    '}',
    'nav.site-nav button:focus-visible { outline: 2.5px solid #4a7cf6; outline-offset: 3px; }',
    '@media (max-width: 640px) {',
    '  nav.site-nav.is-app .nav-dashboard { display: inline-flex; }',
    '  nav.site-nav.is-app { gap: .5rem; }',
    '  nav.site-nav.has-mid .nav-logo { width: 34px; overflow: hidden; }',
    '  nav.site-nav.has-mid .nav-logo svg { width: 132px; height: 34px; flex-shrink: 0; }',
    '  nav.site-nav .nav-wide { display: none !important; }',
    '}',
    '@media (max-width: 360px) {',
    '  nav.site-nav.is-app .nav-logo { width: 34px; overflow: hidden; }',
    '  nav.site-nav.is-app .nav-logo svg { width: 132px; height: 34px; flex-shrink: 0; }',
    '}',
    /* Dark: the same bar, night-coloured. Pages say dark on body or on html. */
    'body.dark nav.site-nav::before, html.dark nav.site-nav::before { background: rgba(17, 20, 32, .9); border-bottom-color: rgba(255, 255, 255, .08); box-shadow: none; }',
    'body.dark nav.site-nav .logo-study, html.dark nav.site-nav .logo-study { fill: #e9eeff; }',
    'body.dark nav.site-nav .nav-icon, html.dark nav.site-nav .nav-icon { color: #e9eeff; }',
    'body.dark nav.site-nav .nav-icon:hover, html.dark nav.site-nav .nav-icon:hover { background: rgba(255, 255, 255, .08); }',
    'body.dark nav.site-nav .nav-dashboard, html.dark nav.site-nav .nav-dashboard { color: #a9c1ff; background: rgba(74, 124, 246, .14); border-color: rgba(122, 160, 255, .3); }',
    'body.dark nav.site-nav .nav-chip, html.dark nav.site-nav .nav-chip { color: #a9c1ff; background: rgba(74, 124, 246, .16); }',
    'body.dark nav.site-nav .nav-pill, html.dark nav.site-nav .nav-pill { background: rgba(30, 34, 52, .85); border-color: rgba(255, 255, 255, .08); }',
    'body.dark nav.site-nav .nav-pill a, html.dark nav.site-nav .nav-pill a { color: #b7bfd6; }',
    '@media (prefers-reduced-motion: reduce) { nav.site-nav, nav.site-nav * { transition: none !important; } }',
    /* Translucency off, and more contrast: the same nav, solid. */
    '@media (prefers-reduced-transparency: reduce) {',
    '  nav.site-nav .nav-pill, nav.site-nav .nav-dashboard, nav.site-nav::before { -webkit-backdrop-filter: none; backdrop-filter: none; }',
    '  nav.site-nav .nav-pill { background: #fdfdff; }',
    '  nav.site-nav::before { background: #f5f7fc; }',
    '}',
    '@media (prefers-contrast: more) {',
    '  nav.site-nav .nav-pill, nav.site-nav .nav-dashboard { -webkit-backdrop-filter: none; backdrop-filter: none; background: #fdfdff; border-color: #3b4363; }',
    '  nav.site-nav::before { -webkit-backdrop-filter: none; backdrop-filter: none; background: #f5f7fc; border-bottom-color: #3b4363; }',
    '  nav.site-nav .nav-pill a { color: #1a1d2e; }',
    '}'
  ].join('\n');

  /* The logo is index.html's, with its own gradient id so it cannot collide
     with one on the page. */
  var HTML = [
    '<nav class="site-nav" aria-label="Main">',
    '  <a href="index.html" class="nav-logo" aria-label="StudyFlow home">',
    '    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 44" aria-hidden="true">',
    '      <defs><linearGradient id="sfnGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#5b8df8"/><stop offset="100%" style="stop-color:#2851c8"/></linearGradient></defs>',
    '      <rect x="0" y="2" width="40" height="40" rx="10" fill="url(#sfnGrad)"/>',
    '      <rect x="8" y="10" width="17" height="22" rx="3" fill="white" opacity="0.25"/>',
    '      <rect x="11" y="10" width="17" height="22" rx="3" fill="white" opacity="0.35"/>',
    '      <rect x="14" y="10" width="17" height="22" rx="3" fill="white"/>',
    '      <rect x="17" y="16" width="11" height="2" rx="1" fill="#4a7cf6"/>',
    '      <rect x="17" y="21" width="8" height="2" rx="1" fill="#4a7cf6" opacity="0.6"/>',
    '      <rect x="17" y="26" width="10" height="2" rx="1" fill="#4a7cf6" opacity="0.4"/>',
    '      <path d="M33 8 L34 11.5 L37.5 12.5 L34 13.5 L33 17 L32 13.5 L28.5 12.5 L32 11.5 Z" fill="white"/>',
    '      <text x="48" y="28" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="-0.3">',
    '        <tspan class="logo-study">Study</tspan><tspan fill="#4a7cf6">Flow</tspan>',
    '      </text>',
    '    </svg>',
    '  </a>',
    '  <div class="nav-pill" id="nav-pill">',
    '    <span class="nav-lens" aria-hidden="true"></span>',
    '    <a href="index.html#how">How it works</a>',
    '    <a href="index.html#features">Features</a>',
    '    <a href="pricing.html">Plans</a>',
    '    <a href="about.html">Our story</a>',
    '    <a href="contact.html">Help</a>',
    '  </div>',
    '  <div class="nav-right">',
    '    <span id="teacher-nav-link"></span>',
    '    <a href="login.html?mode=signup" class="nav-cta">Build my plan →</a>',
    '  </div>',
    '</nav>'
  ].join('\n');

  /* Fonts: DM Sans 500-700 for the links and button, Inter 700 for the logo. */
  var fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Inter:wght@700&display=swap';
  document.head.appendChild(fonts);

  var style = document.createElement('style');
  style.id = 'sf-nav-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  var mode = self && self.getAttribute('data-mode') === 'app' ? 'app' : 'site';
  var html = HTML;
  if (mode === 'app') {
    /* Same bar and logo; the page's controls take the place of the links. */
    html = HTML.slice(0, HTML.indexOf('  <div class="nav-pill"')) +
      '  <div class="nav-mid" id="sfn-mid"></div>\n  <div class="nav-right" id="sfn-right"></div>\n</nav>';
    html = html.replace('<nav class="site-nav"', '<nav class="site-nav is-app"');
    var home = self.getAttribute('data-home');
    if (home && /^[a-z-]+\.html(#[a-z-]*)?$/.test(home)) html = html.replace('href="index.html" class="nav-logo"', 'href="' + home + '" class="nav-logo"');
  }

  /* Where the tag is. Without a current script (it cannot happen for a plain
     <script src>, but a loader might) the top of the body is the fallback. */
  if (self && self.parentNode) self.insertAdjacentHTML('beforebegin', html);
  else document.body.insertAdjacentHTML('afterbegin', html);

  var navId = self && self.getAttribute('data-id');
  if (navId && /^[a-z-]+$/.test(navId)) {
    var navs = document.querySelectorAll('nav.site-nav');
    navs[navs.length - 1].id = navId;
  }

  if (mode === 'app') {
    var tpl = document.getElementById('sf-nav-controls');
    var mid = document.getElementById('sfn-mid'), right = document.getElementById('sfn-right');
    if (tpl && tpl.content) {
      var frag = document.importNode(tpl.content, true), kids = [];
      for (var k = frag.firstChild; k; k = k.nextSibling) if (k.nodeType === 1) kids.push(k);
      for (var j = 0; j < kids.length; j++) (kids[j].getAttribute('data-sf-slot') === 'mid' ? mid : right).appendChild(kids[j]);
      tpl.parentNode.removeChild(tpl);
    }
    if (!mid.firstChild) mid.parentNode.removeChild(mid);
    else mid.parentNode.classList.add('has-mid');
    return;
  }

  /* The right dashboard for whoever is signed in (index.html's rule). Storage
     can throw in a private window, so it is read defensively. */
  var teacher = null, student = null;
  try { teacher = localStorage.getItem('studyflow_teacher'); student = localStorage.getItem('studyflow_user'); } catch (e) {}
  var slot = document.getElementById('teacher-nav-link');
  var href = teacher ? 'teacher.html' : (student ? 'dashboard.html' : 'login.html');
  if (slot) slot.innerHTML = '<a href="' + href + '" class="nav-dashboard">My Dashboard</a>';

  function retarget() {
    var ctas = document.querySelectorAll('a[href="login.html?mode=signup"]');
    for (var i = 0; i < ctas.length; i++) ctas[i].setAttribute('href', 'app.html');
  }
  if (student && !teacher) {
    retarget();                                  /* the nav's own button, now */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retarget);   /* the page's, once they exist */
  }

  /* Which page this is. A page can say so with data-current="pricing" on the
     script tag; otherwise the address decides. Terms, Privacy and the rest
     are in the footer, not the pill, and get no lens. */
  var pill = document.getElementById('nav-pill');
  var page = (self && self.getAttribute('data-current')) ||
    (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  var current = pill.querySelector('a[href="' + page + '.html"]');
  if (current) current.setAttribute('aria-current', 'page');

  function place() {
    if (!current) { pill.style.setProperty('--lo', '0'); return; }
    pill.style.setProperty('--lx', current.offsetLeft + 'px');
    pill.style.setProperty('--lw', current.offsetWidth + 'px');
    pill.style.setProperty('--lo', '1');
  }
  place();
  /* The pill is measured in the fallback font until the web fonts land. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  window.addEventListener('resize', place);
  requestAnimationFrame(function () { requestAnimationFrame(function () { pill.classList.add('ready'); }); });
})();

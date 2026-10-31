/* sf-nav.js — the site's top navigation, ONE copy for every page that has it.

   Every page used to carry its own nav, and they drifted: a white bar on
   Terms, another on Help, a third on the Parent view, a capsule variant on
   Our story and Plans. This file is the fix by construction. A page loads it
   as the first thing in <body> and the nav appears where the tag is:

       <script src="sf-nav.js"></script>

   THE LOOK (Oct 2026, the owner: "blocky, like Wispr Flow's and Wix's;
   liquid glass with another thing around it makes it look bad"): ONE solid
   block. No blur, no glass, no pill around the links, no sliding lens. The
   links sit straight on the bar, the page you are on is a filled square-ish
   block, the buttons have 10px corners, and the bar is the same on a navy
   hero and on paper. Do not put a container around the links again.

   It is index.html's nav, same sizes, same colours, same breakpoints (the
   links go below 1080px, My Dashboard below 640px).

   index.html keeps its own copy (its script drives the hero around it). If
   you change the nav, change this file AND the nav block in index.html.

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

   A signed-in student's "Build my plan" goes straight to app.html instead of
   through sign-up, as on index.html. That is done for every such link on the
   page, once the page has loaded, because this script runs before the page's
   own buttons exist.

   ONE BAR ON EVERY PAGE. The screens inside the app use it too, in "app"
   mode, because their bars had drifted the same way (four logos at three
   sizes, three bar colours, a different button on each):

       <template id="sf-nav-controls"> ...the page's own buttons... </template>
       <script src="sf-nav.js" data-mode="app" data-home="dashboard.html" data-id="topbar"></script>

   App mode is the same solid bar, the same logo at the same size and the
   same padding, but it takes room in the page (sticky, not fixed) and swaps
   the site links for the page's controls: the template's children go on the
   right, and one marked data-sf-slot="mid" goes between the logo and them
   (the session's time bar). They are moved, not copied, before the page's
   own script runs, so ids and inline handlers work as they did. The nav
   offers the button styles the controls use - .nav-dashboard (outlined
   block), .nav-cta (solid block), .nav-icon (square icon button), .nav-chip -
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
    '  position: fixed; z-index: 100; top: calc(10px + env(safe-area-inset-top, 0px));',
    '  left: max(12px, calc((100vw - 1240px) / 2)); right: max(12px, calc((100vw - 1240px) / 2));',
    '  height: 56px; display: flex; align-items: center; gap: 1rem; margin: 0; padding: 0 8px 0 14px;',
    '  background: #fdfdff; border: 1px solid #dde4f2; border-radius: 14px; box-shadow: 0 2px 10px rgba(14, 20, 42, .08);',
    "  font: 400 16px/1.6 'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;",
    '  letter-spacing: normal; text-transform: none; text-align: left;',
    '  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;',
    '}',
    'nav.site-nav .nav-logo { display: inline-flex; flex-shrink: 0; text-decoration: none; }',
    'nav.site-nav .nav-logo svg { width: 150px; height: 38px; }',
    'nav.site-nav .logo-study { fill: #1a1d2e; }',
    /* The links sit straight on the bar. No container, no pill. */
    'nav.site-nav .nav-links { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 2px; }',
    'nav.site-nav .nav-links a {',
    '  font-size: .88rem; font-weight: 500; line-height: 1.6; color: #4a5168; text-decoration: none; white-space: nowrap;',
    '  padding: .45rem .8rem; border-radius: 8px; transition: background-color .15s, color .15s;',
    '}',
    'nav.site-nav .nav-links a:hover { background: #eef3ff; color: #1a1d2e; }',
    'nav.site-nav .nav-links a[aria-current] { background: #e3ecff; color: #2851c8; }',
    'nav.site-nav .nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; }',
    'nav.site-nav .nav-dashboard {',
    '  display: inline-flex; align-items: center; height: 40px; font-size: .86rem; font-weight: 600; line-height: 1; white-space: nowrap;',
    '  color: #1a1d2e; text-decoration: none; padding: 0 1rem; border-radius: 10px;',
    '  background: #fff; border: 1px solid #d3dbee;',
    '  transition: background-color .15s, border-color .15s, color .15s;',
    '}',
    'nav.site-nav .nav-dashboard:hover { background: #eef3ff; border-color: #4a7cf6; }',
    'nav.site-nav .nav-cta {',
    '  display: inline-flex; align-items: center; height: 40px; font-size: .86rem; font-weight: 700; line-height: 1; white-space: nowrap;',
    '  color: #fff; background: #3567e0; text-decoration: none; padding: 0 1.1rem; border-radius: 10px;',
    '  transition: background-color .15s;',
    '}',
    'nav.site-nav .nav-cta:hover { background: #2851c8; }',
    'nav.site-nav a:focus-visible { outline: 2.5px solid #4a7cf6; outline-offset: 2px; }',
    '@media (pointer: coarse) { nav.site-nav .nav-cta, nav.site-nav .nav-dashboard { min-height: 44px; } }',
    '@media (max-width: 1080px) { nav.site-nav .nav-links { display: none; } }',
    '@media (max-width: 640px) {',
    '  nav.site-nav { top: calc(8px + env(safe-area-inset-top, 0px)); left: 8px; right: 8px; height: 52px; }',
    '  nav.site-nav .nav-dashboard { display: none; }',
    '  nav.site-nav .nav-logo svg { width: 132px; height: 34px; }',
    '}',
    /* ── App mode: the same solid block, edge to edge at the top of the page, holding the page's own controls ── */
    'nav.site-nav.is-app {',
    '  position: sticky; top: 0; left: auto; right: auto; width: 100%; height: auto; min-height: 56px; gap: .75rem; border-radius: 0; border-width: 0 0 1px; box-shadow: none;',
    '  padding: calc(.5rem + env(safe-area-inset-top, 0px)) max(16px, 2rem) .5rem;',
    '}',
    'nav.site-nav.is-app .nav-logo { flex-shrink: 0; }',
    'nav.site-nav .nav-mid { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; }',
    'nav.site-nav.is-app .nav-right { flex-shrink: 0; gap: .5rem; }',
    'nav.site-nav button { font: inherit; }',
    'nav.site-nav [hidden] { display: none !important; }',
    'nav.site-nav .nav-icon {',
    '  width: 40px; height: 40px; padding: 0; border: 0; border-radius: 10px; flex-shrink: 0;',
    '  display: inline-grid; place-items: center; background: transparent; color: #1a1d2e; cursor: pointer;',
    '  transition: background-color .15s, transform .18s var(--sfn-ease);',
    '}',
    'nav.site-nav .nav-icon:hover { background: #eef3ff; }',
    'nav.site-nav .nav-icon:active, nav.site-nav .nav-dashboard:active, nav.site-nav .nav-cta:active { transform: scale(.96); transition-duration: 80ms; }',
    'nav.site-nav .nav-dashboard, nav.site-nav .nav-cta { gap: .35rem; cursor: pointer; font-family: inherit; }',
    'nav.site-nav button.nav-dashboard, nav.site-nav button.nav-cta { border-style: solid; }',
    'nav.site-nav button.nav-cta { border: 0; }',
    'nav.site-nav .nav-chip {',
    '  display: inline-flex; align-items: center; height: 28px; padding: 0 .7rem; border-radius: 8px;',
    '  font-size: .74rem; font-weight: 600; line-height: 1; color: #2851c8; background: #e3ecff;',
    '}',
    'nav.site-nav button:focus-visible { outline: 2.5px solid #4a7cf6; outline-offset: 2px; }',
    '@media (max-width: 640px) {',
    '  nav.site-nav.is-app { top: 0; left: auto; right: auto; height: auto; }',
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
    /* Dark: the same block, night-coloured. Pages say dark on body or on html. */
    'body.dark nav.site-nav, html.dark nav.site-nav { background: #151927; border-color: rgba(255, 255, 255, .1); box-shadow: none; }',
    'body.dark nav.site-nav .logo-study, html.dark nav.site-nav .logo-study { fill: #e9eeff; }',
    'body.dark nav.site-nav .nav-icon, html.dark nav.site-nav .nav-icon { color: #e9eeff; }',
    'body.dark nav.site-nav .nav-icon:hover, html.dark nav.site-nav .nav-icon:hover { background: rgba(255, 255, 255, .08); }',
    'body.dark nav.site-nav .nav-dashboard, html.dark nav.site-nav .nav-dashboard { color: #e9eeff; background: rgba(255, 255, 255, .05); border-color: rgba(255, 255, 255, .16); }',
    'body.dark nav.site-nav .nav-dashboard:hover, html.dark nav.site-nav .nav-dashboard:hover { background: rgba(74, 124, 246, .16); border-color: #7aa0ff; }',
    'body.dark nav.site-nav .nav-chip, html.dark nav.site-nav .nav-chip { color: #a9c1ff; background: rgba(74, 124, 246, .18); }',
    'body.dark nav.site-nav .nav-links a, html.dark nav.site-nav .nav-links a { color: #b7bfd6; }',
    '@media (prefers-reduced-motion: reduce) { nav.site-nav, nav.site-nav * { transition: none !important; } }',
    '@media (prefers-contrast: more) {',
    '  nav.site-nav { border-color: #3b4363; }',
    '  nav.site-nav .nav-dashboard { border-color: #3b4363; }',
    '  nav.site-nav .nav-links a { color: #1a1d2e; }',
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
    '  <div class="nav-links" id="nav-links">',
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
    html = HTML.slice(0, HTML.indexOf('  <div class="nav-links"')) +
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
     are in the footer, not the bar, and mark nothing. */
  var links = document.getElementById('nav-links');
  var page = (self && self.getAttribute('data-current')) ||
    (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  var current = links && links.querySelector('a[href="' + page + '.html"]');
  if (current) current.setAttribute('aria-current', 'page');
})();

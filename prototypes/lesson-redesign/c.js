/* c.js - Direction C, "Desk". The structured one.
   A study workspace: the solid block nav every other StudyFlow page uses,
   with a breadcrumb, and a map of the whole session always in view - the
   four phases and every practice question as a numbered square, coloured
   right or wrong as you go. The card is a tool: a header strip that names
   the type once, answers as form rows with radios and number-key hints,
   feedback as a band across the card, and one primary at the bottom right.
   On a phone the map folds into a sheet behind "Practice · 3 of 10". */
(function () {
  var P = window.SFP, esc = P.esc, icon = P.icon;
  var PH_ICON = { Lesson: 'book', Words: 'cards', Practice: 'list', 'Teach back': 'pen' };
  var sheetFrom = null, sheetTimer = null, keyHandler = null;

  function ring() {
    return '<svg class="c-ring" viewBox="0 0 22 22" aria-hidden="true"><circle class="c-ring-t" cx="11" cy="11" r="9"/>' +
      '<circle class="c-ring-f" cx="11" cy="11" r="9"/></svg>';
  }
  function timeLeft() {
    return '<div class="c-left"><div class="c-left-row"><span class="c-left-l">Time left</span><span class="c-left-v"><span data-bind="mins"></span> left</span></div>' +
      '<span class="c-left-bar" aria-hidden="true"><span></span></span>' +
      '<button type="button" class="c-end" data-act="end">' + icon('door') + 'End session</button></div>';
  }

  function frame(ctx) {
    var m = P.meta;
    return '' +
      '<header class="c-nav">' +
        '<div class="c-nav-in">' +
          '<button type="button" class="c-brand" data-act="exit" aria-label="StudyFlow, back to your dashboard">' + P.logo(30) + '<span class="c-word">StudyFlow</span></button>' +
          '<span class="c-div" aria-hidden="true"></span>' +
          '<nav class="c-crumbs" aria-label="You are here"><span class="c-crumb-sub">' + esc(m.subject) + '</span>' +
            '<span class="c-crumb-chev" aria-hidden="true">' + icon('chevR') + '</span>' +
            '<span class="c-crumb-now"><span class="c-crumb-day">Day ' + m.day + ' · </span>' + esc(m.title) + '</span></nav>' +
          '<div class="c-right">' +
            '<span class="c-time" title="Time left">' + ring() + '<span data-bind="time"></span></span>' +
            '<span class="c-score" title="Right so far"><b data-bind="score"></b> right</span>' +
            '<span class="c-streak" title="Answers right in a row">' + icon('flame') + '<span data-bind="streak"></span></span>' +
            '<button type="button" class="c-icon" data-act="theme" aria-pressed="false" aria-label="Dark mode">' + icon('moon', 'ico-moon') + icon('sun', 'ico-sun') + '</button>' +
            '<button type="button" class="c-dash" data-act="exit" aria-label="Back to dashboard">' + icon('chevL') + '<span>Dashboard</span></button>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="c-subbar">' +
        '<button type="button" class="c-sub-btn" data-act="outline" aria-haspopup="dialog" aria-expanded="false"><span class="c-sub-t"></span>' + icon('chevD') + '</button>' +
        '<span class="c-sub-bar" aria-hidden="true"><span></span></span>' +
      '</div>' +
      '<div class="c-layout">' +
        '<aside class="c-rail" aria-label="Today’s session">' +
          '<p class="c-ol-h">Today’s session</p><div class="c-outline" data-outline></div>' + timeLeft() +
        '</aside>' +
        '<main class="c-main"><div class="c-stage" data-slot="card"></div></main>' +
      '</div>' +
      '<div class="c-sheet-wrap" hidden>' +
        '<div class="c-scrim" data-act="outline-close"></div>' +
        '<div class="c-sheet" role="dialog" aria-modal="true" aria-labelledby="c-sheet-h">' +
          '<div class="c-sheet-grab" aria-hidden="true"></div>' +
          '<div class="c-sheet-head"><h2 id="c-sheet-h">Today’s session</h2>' +
            '<button type="button" class="c-icon" data-act="outline-close" aria-label="Close">' + icon('x') + '</button></div>' +
          '<div class="c-outline" data-outline></div>' + timeLeft() +
        '</div>' +
      '</div>';
  }

  function head(c, p) {
    var h = '<div class="c-head"><span class="c-head-ico">' + icon(p.icon) + '</span>';
    h += '<span class="c-head-type">' + esc(p.type) + '</span>';
    if (c.kind === 'q') {
      h += P.levelHtml(p.level);
      if (p.tag) h += '<span class="c-tag">' + esc(p.tag) + '</span>';
      if (!p.scored) h += '<span class="c-tag">Not scored</span>';
      h += '<span class="c-head-r">';
      if (c.phase === 'Practice') h += '<span class="c-qn">Q' + p.num.n + '</span>';
      h += '<button type="button" class="c-flag" data-act="flag" aria-pressed="false" aria-label="Flag this question" title="Flag this question">' + icon('flag') + '</button></span>';
    } else {
      h += '<span class="c-head-r"><span class="c-qn">Day ' + P.meta.day + ' of ' + P.meta.days + '</span></span>';
    }
    return h + '</div>';
  }

  function card(c, p, ctx) {
    var hasStim = !!p.stim;
    var h = '<article class="c-card' + (hasStim ? ' has-stim' : '') + '" aria-labelledby="c-stem">' + head(c, p);
    h += '<div class="c-body">';
    if (c.kind === 'q') {
      h += '<h1 class="c-stem' + (p.longStem ? ' is-long' : '') + '" id="c-stem">' + p.stem + '</h1>';
      if (p.sub) h += '<p class="c-sub">' + esc(p.sub) + '</p>';
    } else {
      /* No digits in a serif title: Instrument Serif's "1" reads as an "l". */
      h += '<h1 class="c-title" id="c-stem">' + (c.kind === 'results' ? 'Nice work today.' : p.stem) + '</h1>';
    }
    h += '<div class="c-stim" data-slot="stim">' + p.stim + '</div>';
    h += '<div class="c-work" data-slot="work">' + p.work + '</div>';
    if (c.kind === 'q') h += '<div class="c-hint" data-slot="hint" hidden></div>';
    h += '</div>';
    if (c.kind === 'q') h += '<div class="c-fb" data-slot="feedback" hidden></div>';
    h += '<footer class="c-foot"><div class="c-foot-l">';
    if (c.kind === 'q') {
      if (p.hint) h += '<button type="button" class="c-tool" data-act="hint" aria-expanded="false">' + icon('bulb') + 'Hint</button>';
      h += '<div class="c-conf" data-slot="conf" hidden></div>';
    } else if (c.kind === 'lesson') {
      h += '<span class="c-keys">← → to move between parts</span>';
    } else if (c.kind === 'deck') {
      h += '<span class="c-keys">Space to turn · arrows to move</span>';
    } else if (c.kind === 'results') {
      h += '<button type="button" class="c-tool" data-act="jump" data-v="2">' + icon('redo') + 'Try the misses again</button>';
    }
    h += '</div>' + P.primaryHtml(p.primary) + '</footer></article>';
    return h;
  }

  function outlineHtml(ctx) {
    var S = ctx.S, cs = S.cs, last = P.deck.length - 1;
    var qn = P.questionNumber(S.i);
    var rows = P.progress().map(function (ph) {
      var st = ph.state, n = ph.items.length, first = ph.items.length ? ph.items[0].i : 0;
      var right = '';
      if (st === 'done') right = icon('check');
      else if (st === 'now') right = ph.phase === 'Practice' ? '<span class="c-ph-n">' + qn.n + '/' + n + '</span>' : '<span class="c-ph-now">Now</span>';
      var inner = '<span class="c-ph-ico">' + icon(PH_ICON[ph.phase]) + '</span><span class="c-ph-name">' + esc(ph.phase) + '</span><span class="c-ph-st">' + right + '</span>';
      var row = st === 'now'
        ? '<div class="c-ph-row" aria-current="step">' + inner + '</div>'
        : '<button type="button" class="c-ph-row" data-act="jump" data-v="' + first + '">' + inner + '</button>';
      var grid = '';
      if (ph.phase === 'Practice') {
        grid = '<div class="c-qgrid" role="list">' + ph.items.map(function (it, k) {
          var status = S.status[it.i] || (it.status === 'now' ? 'todo' : it.status);
          if (it.status === 'now' && cs && cs.done) status = S.status[it.i] || 'done';
          var now = it.i === S.i;
          var word = status === 'right' ? 'right' : status === 'wrong' ? 'missed' : status === 'done' ? 'done' : now ? 'now' : 'not started';
          return '<button type="button" role="listitem" class="c-q is-' + status + (now ? ' is-now' : '') + '" data-act="jump" data-v="' + it.i + '"' +
            (now ? ' aria-current="step"' : '') + ' aria-label="Question ' + (k + 1) + ', ' + word + '">' + (k + 1) + '</button>';
        }).join('') + '</div>';
      }
      return '<li class="c-ph is-' + st + '">' + row + grid + '</li>';
    });
    var onRes = S.i === last;
    rows.push('<li class="c-ph is-' + (onRes ? 'now' : 'todo') + '">' + (onRes
      ? '<div class="c-ph-row" aria-current="step"><span class="c-ph-ico">' + icon('trophy') + '</span><span class="c-ph-name">Results</span><span class="c-ph-st"><span class="c-ph-now">Now</span></span></div>'
      : '<button type="button" class="c-ph-row" data-act="jump" data-v="' + last + '"><span class="c-ph-ico">' + icon('trophy') + '</span><span class="c-ph-name">Results</span><span class="c-ph-st"></span></button>') + '</li>');
    return '<ol class="c-phases">' + rows.join('') + '</ol>';
  }

  function update(ctx) {
    var root = ctx.root, S = ctx.S, c = P.card();
    var html = outlineHtml(ctx);
    root.querySelectorAll('[data-outline]').forEach(function (el) { el.innerHTML = html; });
    var qn = P.questionNumber(S.i);
    var t = root.querySelector('.c-sub-t');
    if (t) t.textContent = c.phase === 'Practice' ? 'Practice · ' + qn.n + ' of ' + qn.total : c.phase === 'Results' ? 'Results' : c.phase;
    var dark = document.documentElement.dataset.theme === 'dark';
    var tb = root.querySelector('.c-nav [data-act="theme"]');
    if (tb) tb.setAttribute('aria-label', dark ? 'Light mode' : 'Dark mode');
    /* A jump from inside the sheet (or End session) moved the card: the sheet's job is done. */
    if (sheetFrom !== null && S.i !== sheetFrom) closeSheet(ctx, true);
  }

  function openSheet(ctx) {
    var root = ctx.root, wrap = root.querySelector('.c-sheet-wrap'), btn = root.querySelector('.c-sub-btn');
    if (!wrap || !wrap.hidden) return;
    clearTimeout(sheetTimer);
    sheetFrom = ctx.S.i;
    wrap.hidden = false;
    void wrap.offsetHeight;                 /* commit the closed position so the rise transitions */
    wrap.classList.add('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    var close = wrap.querySelector('.c-sheet-head [data-act="outline-close"]');
    if (close) close.focus({ preventScroll: true });
    keyHandler = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(ctx); return; }
      if (e.key === 'Tab') {                 /* keep focus inside the sheet */
        var f = wrap.querySelectorAll('.c-sheet button:not([disabled])');
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', keyHandler, true);
  }
  function closeSheet(ctx, moved) {
    var root = ctx.root, wrap = root.querySelector('.c-sheet-wrap'), btn = root.querySelector('.c-sub-btn');
    sheetFrom = null;
    if (keyHandler) { document.removeEventListener('keydown', keyHandler, true); keyHandler = null; }
    if (!wrap || wrap.hidden) return;
    wrap.classList.remove('is-open');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); if (!moved) btn.focus({ preventScroll: true }); }
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(function () { if (!wrap.classList.contains('is-open')) wrap.hidden = true; }, 340);   /* a timer, never transitionend */
  }

  function onAct(act, el, ctx) {
    if (act === 'outline') openSheet(ctx);
    else if (act === 'outline-close') closeSheet(ctx);
  }

  P.register('c', { name: 'Desk', frame: frame, card: card, update: update, onAct: onAct });
})();

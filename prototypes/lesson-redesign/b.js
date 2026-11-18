/* b.js - Direction B, "Focus". The immersive one.
   No card box and almost no nav: an exit, one progress track, the time.
   The question sits alone on the page as big tiles with a solid edge you
   press down. The one action lives in a bar fixed to the bottom of the
   screen, and after Check that bar BECOMES the verdict: it turns green or
   red, rises, and says what was right and why, with Continue in the same
   place your thumb already is. */
(function () {
  var P = window.SFP, esc = P.esc, icon = P.icon;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(ctx) {
    return '' +
      '<header class="b-nav">' +
        '<div class="b-nav-in">' +
          '<button type="button" class="b-x" data-act="exit" aria-label="Leave the session">' + icon('x') + '</button>' +
          '<div class="b-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="b-fill"></span></div>' +
          '<span class="b-time" title="Time left">' + icon('clock') + '<span data-bind="time"></span></span>' +
          '<span class="b-streak" title="Answers right in a row">' + icon('flame') + '<span data-bind="streak"></span></span>' +
          '<div class="menu">' +
            '<button type="button" class="b-x b-more" data-act="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More">' + icon('more') + '</button>' +
            '<div class="menu-pop" role="menu">' +
              '<button type="button" role="menuitem" data-act="theme">' + icon('moon') + 'Dark mode</button>' +
              '<button type="button" role="menuitem" data-act="tutor">' + icon('chat') + 'Study tutor</button>' +
              '<button type="button" role="menuitem" data-act="end">' + icon('door') + 'End session</button>' +
            '</div></div>' +
        '</div>' +
      '</header>' +
      '<main class="b-main"><div class="b-col" data-slot="card"></div></main>' +
      '<div class="b-bar" data-verdict="">' +
        '<div class="b-bar-in">' +
          '<div class="b-fb" data-slot="tray" hidden></div>' +
          '<div class="b-actions">' +
            '<button type="button" class="b-ghost b-hint" data-act="hint" aria-expanded="false" aria-label="Hint" hidden>' + icon('bulb') + '<span aria-hidden="true">Hint</span></button>' +
            '<button type="button" class="b-ghost b-again" data-act="jump" data-v="2" aria-label="Try the misses again" hidden>' + icon('redo') + '<span aria-hidden="true">Try the misses again</span></button>' +
            P.primaryHtml({ act: 'check', label: 'Check', disabled: true, arrow: false }) +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function eyebrow(c, p) {
    var h = '<div class="b-eyebrow">';
    if (c.kind === 'q') {
      h += '<span class="b-type">' + esc(p.type) + '</span>' + P.levelHtml(p.level);
      if (p.tag) h += '<span class="b-tag">' + esc(p.tag) + '</span>';
      if (!p.scored) h += '<span class="b-tag">Not scored</span>';
      h += '<span class="b-end">';
      if (c.phase === 'Practice') h += '<span class="b-num">' + p.num.n + ' of ' + p.num.total + '</span>';
      h += '<button type="button" class="b-flag" data-act="flag" aria-pressed="false" aria-label="Flag this question" title="Flag this question">' + icon('flag') + '</button></span>';
    } else {
      h += '<span class="b-type">' + esc(c.kind === 'lesson' ? 'Today’s lesson' : c.kind === 'deck' ? 'Before you practise' : 'Day ' + P.meta.day + ' done') + '</span>';
    }
    return h + '</div>';
  }

  function card(c, p, ctx) {
    var title = c.kind === 'results' ? 'Nice work today.' : p.stem;
    var h = '<section class="b-card" aria-labelledby="b-stem">' + eyebrow(c, p);
    h += '<h1 class="b-stem' + (p.longStem ? ' is-long' : '') + (c.kind !== 'q' ? ' is-title' : '') + '" id="b-stem">' + title + '</h1>';
    if (p.sub) h += '<p class="b-sub">' + esc(p.sub) + '</p>';
    h += '<div class="b-stim" data-slot="stim">' + p.stim + '</div>';
    h += '<div class="b-work" data-slot="work">' + p.work + '</div>';
    if (c.kind === 'q') {
      h += '<div class="b-conf" data-slot="conf" hidden></div>' +
        '<div class="b-hintslot" data-slot="hint" hidden></div>';
    }
    return h + '</section>';
  }

  /* The bar's height decides how much room the page leaves under the
     content, so nothing is ever hidden behind it - including a tall verdict. */
  var watched = false;
  function watchBar(root) {
    if (watched) return; watched = true;
    var bar = root.querySelector('.b-bar');
    var set = function () { root.style.setProperty('--bar-h', bar.offsetHeight + 'px'); };
    set();
    if (window.ResizeObserver) new ResizeObserver(set).observe(bar);
    else window.addEventListener('resize', set);
  }

  function update(ctx) {
    var root = ctx.root, c = P.card(), cs = ctx.S.cs;
    watchBar(root);
    var tr = root.querySelector('.b-track');
    if (tr) tr.setAttribute('aria-valuenow', Math.round(P.fraction() * 100));
    var hint = root.querySelector('.b-hint');
    if (hint) hint.hidden = !(c.kind === 'q' && c.hint && !(cs && cs.done));
    var again = root.querySelector('.b-again');
    if (again) again.hidden = c.kind !== 'results';
  }

  function showFeedback(root, fb, ctx) {
    var bar = root.querySelector('.b-bar'), tray = root.querySelector('[data-slot="tray"]');
    if (!bar || !tray) return;
    var h = '<div class="b-fbp" role="status">' +
      '<div class="b-fb-head"><span class="b-fb-ico" aria-hidden="true">' + icon(fb.verdict === 'wrong' ? 'cross' : 'check') + '</span>' +
      '<p class="b-fb-title">' + esc(fb.title) + '</p></div><div class="b-fb-body">';
    if (fb.verdict === 'saved') {
      h += '<p class="b-fb-why">' + esc(fb.why) + '</p><ul class="b-points">' + fb.points.map(function (pt, k) {
        return '<li class="' + (fb.hits[k] ? 'is-hit' : '') + '">' + icon(fb.hits[k] ? 'check' : 'chevR') + '<span>' + esc(pt) + '</span></li>';
      }).join('') + '</ul>';
    } else {
      if (fb.answer) h += '<p class="b-fb-answer">' + (fb.answerIsNote ? '' : '<span>Answer:</span> ') + esc(fb.answer) + '</p>';
      if (fb.why) h += '<p class="b-fb-why">' + esc(fb.why) + '</p>';
    }
    h += '</div><div class="b-fb-links">' +
      (fb.verdict !== 'saved' ? '<button type="button" class="fb-link" data-act="walk">' + icon('play') + 'Walk me through it</button>' : '') +
      '<button type="button" class="fb-link" data-act="tutor">' + icon('chat') + 'Ask the tutor</button></div></div>';
    tray.innerHTML = h;
    tray.hidden = false;
    bar.dataset.verdict = fb.verdict;
    var hint = root.querySelector('.b-hint'); if (hint) hint.hidden = true;
    /* The bar rises: it grew by the panel's height in one frame, so start it
       that far down and let it come up on the spring. Transform only. */
    var ph = tray.offsetHeight;
    root.style.setProperty('--bar-h', bar.offsetHeight + 'px');   /* now, not when the observer gets round to it */
    if (!reduced && bar.animate) {
      bar.animate([{ transform: 'translateY(' + ph + 'px)' }, { transform: 'none' }],
        { duration: 460, easing: 'cubic-bezier(.22,1,.36,1)' });
      tray.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    } else if (tray.animate) {
      tray.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' });
    }
    /* Keep the marked answers in sight above the verdict. */
    setTimeout(function () {
      var work = root.querySelector('[data-slot="work"]'); if (!work) return;
      var over = work.getBoundingClientRect().bottom - (window.innerHeight - bar.offsetHeight - 16);
      if (over > 0) window.scrollBy({ top: over, behavior: reduced ? 'auto' : 'smooth' });
    }, 80);
  }

  function clearFeedback(root, ctx) {
    var bar = root.querySelector('.b-bar'), tray = root.querySelector('[data-slot="tray"]');
    if (tray) { tray.innerHTML = ''; tray.hidden = true; }
    if (bar) { bar.dataset.verdict = ''; root.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }
    var hint = root.querySelector('.b-hint');
    if (hint) { hint.classList.remove('is-on'); hint.setAttribute('aria-expanded', 'false'); }
  }

  P.register('b', { name: 'Focus', frame: frame, card: card, update: update, showFeedback: showFeedback, clearFeedback: clearFeedback });
})();

/* a.js - Direction A, "Paper". The calm one.
   The lesson card stays a card, but loses its blue slab: the question is
   the biggest thing on it, set in Instrument Serif like a printed page. The
   type is named once, in the eyebrow. The nav is the solid block bar the
   other pages use, and it shows the session's four phases instead of only
   the time. Feedback is a note written under your answer, on the card. */
(function () {
  var P = window.SFP, esc = P.esc, icon = P.icon;
  var WEIGHT = { Lesson: 1, Words: 1, Practice: 2.8, 'Teach back': 1.2 };

  function frame(ctx) {
    var m = P.meta;
    return '' +
      '<header class="a-nav">' +
        '<div class="a-nav-in">' +
          '<button type="button" class="a-icon" data-act="exit" aria-label="Leave the session">' + icon('x') + '</button>' +
          '<div class="a-title"><span class="a-kicker">' + esc(m.subject) + ' · Day ' + m.day + ' of ' + m.days + '</span>' +
            '<span class="a-name">' + esc(m.title) + '</span></div>' +
          '<nav class="a-phases" aria-label="Session progress"></nav>' +
          '<div class="a-right">' +
            '<span class="a-time" title="Time left">' + icon('clock') + '<span data-bind="time"></span></span>' +
            '<span class="a-score" title="Right so far"><span data-bind="score"></span></span>' +
            '<span class="a-streak" title="Answers right in a row">' + icon('flame') + '<span data-bind="streak"></span></span>' +
            '<div class="menu">' +
              '<button type="button" class="a-icon" data-act="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More">' + icon('more') + '</button>' +
              '<div class="menu-pop" role="menu">' +
                '<button type="button" role="menuitem" data-act="theme">' + icon('moon') + 'Dark mode</button>' +
                '<button type="button" role="menuitem" data-act="tutor">' + icon('chat') + 'Study tutor</button>' +
                '<button type="button" role="menuitem" data-act="end">' + icon('door') + 'End session</button>' +
              '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="a-bar" aria-hidden="true"><span></span></div>' +
      '</header>' +
      '<main class="a-main"><div class="a-stage" data-slot="card"></div></main>';
  }

  function eyebrow(c, p) {
    var h = '<div class="a-eyebrow">';
    if (c.kind === 'q') {
      if (c.phase === 'Practice') h += '<span class="a-num">' + esc(p.kicker) + '</span><span class="a-dot" aria-hidden="true"></span>';
      h += '<span class="a-type">' + esc(p.type) + '</span>' + P.levelHtml(p.level);
      if (p.tag) h += '<span class="a-tag">' + esc(p.tag) + '</span>';
      if (!p.scored) h += '<span class="a-tag">Not scored</span>';
      h += '<button type="button" class="a-flag" data-act="flag" aria-pressed="false" aria-label="Flag this question" title="Flag this question">' + icon('flag') + '</button>';
    } else {
      h += '<span class="a-num">' + esc(c.kind === 'lesson' ? 'Today’s lesson' : c.kind === 'deck' ? 'Before you practise' : 'Day ' + P.meta.day + ' done') + '</span>';
    }
    return h + '</div>';
  }

  function card(c, p, ctx) {
    var h = '<article class="a-card" aria-labelledby="a-stem">' + eyebrow(c, p);
    var stemTag = c.kind === 'q' ? 'h1' : 'h1';
    var title = c.kind === 'results' ? 'Nice work today.' : p.stem;
    h += '<' + stemTag + ' class="a-stem' + (p.longStem ? ' is-long' : '') + (c.kind !== 'q' ? ' is-title' : '') + '" id="a-stem">' + title + '</' + stemTag + '>';
    if (p.sub) h += '<p class="a-sub">' + esc(p.sub) + '</p>';
    h += '<div class="a-stim" data-slot="stim">' + p.stim + '</div>';
    h += '<div class="a-work" data-slot="work">' + p.work + '</div>';
    if (c.kind === 'q') {
      h += '<div class="a-conf" data-slot="conf" hidden></div>' +
        '<div class="a-hint" data-slot="hint" hidden></div>' +
        '<div class="a-fb" data-slot="feedback" hidden></div>';
    }
    h += '<footer class="a-foot">';
    if (c.kind === 'q' && p.hint) h += '<button type="button" class="a-tool" data-act="hint" aria-expanded="false">' + icon('bulb') + 'Hint</button>';
    if (c.kind === 'results') h += '<button type="button" class="a-tool" data-act="jump" data-v="2">' + icon('redo') + 'Try the misses again</button>';
    h += P.primaryHtml(p.primary) + '</footer></article>';
    return h;
  }

  function update(ctx) {
    var nav = ctx.root.querySelector('.a-phases'); if (!nav) return;
    var cs = ctx.S.cs, cur = P.card();
    nav.innerHTML = P.progress().map(function (ph) {
      var n = ph.items.length, done = ph.done;
      if (ph.state === 'now' && cs && cs.done) done += 1;
      var frac = n ? Math.min(1, done / n) : 0;
      var label = esc(ph.phase) + (ph.phase === 'Practice' && ph.state === 'now' ? ' <b>' + Math.min(n, ph.done + 1) + '/' + n + '</b>' : '');
      return '<div class="a-ph is-' + ph.state + '" style="flex:' + WEIGHT[ph.phase] + '"' + (ph.state === 'now' ? ' aria-current="step"' : '') + '>' +
        '<span class="a-ph-name">' + (ph.state === 'done' ? icon('check') : '') + label + '</span>' +
        '<span class="a-ph-track"><span style="transform:scaleX(' + frac.toFixed(3) + ')"></span></span></div>';
    }).join('');
    var bar = ctx.root.querySelector('.a-bar span'); if (bar) bar.style.transform = 'scaleX(' + P.fraction().toFixed(3) + ')';
    void cur;
  }

  P.register('a', { name: 'Paper', frame: frame, card: card, update: update });
})();

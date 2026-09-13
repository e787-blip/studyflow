/* ============================================================================
   StudyFlow — WHITEBOARD TEACHING MODE
   ----------------------------------------------------------------------------
   A presentation surface the app draws on, one beat at a time, at the
   student's pace. Not a drawing surface for the student.

   Public API:  window.Whiteboard.render(dayObject, mountElement)

   Why this is separate from window.SFWhiteboard / SFBoard, which already
   exist in lesson.html: that engine renders SVG *scenes* chosen by subject
   (map, timeline, cycle...) and is what the opening `sfwb-brief` card uses.
   This is a different job - a linear, mixed-content explanation that keeps
   earlier beats on the board in a subordinate state. It reuses that file's
   design tokens, its dark-mode pattern and its generateDiagramSVG(), and
   deliberately does not duplicate its scene engine.

   ES5 only, to match lesson.html: var, function(){}, string concatenation.
   No dependencies, no build step.
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;
  var STYLE_ID = 'sfwb-teach-styles';

  /* ── motion budget ──────────────────────────────────────────────────────
     A beat must fully land in under 900ms. Text is the slowest element at
     240ms + 60ms per line of stagger, so four lines is 420ms; an annotation
     waits 150ms after that. Ink draw-on is scaled to path length between
     400 and 700ms and starts immediately, so it finishes inside the same
     budget rather than adding to it. */
  var TEXT_MS = 240, STAGGER_MS = 60, ANNOTATE_GAP_MS = 150;
  var DIM_MS = 300, INK_MIN_MS = 400, INK_MAX_MS = 700;
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

  function reduced() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /* lesson.html already has an esc(); whiteboard.js is loaded as a separate
     file and cannot rely on its scope, so it carries its own. This one escapes
     for HTML text content - angle brackets and ampersands included, which the
     block-1 esc() deliberately does not do. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* ── STYLES ─────────────────────────────────────────────────────────────
     Injected once. Follows lesson.html's body.dark override pattern rather
     than reading a theme flag, so toggling dark mode mid-beat is a pure CSS
     swap and cannot desynchronise from the board's state. */
  function injectStyles() {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    var css = [
      '.sfwbt{display:block;}',
      /* board surface: the only elevated thing on the card */
      /* Sizes to its content. A fixed 16:10 aspect meant a short first beat sat
         in a tall empty rectangle - two lines of text and then several hundred
         pixels of nothing, which is what made the card look broken. A minimum
         keeps it from jumping about between short beats; it grows from there. */
      '.sfwbt-board{position:relative;background:var(--white);border:1.5px solid var(--border);',
        'border-radius:20px;padding:24px;min-height:210px;max-height:min(62vh,560px);',
        'overflow-y:auto;}',
      /* Phase chip: the learner should always know which of the three phases
         they are in - modelled, guided, or on their own. */
      '.sfwbt-phase{display:flex;align-items:center;gap:8px;margin-bottom:14px;}',
      '.sfwbt-chip{font-size:0.64rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;',
        'padding:.28rem .6rem;border-radius:999px;background:var(--blue-light);color:var(--blue);}',
      '.sfwbt-chip.is-practice{background:#d9f6ee;color:#12866c;}',
      '.sfwbt-phase-note{font-size:0.72rem;color:var(--muted);}',
      /* Guided practice */
      '.sfwbt-pq{font-size:1.02rem;font-weight:600;line-height:1.5;margin:0 0 12px;}',
      '.sfwbt-opt{display:block;width:100%;text-align:left;background:var(--white);',
        'border:1.5px solid var(--border);border-radius:12px;padding:.8rem .9rem;margin-bottom:.5rem;',
        'font-family:var(--sans),sans-serif;font-size:0.93rem;line-height:1.45;color:var(--ink);',
        'cursor:pointer;min-height:48px;transition:border-color .18s ' + EASE + ',background .18s ' + EASE + ';}',
      '.sfwbt-opt:hover:not(:disabled){border-color:var(--blue);background:var(--blue-light);}',
      '.sfwbt-opt:disabled{cursor:default;}',
      '.sfwbt-opt.is-right{border-color:#10b981;background:#ecfdf5;}',
      '.sfwbt-opt.is-wrong{border-color:#ef4444;background:#fef2f2;}',
      '.sfwbt-opt.is-dim{opacity:.45;}',
      '.sfwbt-sofar{background:var(--soft);border-radius:12px;padding:12px 14px;margin-bottom:14px;}',
      '.sfwbt-sofar-tag{display:block;font-size:0.64rem;font-weight:800;letter-spacing:.08em;',
        'text-transform:uppercase;color:var(--muted);margin-bottom:.35rem;}',
      '.sfwbt-sofar li{font-size:0.9rem;line-height:1.6;margin-bottom:3px;}',
      '.sfwbt-why{margin-top:10px;font-size:0.88rem;line-height:1.55;color:var(--ink);',
        'background:var(--soft);border-left:3px solid var(--blue);border-radius:0 10px 10px 0;padding:10px 12px;}',
      'body.dark .sfwbt-opt{background:#1e2336;border-color:#222840;color:#e8eeff;}',
      'body.dark .sfwbt-sofar,body.dark .sfwbt-why{background:#1e2336;}',
      '.sfwbt-beat{margin-bottom:16px;}',
      '.sfwbt-beat:last-child{margin-bottom:0;}',
      /* the core mechanic: history stays visible but subordinate */
      /* The dim is an OPACITY transition. Transitioning `color` as well left
         the computed colour stuck at its pre-dark value when the theme was
         toggled mid-beat - the transition kept re-targeting from the old
         value and the element never repainted to the dark token. Opacity
         alone gives the same effect and switches theme cleanly. */
      '.sfwbt-beat.is-prior{opacity:.55;color:var(--muted);transition:opacity ' + DIM_MS + 'ms ' + EASE + ';}',
      '.sfwbt-beat.is-current{opacity:1;color:var(--ink);}',
      '.sfwbt-beat.is-prior .sfwbt-head{color:var(--muted);}',
      /* three type sizes on the board, no more */
      '.sfwbt-head{font-family:var(--serif),Georgia,serif;font-size:1.18rem;letter-spacing:-0.02em;',
        'color:var(--ink);margin:0 0 8px;line-height:1.25;}',
      '.sfwbt-say{font-family:var(--sans),sans-serif;font-size:0.95rem;line-height:1.7;margin:0;}',
      /* Annotations share the body size - the board caps at three sizes:
         display (the taught thing), headline, body. */
      '.sfwbt-small{font-family:var(--sans),sans-serif;font-size:0.95rem;line-height:1.6;}',
      '.sfwbt-show{margin-top:16px;}',
      /* THE DISPLAY SIZE. The equation - or whatever the beat is actually
         teaching - is the thing the student is meant to look at, so it is the
         largest element on the board by a wide margin, not a code snippet
         tucked under the prose. Scales with the viewport so it stays big on a
         phone without overflowing a narrow board. */
      /* Matches the house maths visual in lesson.html (buildMathVisual): the
         theme serif with tabular figures, not monospace. Monospace was off
         theme - StudyFlow is DM Sans and Instrument Serif throughout - and
         tabular-nums keeps digits on a common width so columns of numbers
         line up instead of shimmying.

         It wraps rather than scrolls. overflow-x:auto meant a long equation
         ran off the right edge with the end of it simply not visible: it
         looked broken AND hid the answer. Wrapping plus fitEquations() below
         means nothing is ever cut off. */
      '.sfwbt-eq{font-family:var(--serif),Georgia,serif;',
        'font-size:clamp(1.9rem,7vw,3rem);line-height:1.3;letter-spacing:.01em;font-weight:700;',
        'font-variant-numeric:tabular-nums;color:var(--ink);text-align:center;',
        'background:var(--soft);border-radius:16px;padding:28px 20px;',
        'white-space:pre-wrap;overflow-wrap:anywhere;}',
      /* A plain-text `show` is also the point of its beat, just not symbolic:
         bigger than body copy, below the equation. */
      '.sfwbt-show.sfwbt-say{font-size:clamp(1.05rem,3.2vw,1.35rem);line-height:1.5;',
        'text-align:center;color:var(--ink);}',
      /* Once a beat becomes history it compacts back down, or three big
         equations fill the board and the current one stops standing out. */
      '.sfwbt-beat.is-prior .sfwbt-eq{font-size:1.05rem;padding:12px 14px;font-weight:500;}',
      '.sfwbt-beat.is-prior .sfwbt-show.sfwbt-say{font-size:0.92rem;}',
      '.sfwbt-beat.is-prior .sfwbt-diagram svg{max-height:110px;}',
      '.sfwbt-list{margin:0;padding-left:1.15rem;}',
      '.sfwbt-list li{margin-bottom:8px;font-size:1.02rem;line-height:1.6;}',
      '.sfwbt-beat.is-prior .sfwbt-list li{font-size:0.88rem;margin-bottom:5px;}',
      '.sfwbt-tablewrap{overflow-x:auto;}',
      '.sfwbt-table{border-collapse:collapse;width:100%;font-size:0.88rem;}',
      '.sfwbt-table td,.sfwbt-table th{border-bottom:1px solid var(--border);padding:8px 10px;text-align:left;',
        'font-variant-numeric:tabular-nums;}',
      '.sfwbt-hl{background:var(--blue-light);border-radius:6px;padding:2px 6px;}',
      '.sfwbt-check{margin-top:16px;padding:12px 14px;border-left:3px solid var(--blue);',
        'background:var(--soft);border-radius:0 12px 12px 0;font-size:0.95rem;line-height:1.6;}',
      '.sfwbt-check-tag{display:block;font-size:0.66rem;font-weight:800;letter-spacing:.08em;',
        'text-transform:uppercase;color:var(--blue);margin-bottom:.3rem;}',
      '.sfwbt-diagram svg{max-width:100%;width:100%;height:auto;display:block;margin:0 auto;}',
      '.sfwbt-beat.is-current .sfwbt-diagram{padding:8px 0;}',
      /* beat rail: one segment per beat, no percentage text */
      '.sfwbt-rail{display:flex;gap:6px;margin-top:14px;}',
      '.sfwbt-seg{flex:1 1 0;height:4px;border-radius:999px;background:var(--blue-light);}',
      '.sfwbt-seg.is-done{background:var(--blue);}',
      /* controls - 48px minimum target on every screen */
      '.sfwbt-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px;}',
      '.sfwbt-btn{min-height:48px;padding:0 16px;border-radius:12px;border:1.5px solid var(--border);',
        'background:var(--white);color:var(--ink);font-family:var(--sans),sans-serif;font-size:0.86rem;',
        'font-weight:600;cursor:pointer;transition:border-color .18s ' + EASE + ',color .18s ' + EASE + ';}',
      '.sfwbt-btn:hover:not(:disabled){border-color:var(--blue);color:var(--blue);}',
      '.sfwbt-btn:disabled{opacity:.45;cursor:default;}',
      '.sfwbt-btn.is-primary{background:var(--blue);border-color:var(--blue);color:#fff;}',
      '.sfwbt-btn.is-primary:hover:not(:disabled){color:#fff;filter:brightness(1.05);}',
      '.sfwbt-msg{font-size:0.8rem;color:var(--muted);margin-top:10px;min-height:1em;}',
      /* entrance motion */
      '.sfwbt-in{opacity:0;transform:translateY(6px);}',
      '.sfwbt-in.is-on{opacity:1;transform:none;transition:opacity ' + TEXT_MS + 'ms ' + EASE + ',transform ' + TEXT_MS + 'ms ' + EASE + ';}',
      /* dark mode - follows lesson.html's body.dark override block */
      'body.dark .sfwbt-board{background:#161b28;border-color:#222840;}',
      'body.dark .sfwbt-beat.is-current{color:#e8eeff;}',
      'body.dark .sfwbt-head{color:#e8eeff;}',
      'body.dark .sfwbt-beat.is-prior,body.dark .sfwbt-beat.is-prior .sfwbt-head{color:#7a8aaa;}',
      'body.dark .sfwbt-eq,body.dark .sfwbt-check{background:#1e2336;}',
      'body.dark .sfwbt-table td,body.dark .sfwbt-table th{border-color:#222840;}',
      'body.dark .sfwbt-btn{background:#1e2336;border-color:#222840;color:#e8eeff;}',
      'body.dark .sfwbt-seg{background:#222840;}',
      /* mobile: near full bleed, taller aspect, rail stays */
      '@media(max-width:768px){.sfwbt-board{padding:20px;border-radius:18px;aspect-ratio:4/3;}',
        '.sfwbt-head{font-size:1.08rem;}.sfwbt-btn{flex:1 1 auto;}',
        '.sfwbt-eq{padding:22px 14px;}}',
      '@media(max-width:390px){.sfwbt-board{padding:16px;border-radius:16px;}',
        '.sfwbt-say{font-size:0.92rem;}}',
      /* reduced motion: everything at final state, dimming keeps its value
         but loses the transition */
      '@media(prefers-reduced-motion:reduce){',
        '.sfwbt-in,.sfwbt-in.is-on{opacity:1;transform:none;transition:none;}',
        '.sfwbt-beat.is-prior{transition:none;}',
        '.sfwbt-ink{stroke-dasharray:none !important;stroke-dashoffset:0 !important;transition:none !important;}}'
    ].join('');
    var el = doc.createElement('style');
    el.id = STYLE_ID;
    el.appendChild(doc.createTextNode(css));
    (doc.head || doc.documentElement).appendChild(el);
  }

  /* ── BEAT DERIVATION ────────────────────────────────────────────────────
     Backward compatibility is mandatory: every plan already in a learner's
     localStorage predates the `whiteboard` field. Fall through steps ->
     content sentences -> concepts. A blank card or a thrown error is never
     an acceptable outcome here. */

  var SHOW_KINDS = { text:1, equation:1, diagram:1, arrow:1, highlight:1, list:1, table:1 };

  function normalizeShow(show) {
    if (!show || typeof show !== 'object') return null;
    var kind = clean(show.kind).toLowerCase();
    if (!SHOW_KINDS[kind]) return null;
    var value = show.value;
    if (kind === 'list' || kind === 'table') {
      if (Object.prototype.toString.call(value) !== '[object Array]') {
        /* a newline-delimited string is the shape the model most often
           returns for a list; accept it rather than dropping the beat */
        if (typeof value === 'string' && value.indexOf('\n') > -1) value = value.split('\n');
        else return null;
      }
      if (!value.length) return null;
    } else {
      if (typeof value !== 'string' && typeof value !== 'number') return null;
      value = clean(value);
      if (!value) return null;
    }
    return { kind: kind, value: value, target: clean(show.target) };
  }

  function normalizeBeats(raw) {
    if (Object.prototype.toString.call(raw) !== '[object Array]') return [];
    var out = [], i, b, headline, say;
    for (i = 0; i < raw.length; i++) {
      b = raw[i];
      if (!b || typeof b !== 'object') continue;
      /* Only strings. clean() would happily turn {a:1} into "[object Object]"
         and print it as a headline, which is worse than dropping the beat. */
      headline = (typeof b.headline === 'string') ? clean(b.headline) : '';
      say = (typeof b.say === 'string') ? clean(b.say) : '';
      /* A beat with neither a headline nor a sentence has nothing to show. */
      if (!headline && !say) continue;
      /* Redundancy principle: a headline that merely restates the sentence
         below it is the same information twice. Drop the headline and keep the
         sentence, which carries more. */
      headline = dedupeHeadline(headline, say);
      out.push({
        beat: out.length + 1,
        headline: headline,
        say: say,
        show: normalizeShow(b.show),
        checkpoint: (typeof b.checkpoint === 'string') ? clean(b.checkpoint) : ''
      });
      /* Small steps, but a lesson card is not a slide deck. Seven matches the
         4-7 budget the prompt asks for (Rosenshine: present new material in
         small steps). */
      if (out.length >= 7) break;
    }
    return out;
  }

  function splitSentences(text) {
    var t = clean(text);
    if (!t) return [];
    var parts = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
    var out = [], i, s;
    for (i = 0; i < parts.length; i++) {
      s = clean(parts[i]);
      if (s.length > 2) out.push(s);
    }
    return out;
  }

  function headlineFrom(text, fallback) {
    var t = clean(text);
    if (!t) return fallback;
    var words = t.split(' ');
    if (words.length <= 8) return t.replace(/[.:;,]+$/, '');
    return words.slice(0, 7).join(' ').replace(/[.:;,]+$/, '') + '…';
  }

  /* The redundancy guard, applied EVERYWHERE a beat is built rather than only
     to model-supplied ones. The fallback paths used headlineFrom(sentence) as
     the headline and the same sentence as the body, so a derived beat read:

       Algebra is the branch of mathematics that…
       Algebra is the branch of mathematics that uses letters (variables) to…

     which is the same sentence twice, once truncated. A headline that is a
     prefix or a truncation of its own sentence is dropped. */
  function dedupeHeadline(headline, say) {
    if (!headline || !say) return headline;
    var h = headline.replace(/[….]+$/, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    var y = say.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (!h) return headline;
    if (y === h || y.indexOf(h) === 0) return '';
    return headline;
  }

  function mkBeat(n, headline, say, show, checkpoint) {
    return { beat: n, headline: dedupeHeadline(headline, say), say: say,
             show: show || null, checkpoint: checkpoint || '' };
  }

  /* Derived beats carry no `show` at all, so an old plan got a board of pure
     prose - and prose is the thing a whiteboard is supposed to replace. These
     build visuals out of what the day already has, through the app's existing
     diagram kit (window.generateDiagramSVG) rather than drawing anything new.

     Nothing is invented: a roadmap is the day's own steps, a worked line is an
     equation from the day's own questions, a hub is the day's own key terms.
     Where the material has no shape, the beat keeps no visual - a wrong
     picture teaches worse than none. */
  function diagramFor(spec) {
    try {
      if (typeof global.generateDiagramSVG !== 'function') return null;
      var svg = global.generateDiagramSVG(spec);
      return svg ? { kind: 'diagram', value: svg, _raw: true } : null;
    } catch (e) { return null; }
  }

  function equationsFrom(day) {
    var qs = (day && day.questions) || [], out = [], i;
    if (Object.prototype.toString.call(qs) !== '[object Array]') return out;
    for (i = 0; i < qs.length; i++) {
      var q = qs[i];
      if (!q || q.type !== 'bigequation') continue;
      var eq = clean(q.equation);
      /* Never the answer - the learner is about to be asked this. */
      if (eq) out.push(eq);
    }
    return out;
  }

  function addVisuals(day, out) {
    if (!out.length) return out;

    /* Beat 1 gets the roadmap: every step at once, so the learner can see the
       shape of the procedure before walking it. */
    var stepLabels = [], i;
    for (i = 0; i < out.length; i++) {
      var lab = clean(out[i].headline) || clean(out[i].say);
      if (lab) stepLabels.push(lab.length > 38 ? lab.slice(0, 36) + '…' : lab);
    }
    if (!out[0].show && stepLabels.length >= 2) {
      out[0].show = diagramFor({ type: 'custom', layout: 'flow',
                                 title: '', items: stepLabels.slice(0, 6) });
    }

    /* Worked lines on the middle beats, from the day's own equations. */
    var eqs = equationsFrom(day);
    for (i = 1; i < out.length && eqs.length; i++) {
      if (out[i].show) continue;
      var eq = eqs.shift();
      if (eq) out[i].show = { kind: 'equation', value: eq };
    }

    /* Still bare, and the day has vocabulary: a hub of what it rests on. */
    if (!out[out.length - 1].show) {
      /* whiteboard.js has no list() helper - that name belongs to the other
         module. A ReferenceError here was swallowed by lesson.html's try/catch
         around deriveBeats, so EVERY board silently fell back to the static
         lesson body and the whiteboard simply stopped appearing. */
      var terms = [], kts = (Object.prototype.toString.call(day.keyTerms) === '[object Array]') ? day.keyTerms : [];
      for (i = 0; i < kts.length && terms.length < 5; i++) {
        var k = kts[i];
        var t = typeof k === 'string' ? clean(k) : clean(k && (k.term || k.title));
        if (t) terms.push(t);
      }
      if (terms.length >= 3) {
        out[out.length - 1].show = diagramFor({
          type: 'custom', layout: 'concept',
          center: clean(day.title).replace(/^[^:]*:\s*/, '') || 'This topic',
          items: terms
        });
      }
    }
    return out;
  }

  function deriveBeats(day) {
    day = day || {};
    var beats = normalizeBeats(day.whiteboard);
    if (beats.length) return addVisuals(day, beats);

    var i, s, out = [];

    /* 1. steps - the closest existing thing to a beat list */
    var steps = day.steps;
    if (Object.prototype.toString.call(steps) === '[object Array]') {
      for (i = 0; i < steps.length && out.length < 7; i++) {
        s = steps[i];
        var label = typeof s === 'string' ? clean(s) : clean(s && (s.step || s.title || s.label));
        var detail = typeof s === 'string' ? '' : clean(s && (s.action || s.why || s.detail || s.body));
        if (!label) continue;
        out.push(mkBeat(out.length + 1, headlineFrom(label, 'Step ' + (out.length + 1)), detail || label));
      }
      if (out.length >= 2) return addVisuals(day, out);
      out = [];
    }

    /* 2. content, split into sentences */
    var sents = splitSentences(day.content);
    if (sents.length >= 2) {
      for (i = 0; i < sents.length && out.length < 6; i++) {
        out.push(mkBeat(out.length + 1, headlineFrom(sents[i], 'Idea ' + (out.length + 1)), sents[i]));
      }
      return addVisuals(day, out);
    }

    /* 3. concepts */
    var cons = day.concepts;
    if (Object.prototype.toString.call(cons) === '[object Array]') {
      for (i = 0; i < cons.length && out.length < 6; i++) {
        var c = cons[i];
        var nm = typeof c === 'string' ? clean(c) : clean(c && (c.name || c.title || c.label));
        var df = typeof c === 'string' ? '' : clean(c && (c.definition || c.why || c.description));
        if (!nm) continue;
        out.push(mkBeat(out.length + 1, headlineFrom(nm, 'Concept'), df || nm, null,
                        (typeof c === 'object' && c) ? clean(c.misconception) : ''));
      }
      if (out.length) return addVisuals(day, out);
    }

    /* 4. keyTerms, last resort - still better than an empty board */
    var kts = day.keyTerms;
    if (Object.prototype.toString.call(kts) === '[object Array]') {
      for (i = 0; i < kts.length && out.length < 5; i++) {
        var k = kts[i];
        var term = typeof k === 'string' ? clean(k) : clean(k && k.term);
        var def = typeof k === 'string' ? '' : clean(k && k.definition);
        if (!term) continue;
        out.push(mkBeat(out.length + 1, headlineFrom(term, 'Key term'), def || term));
      }
      if (out.length) return addVisuals(day, out);
    }

    /* 5. nothing usable: one honest beat rather than a blank board */
    var title = clean(day.title) || 'Today’s lesson';
    return addVisuals(day, [{ beat: 1, headline: headlineFrom(title, 'Today’s lesson'),
              say: clean(day.content) || clean(day.briefing) ||
                   'Let’s work through this topic together.',
              show: null, checkpoint: '' }]);
  }

  /* ── SHOW RENDERING ─────────────────────────────────────────────────────
     Diagrams go through lesson.html's generateDiagramSVG so there is exactly
     one diagram implementation in the app. If it is unavailable or declines,
     fall back to the callout box rather than leaving a hole. */
  function renderShow(show) {
    if (!show) return '';
    var k = show.kind, v = show.value, i, html;

    if (k === 'equation') return '<div class="sfwbt-show sfwbt-eq sfwbt-in">' + esc(v) + '</div>';

    if (k === 'list') {
      html = '';
      for (i = 0; i < v.length; i++) {
        var item = clean(v[i]);
        if (item) html += '<li>' + esc(item) + '</li>';
      }
      return html ? '<ul class="sfwbt-show sfwbt-list sfwbt-in">' + html + '</ul>' : '';
    }

    if (k === 'table') {
      html = '';
      for (i = 0; i < v.length; i++) {
        var row = v[i];
        var cells = Object.prototype.toString.call(row) === '[object Array]'
          ? row : String(row == null ? '' : row).split('|');
        var tag = (i === 0) ? 'th' : 'td', rowHtml = '', j;
        for (j = 0; j < cells.length; j++) rowHtml += '<' + tag + '>' + esc(clean(cells[j])) + '</' + tag + '>';
        if (rowHtml) html += '<tr>' + rowHtml + '</tr>';
      }
      return html ? '<div class="sfwbt-show sfwbt-tablewrap sfwbt-in"><table class="sfwbt-table">' + html + '</table></div>' : '';
    }

    if (k === 'diagram') {
      var svg = null;
      /* addVisuals() already resolved its diagrams through the kit and marked
         them _raw, so they must not be passed back through it as if they were
         a spec - that returns null and the beat silently loses its picture. */
      if (show._raw && typeof v === 'string' && v.indexOf('<svg') > -1) {
        svg = v;
      } else {
        try {
          if (typeof global.generateDiagramSVG === 'function') svg = global.generateDiagramSVG(v);
        } catch (e) { svg = null; }
      }
      if (svg) return '<div class="sfwbt-show sfwbt-diagram sfwbt-in">' + svg + '</div>';
      return '<div class="sfwbt-show sfwbt-eq sfwbt-in">' + esc(v) + '</div>';
    }

    if (k === 'arrow' || k === 'highlight') {
      /* Annotations: they point at something already on the board, so they
         are drawn after it has settled - see the ANNOTATE_GAP_MS stagger. */
      var cls = (k === 'highlight') ? 'sfwbt-hl' : '';
      var label = (k === 'arrow' ? '→ ' : '') + v;
      return '<div class="sfwbt-show sfwbt-small sfwbt-in sfwbt-annot">' +
             (cls ? '<span class="' + cls + '">' + esc(label) + '</span>' : esc(label)) + '</div>';
    }

    /* text */
    return '<div class="sfwbt-show sfwbt-say sfwbt-in">' + esc(v) + '</div>';
  }

  function beatHtml(b, index, isCurrent) {
    var h = '<div class="sfwbt-beat ' + (isCurrent ? 'is-current' : 'is-prior') +
            '" data-beat="' + index + '">';
    if (b.headline) h += '<h3 class="sfwbt-head sfwbt-in">' + esc(b.headline) + '</h3>';
    if (b.say) h += '<p class="sfwbt-say sfwbt-in">' + esc(b.say) + '</p>';
    h += renderShow(b.show);
    /* Rosenshine's "check for understanding". Unlabelled it read as a caption;
       labelled, the student knows they are meant to answer it before moving
       on. */
    if (b.checkpoint) {
      h += '<div class="sfwbt-check sfwbt-in">' +
           '<span class="sfwbt-check-tag">Check yourself</span>' +
           esc(b.checkpoint) + '</div>';
    }
    return h + '</div>';
  }

  /* ── INK DRAW-ON ────────────────────────────────────────────────────────
     Any <path> inside a freshly landed beat is drawn rather than faded in,
     in document order - the order a person would draw it. Duration scales
     with path length so a long stroke does not snap. */
  function inkPaths(scope) {
    if (reduced()) return;
    var paths = scope.querySelectorAll('svg path');
    var i, p, len, dur, delay = 0;
    for (i = 0; i < paths.length && i < 24; i++) {
      p = paths[i];
      try { len = p.getTotalLength(); } catch (e) { continue; }
      if (!len || len < 4) continue;
      dur = Math.max(INK_MIN_MS, Math.min(INK_MAX_MS, len * 1.6));
      p.classList.add('sfwbt-ink');
      p.style.strokeDasharray = len + ' ' + len;
      p.style.strokeDashoffset = len;
      p.style.transition = 'stroke-dashoffset ' + dur + 'ms ' + EASE + ' ' + delay + 'ms';
      /* force layout so the transition has a start value to run from */
      /* eslint-disable-next-line no-unused-expressions */
      p.getBoundingClientRect();
      p.style.strokeDashoffset = '0';
      delay += 40;
    }
  }

  /* Shrink an equation until it fits its box. Wrapping alone can leave a long
     expression broken across four cramped lines; stepping the size down first
     keeps it readable and keeps any break where the content allows one. The
     floor stops it shrinking into the body text. */
  var MAX_EQ_LINES = 3;

  function eqLineCount(el, cs) {
    var lh = parseFloat(cs.lineHeight);
    if (!lh) return 1;
    var inner = el.scrollHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
    return Math.max(1, Math.round(inner / lh));
  }

  function fitEquations(scope) {
    if (!scope) return;
    var els = scope.querySelectorAll('.sfwbt-eq');
    var i, el, cs, size, guard, floorPx = 16;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      el.style.fontSize = '';                       /* back to the clamp */
      cs = global.getComputedStyle(el);
      size = parseFloat(cs.fontSize) || 30;
      guard = 0;
      /* Shrink on LINE COUNT, not just overflow. The box has no fixed height,
         so it simply grows and nothing ever "overflows" - an 85-character
         expression rendered as nine cramped lines at full display size, which
         does not fall off the card but looks broken. Three lines is the limit;
         below the floor it stops and wraps instead, which is still legible. */
      while (guard < 40 && size > floorPx &&
             (el.scrollWidth > el.clientWidth + 1 || eqLineCount(el, cs) > MAX_EQ_LINES)) {
        size -= 2;
        el.style.fontSize = size + 'px';
        cs = global.getComputedStyle(el);
        guard++;
      }
    }
  }

  /* ── THE BOARD ──────────────────────────────────────────────────────────*/
  /* Guided practice, built from the beats themselves.

     Pearson and Gallagher's gradual release runs I do -> we do -> you do, and
     the board was only ever doing "I do": it modelled the steps and stopped.
     Renkl and Atkinson's fading work says the transition should be a
     completion problem - the learner supplies the steps that were shown.

     So after the modelled run, the same procedure comes back with the steps
     hidden and the learner chooses what comes next. It needs no new data: the
     distractors are the lesson's own later steps, which is exactly the
     confusion worth testing - knowing the moves is not knowing their order. */
  function buildPractice(beats) {
    var steps = [], i;
    for (i = 0; i < beats.length; i++) {
      var label = clean(beats[i].headline) || clean(beats[i].say);
      if (label) steps.push({ label: label, say: clean(beats[i].say), idx: steps.length });
    }
    /* Two steps cannot make an ordering question worth asking. */
    if (steps.length < 3) return null;
    return { steps: steps, at: 0, wrong: 0 };
  }

  function Board(day, mount) {
    this.day = day || {};
    this.mount = mount;
    this.beats = deriveBeats(this.day);
    this.index = 0;
    this.busy = false;
    this.keyHandler = null;
    this.practice = buildPractice(this.beats);
    this.phase = 'teach';          /* teach -> practice */
    this.chosen = null;            /* the option picked on the current step */
  }

  Board.prototype.destroy = function () {
    if (this.keyHandler && doc) doc.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  };

  /* Which of the three phases the learner is in, in their words not ours. */
  Board.prototype.phaseChip = function () {
    if (this.phase === 'practice') {
      return '<div class="sfwbt-phase"><span class="sfwbt-chip is-practice">Your turn</span>' +
             '<span class="sfwbt-phase-note">Put the steps in order</span></div>';
    }
    if (this.index === 0) {
      return '<div class="sfwbt-phase"><span class="sfwbt-chip">What we are learning</span></div>';
    }
    return '<div class="sfwbt-phase"><span class="sfwbt-chip">Watch me</span>' +
           '<span class="sfwbt-phase-note">Step ' + this.index + ' of ' + (this.beats.length - 1) + '</span></div>';
  };

  Board.prototype.practiceHtml = function () {
    var p = this.practice, done = p.steps.slice(0, p.at), i;
    var h = this.phaseChip();

    if (done.length) {
      h += '<div class="sfwbt-sofar"><span class="sfwbt-sofar-tag">So far</span><ol class="sfwbt-list">';
      for (i = 0; i < done.length; i++) h += '<li>' + esc(done[i].label) + '</li>';
      h += '</ol></div>';
    }

    if (p.at >= p.steps.length) {
      h += '<p class="sfwbt-pq sfwbt-in">That is the whole procedure, in order. You built it yourself.</p>';
      return h;
    }

    h += '<p class="sfwbt-pq sfwbt-in">' +
         (p.at === 0 ? 'Which step comes first?' : 'What comes next?') + '</p>';

    /* Options: the correct next step plus up to three later ones, shuffled
       once per step so the position is not a tell. */
    var opts = [p.steps[p.at]], k;
    for (k = p.at + 1; k < p.steps.length && opts.length < 4; k++) opts.push(p.steps[k]);
    if (opts.length < 4) {
      for (k = p.at - 1; k >= 0 && opts.length < 4; k--) opts.push(p.steps[k]);
    }
    if (!p.order || p.orderFor !== p.at) {
      p.order = opts.slice().sort(function () { return Math.random() - 0.5; });
      p.orderFor = p.at;
    }
    for (i = 0; i < p.order.length; i++) {
      var o = p.order[i];
      var cls = 'sfwbt-opt';
      if (this.chosen !== null) {
        if (o.idx === p.at) cls += ' is-right';
        else if (o.idx === this.chosen) cls += ' is-wrong';
        else cls += ' is-dim';
      }
      h += '<button type="button" class="' + cls + '" data-idx="' + o.idx + '"' +
           (this.chosen !== null ? ' disabled' : '') +
           ' onclick="window.__sfwbtPick(' + o.idx + ')">' + esc(o.label) + '</button>';
    }
    if (this.chosen !== null) {
      var right = this.chosen === p.at;
      h += '<div class="sfwbt-why sfwbt-in">' +
           (right ? '' : 'Not yet — that step comes later. ') +
           esc(p.steps[p.at].say || p.steps[p.at].label) + '</div>';
    }
    return h;
  };

  Board.prototype.html = function () {
    var i, h = '<div class="sfwbt">';
    h += '<div class="sfwbt-board" id="sfwbt-board">';
    if (this.phase === 'practice') {
      h += this.practiceHtml();
    } else {
      h += this.phaseChip();
      for (i = 0; i <= this.index && i < this.beats.length; i++) {
        h += beatHtml(this.beats[i], i, i === this.index);
      }
    }
    h += '</div>';
    /* One rail across both phases, so the learner can see that the lesson does
       not end when the modelling does. */
    var pSteps = this.practice ? this.practice.steps.length : 0;
    var total = this.beats.length + pSteps;
    var doneTo = this.phase === 'practice' ? this.beats.length + this.practice.at : this.index;
    h += '<div class="sfwbt-rail" role="progressbar" aria-valuemin="1" aria-valuemax="' +
         total + '" aria-valuenow="' + (doneTo + 1) + '">';
    for (i = 0; i < total; i++) {
      h += '<span class="sfwbt-seg' + (i <= doneTo ? ' is-done' : '') + '"></span>';
    }
    h += '</div>';
    h += '<div class="sfwbt-controls">' +
      '<button type="button" class="sfwbt-btn" id="sfwbt-back">← Back</button>' +
      '<button type="button" class="sfwbt-btn" id="sfwbt-replay">Replay</button>' +
      '<button type="button" class="sfwbt-btn" id="sfwbt-explain">Explain differently</button>' +
      '<button type="button" class="sfwbt-btn is-primary" id="sfwbt-next">Next →</button>' +
      '</div>';
    h += '<div class="sfwbt-msg" id="sfwbt-msg" role="status" aria-live="polite"></div>';
    return h + '</div>';
  };

  Board.prototype.animateCurrent = function () {
    var board = doc.getElementById('sfwbt-board');
    if (!board) return;
    var current = board.querySelector('.sfwbt-beat.is-current');
    if (!current) return;

    /* Earlier beats are HISTORY: they were revealed on their own turn and must
       be shown at their final state immediately. Only the current beat gets
       marked, so every prior beat sat at opacity 0 - present in the layout,
       taking up its full height, drawn as nothing. The board therefore grew a
       tall blank area and pushed the one visible beat further down the card
       with every press of Next. That is the "text keeps going down" bug: the
       text was not moving, the invisible beats above it were piling up. */
    var prior = board.querySelectorAll('.sfwbt-beat:not(.is-current) .sfwbt-in');
    for (var p = 0; p < prior.length; p++) prior[p].classList.add('is-on');

    if (reduced()) {
      var all = current.querySelectorAll('.sfwbt-in');
      for (var n = 0; n < all.length; n++) all[n].classList.add('is-on');
      return;
    }

    var items = current.querySelectorAll('.sfwbt-in');
    var i, delay = 0;
    for (i = 0; i < items.length; i++) {
      /* annotations wait for the thing they annotate to settle */
      if (items[i].className.indexOf('sfwbt-annot') > -1) delay += ANNOTATE_GAP_MS;
      (function (el, d) {
        global.setTimeout(function () { el.classList.add('is-on'); }, d);
      })(items[i], delay);
      delay += STAGGER_MS;
    }
    inkPaths(current);
    try { board.scrollTop = board.scrollHeight; } catch (e) {}
  };

  Board.prototype.paint = function () {
    this.mount.innerHTML = this.html();
    this.bind();
    fitEquations(doc.getElementById('sfwbt-board'));
    this.animateCurrent();
  };

  Board.prototype.go = function (delta) {
    var next = this.index + delta;
    if (next < 0 || next >= this.beats.length) return;
    this.index = next;
    this.paint();
  };

  Board.prototype.replay = function () {
    if (this.phase === 'practice') this.chosen = null;
    this.paint();
  };

  Board.prototype.msg = function (text) {
    var m = doc.getElementById('sfwbt-msg');
    if (m) m.textContent = text || '';
  };

  /* "Explain differently" - ask the model for a simpler version of THIS beat.
     On any failure the original beat stays exactly as it was and the learner
     is told inline. The board is never left blank. */
  Board.prototype.explain = function () {
    var self = this;
    if (self.busy) return;
    var beat = self.beats[self.index];
    if (!beat) return;
    var btn = doc.getElementById('sfwbt-explain');
    self.busy = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Rewriting…'; }
    self.msg('Asking for a simpler explanation…');

    var topic = clean(self.day.title) || 'this topic';
    var prompt = 'Re-explain one step of a lesson for a struggling student.\n' +
      'Topic: ' + topic + '\n' +
      'Current headline: ' + beat.headline + '\n' +
      'Current explanation: ' + beat.say + '\n\n' +
      'Rewrite it simpler and more concrete, using an everyday comparison. ' +
      'Reply with ONLY compact JSON, no markdown: ' +
      '{"headline":"under 8 words","say":"two short sentences"}';

    var done = false;
    var timer = global.setTimeout(function () {
      if (done) return; done = true; self.finishExplain(btn, 'That took too long — keeping the original.');
    }, 20000);

    try {
      global.fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (done) return; done = true; global.clearTimeout(timer);
        var txt = data && data.result ? String(data.result) : '';
        var parsed = null;
        try {
          var s = txt.indexOf('{'), e = txt.lastIndexOf('}');
          if (s > -1 && e > s) parsed = JSON.parse(txt.substring(s, e + 1));
        } catch (err) { parsed = null; }
        if (parsed && (clean(parsed.say) || clean(parsed.headline))) {
          beat.headline = clean(parsed.headline) || beat.headline;
          beat.say = clean(parsed.say) || beat.say;
          self.busy = false;
          self.paint();
          self.msg('Re-explained. Replay to see it again.');
          return;
        }
        self.finishExplain(btn, 'Could not rewrite that one — keeping the original.');
      })['catch'](function () {
        if (done) return; done = true; global.clearTimeout(timer);
        self.finishExplain(btn, 'Offline or unavailable — keeping the original.');
      });
    } catch (e) {
      done = true; global.clearTimeout(timer);
      self.finishExplain(btn, 'Could not reach the explainer — keeping the original.');
    }
  };

  Board.prototype.finishExplain = function (btn, text) {
    this.busy = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Explain differently'; }
    this.msg(text);
  };

  Board.prototype.bind = function () {
    var self = this;
    var back = doc.getElementById('sfwbt-back');
    var next = doc.getElementById('sfwbt-next');
    var replay = doc.getElementById('sfwbt-replay');
    var explain = doc.getElementById('sfwbt-explain');
    var last = self.index >= self.beats.length - 1;

    if (back) {
      back.disabled = self.phase === 'teach' && self.index === 0;
      back.onclick = function () {
        if (self.phase === 'practice') {
          if (self.practice.at > 0 || self.chosen !== null) {
            if (self.chosen !== null) { self.chosen = null; }
            else { self.practice.at--; }
          } else {
            self.phase = 'teach';       /* back into the modelled run */
          }
          self.paint();
          return;
        }
        self.go(-1);
      };
    }
    if (replay) replay.onclick = function () { self.replay(); };
    if (explain) explain.onclick = function () { self.explain(); };
    if (next) {
      next.disabled = false;
      if (self.phase === 'practice') {
        var finished = self.practice.at >= self.practice.steps.length;
        next.textContent = finished ? 'Done →' : 'Next →';
        /* Until they have answered, Next would skip the question. */
        next.disabled = !finished && self.chosen === null;
        next.onclick = function () {
          if (finished) {
            if (typeof global.showNextCard === 'function') global.showNextCard();
            return;
          }
          self.practice.at++;
          self.chosen = null;
          self.paint();
        };
      } else {
        var intoPractice = last && !!self.practice;
        next.textContent = intoPractice ? 'Your turn →' : (last ? 'Done →' : 'Next →');
        next.onclick = function () {
          if (intoPractice) { self.phase = 'practice'; self.chosen = null; self.paint(); return; }
          if (last) {
            if (typeof global.showNextCard === 'function') global.showNextCard();
            return;
          }
          self.go(1);
        };
      }
    }

    if (!self.keyHandler) {
      self.keyHandler = function (ev) {
        if (!doc.getElementById('sfwbt-board')) return;   /* card has moved on */
        var t = ev.target || {};
        var tag = (t.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || t.isContentEditable) return;
        if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault(); self.go(1);
        } else if (ev.key === 'ArrowLeft') {
          ev.preventDefault(); self.go(-1);
        } else if (ev.key === 'r' || ev.key === 'R') {
          ev.preventDefault(); self.replay();
        }
      };
      doc.addEventListener('keydown', self.keyHandler);
    }
  };

  /* Bound globally because the option buttons are rebuilt on every paint and
     inline onclick is how the rest of lesson.html wires its cards. */
  global.__sfwbtPick = function (idx) {
    var b = global.__sfwbtActive;
    if (!b || b.phase !== 'practice' || b.chosen !== null) return;
    b.chosen = idx;
    if (idx !== b.practice.at) b.practice.wrong++;
    b.paint();
  };

  /* ── PUBLIC ─────────────────────────────────────────────────────────────*/
  function render(day, mount) {
    if (!mount) return false;
    try {
      injectStyles();
      var board = new Board(day, mount);
      if (!board.beats.length) return false;
      if (global.__sfwbtActive && global.__sfwbtActive.destroy) global.__sfwbtActive.destroy();
      global.__sfwbtActive = board;
      board.paint();
      return true;
    } catch (e) {
      if (global.console && global.console.error) global.console.error('[Whiteboard] render failed', e);
      return false;
    }
  }

  global.Whiteboard = {
    render: render,
    deriveBeats: deriveBeats,      /* exposed for tests */
    normalizeBeats: normalizeBeats
  };
})(window);

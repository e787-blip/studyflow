/* engine.js - the shared session engine for the lesson.html redesign prototype.

   The point of the redesign is ONE card contract that every question type
   fits. Today each of ~30 renderers builds its own shell: the type is named
   up to four times on one card, there are five Check-button styles, and
   Check sits in four different places. Here every card is the same five
   slots, in the same order, whatever the type:

     eyebrow   - where you are + the type, named ONCE (+ level, + a tag such
                 as "Pre-test" or "Try again")
     stem      - the question itself. The biggest thing on the card.
     stim      - the material, when there is any: a passage, two sources, a
                 maths panel, a chart, a picture (always on paper)
     work      - the answer area. One of eight kinds (see KINDS below)
     feedback  - verdict, the right answer, why, and the way to a walkthrough

   ...plus ONE primary action (Check -> Continue) that always lives in the
   same place, and the same two tools on every question (Hint, Flag).

   A direction (a.js / b.js / c.js) only decides how those slots are laid out
   and styled. It never builds a workspace and never grades - so a type added
   here works in all three, and the three can be compared fairly.

   Direction contract (SFP.register(id, impl)):
     impl.name                     'Paper' | 'Focus' | 'Desk'
     impl.frame(ctx)       -> html  the whole page: nav, rails, and an element
                                    with [data-slot="card"] the card mounts in
     impl.card(card, parts, ctx) -> html  one card; must keep parts.work, and
                                    have [data-slot="work"], [data-slot="hint"],
                                    [data-slot="feedback"] (unless it uses a tray)
     impl.update(ctx)              repaint nav progress / score (after any change)
     impl.showFeedback(root, fb, ctx)   optional; default = inline in the slot
     impl.clearFeedback(root, ctx)      optional
     impl.mounted(cardEl, ctx)          optional, after a card is in the DOM
   Buttons anywhere with class .c-primary are kept in step by the engine:
   label (.lbl), disabled, data-act. Bind live values with [data-bind]:
   time, score, streak, num, phase, phase-count.
*/
(function () {
  'use strict';
  var P = window.SFP = { dirs: {} };
  var qs = new URLSearchParams(location.search);
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── helpers ─────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  P.esc = esc;
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /* Icons: 24-unit stroke icons, drawn for this file (Lucide-like). */
  var I = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    cross: '<path d="M7 7l10 10M17 7L7 17"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    flame: '<path d="M12.4 2.6c.4 2.6 2 3.9 3.1 5.4a5.6 5.6 0 0 1 1.1 3.5 4.6 4.6 0 1 1-9.2 0c0-2 .9-3.3 2-4.5.2 1 .7 1.7 1.3 2.1.6-2.3 1-4.3 1.7-6.5Z"/>',
    bulb: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>',
    flag: '<path d="M5.5 21V4.5"/><path d="M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
    more: '<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>',
    moon: '<path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2Z"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    chevL: '<path d="M15 6l-6 6 6 6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
    chat: '<path d="M4.5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v6.5A2.5 2.5 0 0 1 17 16H8.5l-4 2.5Z"/>',
    book: '<path d="M4.5 5.5A1.5 1.5 0 0 1 6 4h12.5v14H6a1.5 1.5 0 0 0-1.5 1.5v-14Z"/><path d="M4.5 19.5A1.5 1.5 0 0 0 6 21h12.5v-3"/>',
    cards: '<rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a2.5 2.5 0 0 1 2.5 2.5V16"/>',
    pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 13.8a5.5 5.5 0 0 1 3 5.2"/>',
    order: '<path d="M4 6h9M4 12h12M4 18h7"/><path d="M18 15l2.5 3L23 15" transform="translate(-2 0)"/>',
    split: '<rect x="3.5" y="5" width="7.5" height="14" rx="2"/><rect x="13" y="5" width="7.5" height="14" rx="2"/>',
    type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    sigma: '<path d="M17.5 5h-11l6 7-6 7h11"/>',
    two: '<rect x="3.5" y="4" width="17" height="7" rx="2"/><rect x="3.5" y="13" width="17" height="7" rx="2"/>',
    home: '<path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4Z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/>',
    redo: '<path d="M20 7v5h-5"/><path d="M19.5 12A7.5 7.5 0 1 1 17 6.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    door: '<path d="M14 4h4.5v16H14"/><path d="M10 8l-4 4 4 4M6 12h10"/>'
  };
  function icon(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
  }
  P.icon = icon;
  P.logo = function (size) {
    var s = size || 28;
    return '<svg class="logo-mark" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" aria-hidden="true">' +
      '<defs><linearGradient id="sflg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b8df8"/><stop offset="1" stop-color="#2851c8"/></linearGradient></defs>' +
      '<rect width="32" height="32" rx="8" fill="url(#sflg)"/><rect x="7" y="8" width="13" height="17" rx="2.5" fill="#fff" opacity=".25"/>' +
      '<rect x="10" y="8" width="13" height="17" rx="2.5" fill="#fff" opacity=".92"/><rect x="13" y="13" width="7" height="1.5" rx=".75" fill="#3567e0"/>' +
      '<rect x="13" y="16.5" width="5" height="1.5" rx=".75" fill="#3567e0" opacity=".7"/><rect x="13" y="20" width="6" height="1.5" rx=".75" fill="#4a7cf6" opacity=".5"/></svg>';
  };

  /* ── the session: one science day (the heart), plus one maths card ── */
  var LESSON_TITLE = 'The heart and blood vessels';
  P.meta = { subject: 'Biology', day: 1, days: 5, title: LESSON_TITLE, minutes: 30 };

  P.deck = [
    { id: 'lesson', kind: 'lesson', phase: 'Lesson', label: 'Today’s lesson', title: LESSON_TITLE,
      parts: [
        { name: 'The idea', html:
          '<figure class="pic paper"><img src="../../illustrations/heart.svg" alt="The human heart, with its four chambers, valves and the big vessels labelled"></figure>' +
          '<p>Your heart is a pump with four rooms, called <b>chambers</b>. The right side sends blood to your lungs to pick up oxygen. The left side sends that oxygen-rich blood out to the rest of your body.</p>' },
        { name: 'How it works', html:
          '<ol class="steps">' +
          '<li><b>Blood comes back from the body</b> into the right atrium, through the veins.</li>' +
          '<li><b>The right ventricle pumps it to the lungs,</b> where it picks up oxygen and drops carbon dioxide.</li>' +
          '<li><b>Oxygen-rich blood returns</b> to the left atrium from the lungs.</li>' +
          '<li><b>The left ventricle pumps it out</b> through the aorta. Its thick wall makes the most pressure.</li></ol>' },
        { name: 'Core ideas', html:
          '<div class="ideas">' +
          '<div class="idea"><h4>Artery</h4><p>Carries blood <b>away</b> from the heart. A thick, stretchy wall copes with high pressure.</p></div>' +
          '<div class="idea"><h4>Vein</h4><p>Carries blood <b>back</b> to the heart. Valves stop it flowing backwards at low pressure.</p></div>' +
          '<div class="idea"><h4>Capillary</h4><p>One cell thick, so oxygen can pass straight through into the tissues.</p></div></div>' }
      ] },
    { id: 'deck', kind: 'deck', phase: 'Words', label: 'Words to know', title: 'Know these, watch for these',
      cards: [
        { trap: true, kind: 'Watch out', front: 'Blood in your veins is blue', back: 'It is always red. Vein blood is a darker red because it carries less oxygen.' },
        { kind: 'Word', front: 'Atrium', back: 'An upper chamber of the heart. It receives blood.' },
        { kind: 'Word', front: 'Ventricle', back: 'A lower chamber of the heart. It pumps blood out.' },
        { kind: 'Word', front: 'Valve', back: 'A flap that lets blood flow one way only.' }
      ] },
    { id: 'mcq', kind: 'q', type: 'mcq', phase: 'Practice', label: 'Multiple choice', level: 'medium', conf: true,
      stem: 'Why do veins need valves?',
      options: ['To speed blood up', 'To stop blood flowing backwards', 'To add oxygen to the blood', 'To filter the blood'],
      correct: 1, hint: 'Think about the pressure in veins.',
      why: 'Blood in veins is at low pressure, so the valves close behind it and stop it sliding back.' },
    { id: 'tf', kind: 'q', type: 'tf', phase: 'Practice', label: 'True or false', level: 'medium', conf: true,
      stem: 'The left ventricle has a thicker wall than the right ventricle.',
      options: ['True', 'False'], correct: 0, hint: 'Which side pumps blood further?',
      why: 'The left ventricle pumps blood around the whole body, so it needs more muscle than the right, which only pumps to the lungs.' },
    { id: 'fill', kind: 'q', type: 'fill', phase: 'Practice', label: 'Fill in the blank', level: 'easy',
      stem: 'The smallest blood vessels, one cell thick, are called ___.',
      accept: ['capillaries', 'capillary'], answer: 'capillaries', hint: 'They start with c.',
      why: 'Capillary walls are one cell thick, so oxygen passes through them into the tissues.' },
    { id: 'seq', kind: 'q', type: 'seq', phase: 'Practice', label: 'Put in order', level: 'medium',
      stem: 'Put the path of blood in order, starting from the body.',
      items: ['Right atrium', 'Right ventricle', 'Lungs', 'Left atrium', 'Left ventricle'],
      show: [2, 0, 4, 1, 3], hint: 'The right side comes before the lungs.',
      why: 'Right atrium, right ventricle, lungs, left atrium, left ventricle. The right side sends blood to the lungs; the left side sends it to the body.' },
    { id: 'sort', kind: 'q', type: 'sort', phase: 'Practice', label: 'Sort', level: 'medium',
      stem: 'Sort each fact: artery or vein?',
      groups: ['Artery', 'Vein'],
      items: [['Has valves', 1], ['Thick, stretchy wall', 0], ['Carries blood back to the heart', 1], ['High pressure', 0], ['Low pressure', 1], ['Carries blood away from the heart', 0]],
      hint: 'Arteries take blood away; veins bring it back.',
      why: 'Arteries carry high-pressure blood away from the heart, so their walls are thick. Veins bring low-pressure blood back, so they need valves.' },
    { id: 'who', kind: 'q', type: 'who', phase: 'Practice', label: 'Who’s right?', level: 'medium', conf: true,
      stem: 'Your veins look blue through your skin. Who explains it best?',
      claims: [
        { name: 'Maya', says: 'The blood in veins is blue. It only turns red when it meets oxygen.', why: 'Blood is always red. A cut bleeds red at once, before air reaches it.' },
        { name: 'Leo', says: 'Vein blood is darker red. Skin scatters light, so the vein looks blue from outside.', why: 'Yes. Less oxygen makes it darker, and skin sends back more blue light than red over a vein.' },
        { name: 'Sam', says: 'Veins are made of blue tissue, so they look blue.', why: 'Vein walls are pale. Out of the body, a vein does not look blue at all.' }
      ], correct: 1, hint: 'What colour is blood when you cut yourself?',
      why: 'Leo is right: vein blood is dark red, and the blue is an effect of light passing through skin.' },
    { id: 'two', kind: 'q', type: 'two', phase: 'Practice', label: 'Two-part', level: 'hard',
      stem: 'A runner trains for a year and the wall of her left ventricle gets thicker. What happens to the blood pumped out with each beat?',
      options: ['It goes up', 'It goes down', 'It stays the same'], correct: 0,
      reasonStem: 'Why?',
      reasons: ['A thicker wall squeezes harder, so more blood leaves with each beat', 'A thicker wall leaves less room inside, so less blood fits', 'The wall has nothing to do with how much blood is pumped'],
      reasonCorrect: 0, hint: 'The wall is muscle.',
      why: 'The ventricle wall is muscle. More muscle squeezes harder, so each beat pushes out more blood. That is why a trained athlete’s resting heart rate is lower.' },
    { id: 'chart', kind: 'q', type: 'chart', phase: 'Practice', label: 'Read the chart', level: 'medium',
      stem: 'Tap the group with the slowest resting heart rate.',
      chart: { title: 'Resting heart rate', unit: 'beats a minute', example: true,
        rows: [['Newborn', 130], ['Age 5', 95], ['Age 15', 75], ['Adult', 70], ['Athlete', 50]] },
      correctBar: 4, reasonStem: 'What does the chart show?',
      reasons: ['Resting heart rate falls as people grow up', 'Older people have faster hearts', 'Athletes have the weakest hearts', 'Heart rate does not change with age'],
      reasonCorrect: 0, hint: 'Find the shortest bar.',
      why: 'The bars get shorter from newborn to adult: a bigger, stronger heart pushes out more blood per beat, so it needs fewer beats.' },
    { id: 'recall', kind: 'q', type: 'recall', phase: 'Practice', label: 'Name them all', level: 'medium',
      stem: 'Name the four chambers of the heart.',
      items: ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'],
      hint: 'R. a…, R. v…, L. a…, L. v…',
      why: 'Each side has an atrium on top, which receives blood, and a ventricle below, which pumps it out.' },
    { id: 'eq', kind: 'q', type: 'eq', phase: 'Practice', label: 'Equation', level: 'easy', tag: 'From a maths day',
      stem: 'Solve for x', expr: '3x + 7 = 22', prefix: 'x =', answer: '5', accept: ['5', 'x=5'],
      hint: 'Undo the + 7 first, then the × 3.',
      why: 'Take 7 from both sides: 3x = 15. Then divide both sides by 3: x = 5.' },
    { id: 'write', kind: 'q', type: 'write', phase: 'Teach back', label: 'Teach it back', level: 'hard', scored: false,
      stem: 'Explain how the structure of a capillary suits its job.',
      points: ['Its wall is one cell thick', 'So oxygen and food pass through quickly', 'There are lots of them, close to every cell'],
      hint: 'Start with how thick its wall is.',
      why: '' },
    { id: 'results', kind: 'results', phase: 'Results', label: 'Session complete', title: 'Session complete' }
  ];

  P.PHASES = ['Lesson', 'Words', 'Practice', 'Teach back'];

  /* ── state ───────────────────────────────────────────────────────── */
  var S = P.state = {
    i: 0, secs: 24 * 60 + 10, total: 30 * 60, right: 0, answered: 0, streak: 0,
    status: {},     // card index -> 'right' | 'wrong' | 'done'
    misses: [],     // {stem, mine, answer}
    cs: null,       // the current card's working state
    busy: false
  };
  P.card = function () { return P.deck[S.i]; };
  P.isQuestion = function (c) { return c && c.kind === 'q'; };

  /* Practice numbering: "Question 3 of 10" counts scored questions only. */
  P.questionNumber = function (i) {
    var n = 0, total = 0;
    P.deck.forEach(function (c, k) { if (c.kind === 'q' && c.phase === 'Practice') { total++; if (k <= i) n++; } });
    return { n: n, total: total };
  };
  P.progress = function () {
    return P.PHASES.map(function (ph) {
      var items = [];
      P.deck.forEach(function (c, k) {
        if (c.phase === ph) items.push({ i: k, label: c.label, status: k === S.i ? 'now' : (S.status[k] || (k < S.i ? 'done' : 'todo')) });
      });
      var done = items.filter(function (x) { return x.status !== 'now' && x.status !== 'todo'; }).length;
      var state = done === items.length ? 'done' : items.some(function (x) { return x.status === 'now'; }) ? 'now' : (done ? 'now' : 'todo');
      return { phase: ph, items: items, done: done, state: state };
    });
  };
  P.fraction = function () {
    var steps = P.deck.length - 1, cur = Math.min(S.i, steps);
    var answeredNow = S.cs && S.cs.done ? 1 : 0;
    return Math.max(0, Math.min(1, (cur + answeredNow) / steps));
  };
  P.time = function () {
    var m = Math.floor(S.secs / 60), s = S.secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  P.timeFrac = function () { return S.secs / S.total; };

  /* ── workspace kinds ───────────────────────────────────────────────
     The eight answer areas every type maps to (see the gallery's table):
       choice  - mcq, scenario, passage, corroborate, highlight, readtable, badgraph
       binary  - truefalse
       typed   - fill, bigequation, dictation, estimate, wordproblem steps
       slots   - recall, filltable, tracetable
       sort    - classify (incl. then-and-now)
       order   - sequence, parsons, sentence (word bank)
       voices  - whosright
       staged  - twopart, readchart (Part A, then Part B)
       long    - write, claim, selfcheck
     (match/matchpairs/labeldiagram are 'pairs' - rows with a menu each.)  */
  function optsHtml(list, cs, group, opt) {
    opt = opt || {};
    var short = list.every(function (t) { return t.length <= 22; }) && list.length === 4;
    var picked = group === 'b' ? cs.pickB : cs.pick;
    return '<div class="opts' + (short ? ' grid2' : '') + (opt.tf ? ' tf' : '') + '" role="radiogroup" aria-label="Answers" data-group="' + (group || 'a') + '">' +
      list.map(function (t, k) {
        return '<button type="button" class="opt' + (picked === k ? ' is-picked' : '') + '" role="radio" aria-checked="' + (picked === k) + '" data-act="pick" data-group="' + (group || 'a') + '" data-v="' + k + '">' +
          '<span class="opt-key" aria-hidden="true">' + (opt.tf ? (k ? 'F' : 'T') : LETTERS[k]) + '</span>' +
          '<span class="opt-text">' + esc(t) + '</span><span class="opt-mark" aria-hidden="true"></span></button>';
      }).join('') + '</div>';
  }
  function markOpts(root, group, correct, picked) {
    root.querySelectorAll('.opt[data-group="' + group + '"]').forEach(function (b) {
      var k = +b.dataset.v;
      b.disabled = true;
      b.classList.remove('is-picked');
      if (k === picked) b.classList.add('is-mine');   /* what the learner chose, kept after marking */
      if (k === correct) b.classList.add('is-right');
      else if (k === picked) b.classList.add('is-wrong');
      else b.classList.add('is-dim');
    });
  }

  function chartSvg(ch, cs, stage) {
    var W = 340, H = 196, L = 34, B = 162, T = 18, max = 140, n = ch.rows.length;
    var bw = (W - L - 12) / n, out = [];
    out.push('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(ch.title) + ' bar chart">');
    [0, 50, 100].forEach(function (v) {
      var y = B - (v / max) * (B - T);
      out.push('<line class="ch-grid" x1="' + L + '" x2="' + (W - 6) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="ch-tick" x="' + (L - 7) + '" y="' + (y + 4) + '" text-anchor="end">' + v + '</text>');
    });
    ch.rows.forEach(function (r, k) {
      var h = (r[1] / max) * (B - T), x = L + k * bw + bw * 0.16, w = bw * 0.68, y = B - h;
      var cls = 'bar' + (cs.bar === k ? ' is-picked' : '');
      if (cs.stage > 0) cls += (k === ch.__correct ? ' is-right' : (cs.bar === k ? ' is-wrong' : ' is-dim'));
      out.push('<g class="' + cls + '" data-act="bar" data-v="' + k + '" role="button" tabindex="' + (stage ? -1 : 0) + '" aria-label="' + esc(r[0]) + '">' +
        '<rect class="bar-hit" x="' + (L + k * bw) + '" y="' + T + '" width="' + bw + '" height="' + (B - T + 30) + '"/>' +
        '<rect class="bar-fill" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5"/>' +
        '<text class="ch-val" x="' + (x + w / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + r[1] + '</text>' +
        '<text class="ch-lab" x="' + (x + w / 2) + '" y="' + (B + 17) + '" text-anchor="middle">' + esc(r[0]) + '</text></g>');
    });
    out.push('<line class="ch-axis" x1="' + L + '" x2="' + (W - 6) + '" y1="' + B + '" y2="' + B + '"/></svg>');
    return out.join('');
  }

  var T = P.types = {};

  T.mcq = {
    kind: 'choice',
    work: function (c, cs) { return optsHtml(c.options, cs, 'a'); },
    ready: function (c, cs) { return cs.pick != null; },
    grade: function (c, cs, root) {
      markOpts(root, 'a', c.correct, cs.pick);
      return { ok: cs.pick === c.correct, mine: c.options[cs.pick], answer: c.options[c.correct] };
    },
    auto: function (c, cs, ok) { cs.pick = ok ? c.correct : (c.correct + 1) % c.options.length; }
  };
  T.tf = {
    kind: 'binary',
    work: function (c, cs) { return optsHtml(c.options, cs, 'a', { tf: true }); },
    ready: T.mcq.ready, grade: T.mcq.grade, auto: T.mcq.auto
  };
  T.who = {
    kind: 'voices',
    work: function (c, cs) {
      return '<div class="voices" role="radiogroup" aria-label="Classmates">' + c.claims.map(function (cl, k) {
        return '<button type="button" class="voice opt' + (cs.pick === k ? ' is-picked' : '') + '" role="radio" aria-checked="' + (cs.pick === k) + '" data-act="pick" data-group="a" data-v="' + k + '">' +
          '<span class="voice-av" aria-hidden="true">' + esc(cl.name[0]) + '</span>' +
          '<span class="voice-bub"><span class="voice-name">' + esc(cl.name) + '</span>' +
          '<span class="voice-says">' + esc(cl.says) + '</span>' +
          '<span class="voice-why">' + esc(cl.why) + '</span></span><span class="opt-mark" aria-hidden="true"></span></button>';
      }).join('') + '</div>';
    },
    ready: T.mcq.ready,
    grade: function (c, cs, root) {
      markOpts(root, 'a', c.correct, cs.pick);
      root.querySelector('.voices').classList.add('is-revealed');
      return { ok: cs.pick === c.correct, mine: c.claims[cs.pick].name, answer: c.claims[c.correct].name };
    },
    auto: function (c, cs, ok) { cs.pick = ok ? c.correct : 0; }
  };
  T.fill = {
    kind: 'typed',
    stem: function (c) { return esc(c.stem).replace('___', '<span class="blank" aria-label="blank"></span>'); },
    work: function (c, cs) {
      return '<label class="field"><span class="sr">Your answer</span>' +
        '<input class="inp" data-input="a" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the missing word" value="' + esc(cs.a || '') + '"></label>';
    },
    ready: function (c, cs) { return !!(cs.a && cs.a.trim()); },
    grade: function (c, cs, root) {
      var ok = c.accept.some(function (x) { return norm(x) === norm(cs.a); });
      var inp = root.querySelector('.inp'); inp.readOnly = true; inp.classList.add(ok ? 'is-right' : 'is-wrong');
      return { ok: ok, mine: cs.a, answer: c.answer };
    },
    auto: function (c, cs, ok) { cs.a = ok ? c.answer : 'arteries'; }
  };
  T.eq = {
    kind: 'typed',
    stim: function (c) { return '<div class="mx"><div class="mx-expr">' + esc(c.expr).replace(/x/g, '<i>x</i>') + '</div></div>'; },
    work: function (c, cs) {
      return '<label class="field has-prefix"><span class="field-prefix"><i>x</i> =</span><span class="sr">x equals</span>' +
        '<input class="inp" data-input="a" inputmode="decimal" autocomplete="off" placeholder="Your answer" value="' + esc(cs.a || '') + '"></label>';
    },
    ready: T.fill.ready,
    grade: function (c, cs, root) {
      var v = norm(cs.a).replace(/\s/g, ''); var ok = c.accept.indexOf(v) >= 0;
      var inp = root.querySelector('.inp'); inp.readOnly = true; inp.classList.add(ok ? 'is-right' : 'is-wrong');
      return { ok: ok, mine: 'x = ' + cs.a, answer: 'x = ' + c.answer };
    },
    auto: function (c, cs, ok) { cs.a = ok ? '5' : '7'; }
  };
  T.seq = {
    kind: 'order',
    work: function (c, cs) {
      var placed = cs.order || [], n = c.items.length, h = [];
      h.push('<div class="order"><ol class="ord-line" aria-label="Your order">');
      for (var k = 0; k < n; k++) {
        var it = placed[k];
        if (it == null) h.push('<li class="ord-slot' + (k === placed.length ? ' is-next' : '') + '"><span class="ord-n">' + (k + 1) + '</span><span class="ord-empty">' + (k === placed.length ? 'Tap the next step' : '') + '</span></li>');
        else {
          var st = cs.marks ? (cs.marks[k] ? ' is-right' : ' is-wrong') : '';
          h.push('<li class="ord-slot is-filled"><button type="button" class="ord-item is-placed' + st + '" data-act="ord" data-v="' + it + '"' + (cs.marks ? ' disabled' : '') + '>' +
            '<span class="ord-n">' + (k + 1) + '</span><span class="ord-text">' + esc(c.items[it]) + '</span><span class="opt-mark" aria-hidden="true"></span></button></li>');
        }
      }
      h.push('</ol><div class="ord-bank" aria-label="Steps left">');
      c.show.forEach(function (it) {
        if (placed.indexOf(it) < 0) h.push('<button type="button" class="ord-item" data-act="ord" data-v="' + it + '"><span class="ord-text">' + esc(c.items[it]) + '</span></button>');
      });
      h.push('</div></div>');
      return h.join('');
    },
    sub: 'Tap the steps in order. Tap one again to take it back.',
    ready: function (c, cs) { return (cs.order || []).length === c.items.length; },
    grade: function (c, cs) {
      cs.marks = cs.order.map(function (it, k) { return it === k; });
      return { ok: cs.marks.every(Boolean), mine: cs.order.map(function (k) { return c.items[k]; }).join(' → '), answer: c.items.join(' → '), rerender: true };
    },
    auto: function (c, cs, ok) { cs.order = ok ? c.items.map(function (_, k) { return k; }) : [0, 2, 1, 3, 4]; }
  };
  T.sort = {
    kind: 'sort',
    work: function (c, cs) {
      var place = cs.place || {}, h = [];
      var chip = function (k) {
        var st = cs.marks ? (cs.marks[k] ? ' is-right' : ' is-wrong') : '';
        return '<button type="button" class="chip' + (cs.sel === k ? ' is-sel' : '') + st + '" data-act="chip" data-v="' + k + '"' + (cs.marks ? ' disabled' : '') + '>' + esc(c.items[k][0]) + '</button>';
      };
      var bank = c.items.map(function (_, k) { return k; }).filter(function (k) { return place[k] == null; });
      h.push('<div class="sort"><div class="bank" aria-label="Facts to sort">' + (bank.length ? bank.map(chip).join('') : '<span class="bank-done">All sorted</span>') + '</div><div class="bins">');
      c.groups.forEach(function (g, gi) {
        var inBin = c.items.map(function (_, k) { return k; }).filter(function (k) { return place[k] === gi; });
        h.push('<div class="bin' + (cs.sel != null ? ' is-ready' : '') + '" data-act="bin" data-v="' + gi + '" role="button" tabindex="0" aria-label="Put in ' + esc(g) + '">' +
          '<div class="bin-head">' + esc(g) + '<span class="bin-n">' + inBin.length + '</span></div><div class="bin-body">' + inBin.map(chip).join('') + '</div></div>');
      });
      h.push('</div></div>');
      return h.join('');
    },
    sub: 'Tap a fact, then the group it belongs to.',
    ready: function (c, cs) { return Object.keys(cs.place || {}).length === c.items.length; },
    grade: function (c, cs) {
      cs.marks = c.items.map(function (it, k) { return cs.place[k] === it[1]; });
      var wrong = c.items.filter(function (it, k) { return !cs.marks[k]; }).map(function (it) { return it[0] + ' → ' + c.groups[it[1]]; });
      return { ok: cs.marks.every(Boolean), mine: '', answer: wrong.join('; '), rerender: true };
    },
    auto: function (c, cs, ok) { cs.place = {}; c.items.forEach(function (it, k) { cs.place[k] = ok || k > 1 ? it[1] : 1 - it[1]; }); cs.sel = null; }
  };
  T.recall = {
    kind: 'slots',
    work: function (c, cs) {
      var vals = cs.slots || [];
      return '<ol class="slots">' + c.items.map(function (_, k) {
        var st = cs.marks ? (cs.marks[k] ? ' is-right' : ' is-wrong') : '';
        return '<li class="slot' + st + '"><span class="slot-n">' + (k + 1) + '</span><input class="inp slot-in" data-input="slot" data-v="' + k + '" autocomplete="off" spellcheck="false" aria-label="Chamber ' + (k + 1) + '" value="' + esc(vals[k] || '') + '"' + (cs.marks ? ' readonly' : '') + '><span class="opt-mark" aria-hidden="true"></span></li>';
      }).join('') + '</ol>';
    },
    sub: 'Any order. Enter moves to the next box.',
    ready: function (c, cs) { return (cs.slots || []).some(function (v) { return v && v.trim(); }); },
    grade: function (c, cs) {
      var left = c.items.map(norm), vals = (cs.slots || []);
      cs.marks = c.items.map(function (_, k) {
        var v = norm(vals[k]); var at = left.indexOf(v);
        if (v && at >= 0) { left[at] = null; return true; } return false;
      });
      var missing = c.items.filter(function (it) { return left.indexOf(norm(it)) >= 0; });
      return { ok: cs.marks.every(Boolean), mine: vals.filter(Boolean).join(', '), answer: missing.length ? 'You missed: ' + missing.join(', ') : '', rerender: true, answerIsNote: true };
    },
    auto: function (c, cs, ok) { cs.slots = ok ? c.items.slice() : ['Right atrium', 'Left ventricle', 'Aorta', '']; }
  };
  T.two = {
    kind: 'staged',
    work: function (c, cs) {
      return '<div class="part" data-part="a"><div class="part-head"><span class="part-tag">Part A</span></div>' + optsHtml(c.options, cs, 'a') + '</div>' +
        '<div class="part" data-part="b"' + (cs.stage ? '' : ' hidden') + '><div class="part-head"><span class="part-tag">Part B</span><span class="part-q">' + esc(c.reasonStem) + '</span></div>' + optsHtml(c.reasons, cs, 'b') + '</div>';
    },
    ready: function (c, cs) { return cs.stage ? cs.pickB != null : cs.pick != null; },
    stage: function (c, cs, root) {
      if (cs.stage) return false;
      markOpts(root, 'a', c.correct, cs.pick);
      cs.stage = 1; cs.okA = cs.pick === c.correct;
      var b = root.querySelector('[data-part="b"]'); b.hidden = false; b.classList.add('is-arriving');
      return true;
    },
    grade: function (c, cs, root) {
      markOpts(root, 'b', c.reasonCorrect, cs.pickB);
      return { ok: cs.okA && cs.pickB === c.reasonCorrect, mine: c.options[cs.pick] + ', because ' + c.reasons[cs.pickB].toLowerCase(), answer: c.options[c.correct] + ', because ' + c.reasons[c.reasonCorrect].toLowerCase() };
    },
    auto: function (c, cs, ok, phase) { if (!phase) cs.pick = ok ? c.correct : 1; else cs.pickB = ok ? c.reasonCorrect : 1; }
  };
  T.chart = {
    kind: 'staged',
    stim: function (c, cs) {
      c.chart.__correct = c.correctBar;
      return '<figure class="chart-fig paper' + (cs.stage ? ' show-values' : '') + '"><figcaption class="chart-cap">' + esc(c.chart.title) + ' <span>' + esc(c.chart.unit) + '</span></figcaption>' +
        chartSvg(c.chart, cs, cs.stage) + (c.chart.example ? '<p class="chart-note">Example data, not taken from your notes</p>' : '') + '</figure>';
    },
    work: function (c, cs) {
      return '<div class="part" data-part="b"' + (cs.stage ? '' : ' hidden') + '><div class="part-head"><span class="part-tag">Part B</span><span class="part-q">' + esc(c.reasonStem) + '</span></div>' + optsHtml(c.reasons, cs, 'b') + '</div>';
    },
    sub: 'Part A. Tap a bar.',
    ready: function (c, cs) { return cs.stage ? cs.pickB != null : cs.bar != null; },
    stage: function (c, cs, root) {
      if (cs.stage) return false;
      cs.stage = 1; cs.okA = cs.bar === c.correctBar;
      root.querySelector('[data-slot="stim"]').innerHTML = T.chart.stim(c, cs);
      var b = root.querySelector('[data-part="b"]'); b.hidden = false; b.classList.add('is-arriving');
      return true;
    },
    grade: function (c, cs, root) {
      markOpts(root, 'b', c.reasonCorrect, cs.pickB);
      return { ok: cs.okA && cs.pickB === c.reasonCorrect, mine: c.chart.rows[cs.bar][0], answer: c.chart.rows[c.correctBar][0] + ', and ' + c.reasons[c.reasonCorrect].toLowerCase() };
    },
    auto: function (c, cs, ok, phase) { if (!phase) cs.bar = ok ? c.correctBar : 3; else cs.pickB = ok ? c.reasonCorrect : 2; }
  };
  T.write = {
    kind: 'long',
    work: function (c, cs) {
      var words = (cs.a || '').trim().split(/\s+/).filter(Boolean).length;
      return '<label class="field long"><span class="sr">Your explanation</span><textarea class="inp long-in" data-input="a" rows="5" placeholder="Explain it as if to a friend who missed the lesson">' + esc(cs.a || '') + '</textarea></label>' +
        '<div class="long-meta"><span data-bind-local="wc">' + words + ' words</span><span>Not scored</span></div>';
    },
    ready: function (c, cs) { return (cs.a || '').trim().split(/\s+/).filter(Boolean).length >= 5; },
    grade: function (c, cs, root) {
      var ta = root.querySelector('.long-in'); if (ta) ta.readOnly = true;
      var t = norm(cs.a);
      var hits = c.points.map(function (p) {
        var w = norm(p).split(' ').filter(function (x) { return x.length > 4; });
        return w.some(function (x) { return t.indexOf(x) >= 0; });
      });
      return { ok: null, saved: true, points: c.points, hits: hits };
    },
    auto: function (c, cs) { cs.a = 'A capillary wall is only one cell thick, so oxygen can pass through it quickly into the cells around it.'; }
  };

  /* ── parts: what a direction receives ────────────────────────────── */
  function partsFor(c, cs) {
    var t = T[c.type] || {};
    var qn = P.questionNumber(S.i);
    return {
      kicker: c.kind === 'q' ? (c.phase === 'Practice' ? 'Question ' + qn.n + ' of ' + qn.total : c.label) : c.label,
      num: qn,
      type: c.label, typeKind: t.kind || c.kind, level: c.level, tag: c.tag || null,
      icon: ({ mcq: 'list', tf: 'split', fill: 'type', seq: 'order', sort: 'grid', who: 'users', two: 'two', chart: 'chart', recall: 'list', eq: 'sigma', write: 'pen' })[c.type] || (c.kind === 'lesson' ? 'book' : c.kind === 'deck' ? 'cards' : 'trophy'),
      stem: c.kind === 'q' ? (t.stem ? t.stem(c) : esc(c.stem)) : esc(c.title || ''),
      longStem: (c.stem || '').length > 110,
      sub: t.sub || '',
      stim: t.stim ? t.stim(c, cs) : '',
      work: c.kind === 'q' ? t.work(c, cs) : c.kind === 'lesson' ? lessonWork(c, cs) : c.kind === 'deck' ? deckWork(c, cs) : resultsWork(),
      hint: c.hint || '',
      conf: !!c.conf,
      scored: c.scored !== false,
      primary: primaryFor(c, cs)
    };
  }
  P.partsFor = partsFor;

  function primaryFor(c, cs) {
    if (c.kind === 'lesson') {
      var last = cs.part >= c.parts.length - 1;
      return { act: last ? 'next' : 'lp-next', label: last ? 'Got it' : c.parts[cs.part + 1].name, disabled: false, arrow: true };
    }
    if (c.kind === 'deck') return { act: 'next', label: 'Start practising', disabled: false, arrow: true };
    if (c.kind === 'results') return { act: 'restart', label: 'Back to dashboard', disabled: false, arrow: false };
    if (cs.done) return { act: 'next', label: S.i === P.deck.length - 2 ? 'See results' : 'Continue', disabled: false, arrow: true };
    var t = T[c.type];
    return { act: 'check', label: c.type === 'write' ? 'Done' : (cs.stage ? 'Check Part B' : (t.kind === 'staged' ? 'Check Part A' : 'Check')), disabled: !t.ready(c, cs), arrow: false };
  }

  function lessonWork(c, cs) {
    var p = cs.part;
    return '<div class="lp">' +
      '<div class="lp-rail" role="tablist" aria-label="Lesson parts">' + c.parts.map(function (pt, k) {
        return '<button type="button" class="lp-seg' + (k < p ? ' is-done' : '') + (k === p ? ' is-at' : '') + '" role="tab" aria-selected="' + (k === p) + '" data-act="lp-go" data-v="' + k + '"><span class="lp-seg-bar"></span><span class="lp-seg-name">' + esc(pt.name) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="lp-pane" data-part="' + p + '">' + c.parts[p].html + '</div></div>';
  }
  function deckWork(c, cs) {
    var k = cs.fc, it = c.cards[k];
    return '<div class="fc-deck"><div class="fc-stage"><button type="button" class="fc' + (it.trap ? ' is-trap' : '') + (cs.flip ? ' is-flipped' : '') + '" data-act="flip" aria-label="Turn the card">' +
      '<span class="fc-face fc-front"><span class="fc-kind">' + esc(it.kind) + '</span><span class="fc-term">' + esc(it.front) + '</span><span class="fc-tap">Tap to turn</span></span>' +
      '<span class="fc-face fc-back"><span class="fc-kind">' + (it.trap ? 'Actually' : 'Means') + '</span><span class="fc-def">' + esc(it.back) + '</span></span></button></div>' +
      '<div class="fc-nav"><button type="button" class="fc-arrow" data-act="fc-prev" aria-label="Previous card"' + (k ? '' : ' disabled') + '>' + icon('chevL') + '</button>' +
      '<span class="fc-pips">' + c.cards.map(function (_, j) { return '<span class="fc-pip' + (j === k ? ' is-now' : j < k ? ' is-done' : '') + '"></span>'; }).join('') + '</span>' +
      '<span class="fc-count">' + (k + 1) + ' of ' + c.cards.length + '</span>' +
      '<button type="button" class="fc-arrow" data-act="fc-next" aria-label="Next card"' + (k < c.cards.length - 1 ? '' : ' disabled') + '>' + icon('chevR') + '</button></div></div>';
  }
  function resultsWork() {
    var tot = S.answered || 1, pct = Math.round(100 * S.right / tot);
    var C = 2 * Math.PI * 52, off = C * (1 - pct / 100);
    var mins = Math.max(1, Math.round((S.total - S.secs) / 60));
    var miss = S.misses.length ? S.misses.map(function (m) {
      return '<li class="miss"><p class="miss-q">' + esc(m.stem) + '</p>' +
        (m.mine ? '<p class="miss-mine"><span>You said</span>' + esc(m.mine) + '</p>' : '') +
        (m.answer ? '<p class="miss-right"><span>Answer</span>' + esc(m.answer) + '</p>' : '') + '</li>';
    }).join('') : '<li class="miss is-none">Nothing to restudy. Every answer was right.</li>';
    return '<div class="res">' +
      '<div class="res-top"><div class="res-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-fill" cx="60" cy="60" r="52" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><span class="res-pct">' + pct + '<small>%</small></span></div>' +
      '<div class="res-words"><p class="res-line">' + S.right + ' of ' + S.answered + ' right on the first try</p><p class="res-sub">The ones you missed come back tomorrow, before the new lesson.</p></div></div>' +
      '<div class="res-stats"><div class="res-stat"><b>' + S.answered + '</b><span>Answered</span></div><div class="res-stat"><b>' + mins + 'm</b><span>Studied</span></div><div class="res-stat"><b>' + (S.bestStreak || 0) + '</b><span>Best streak</span></div></div>' +
      '<h3 class="res-h">What to study more</h3><ul class="misses">' + miss + '</ul></div>';
  }

  /* ── feedback model ──────────────────────────────────────────────── */
  function feedbackFor(c, g) {
    if (g.saved) {
      return { verdict: 'saved', title: 'Saved. Check it against this.',
        points: g.points, hits: g.hits,
        why: 'A strong answer says all three. Tick off the ones you said.' };
    }
    return {
      verdict: g.ok ? 'right' : 'wrong',
      title: g.ok ? pick(['Right.', 'That’s it.', 'Yes, exactly.']) : 'Not quite.',
      answer: g.ok ? '' : g.answer, answerIsNote: !!g.answerIsNote,
      mine: g.mine, why: c.why
    };
  }
  var pickN = 0;
  function pick(a) { return a[(pickN++) % a.length]; }

  P.feedbackHtml = function (fb, opt) {
    opt = opt || {};
    var h = '<div class="fb" data-verdict="' + fb.verdict + '" role="status">';
    h += '<div class="fb-head"><span class="fb-ico" aria-hidden="true">' + icon(fb.verdict === 'wrong' ? 'cross' : 'check') + '</span><p class="fb-title">' + esc(fb.title) + '</p></div>';
    if (fb.verdict === 'saved') {
      h += '<ul class="fb-points">' + fb.points.map(function (p, k) {
        return '<li class="' + (fb.hits[k] ? 'is-hit' : '') + '">' + icon(fb.hits[k] ? 'check' : 'chevR') + '<span>' + esc(p) + '</span></li>';
      }).join('') + '</ul>';
    } else {
      if (fb.answer) h += '<p class="fb-answer">' + (fb.answerIsNote ? '' : '<span>The answer</span>') + esc(fb.answer) + '</p>';
      if (fb.why) h += '<p class="fb-why">' + esc(fb.why) + '</p>';
    }
    if (!opt.noLinks) {
      h += '<div class="fb-links">' +
        (fb.verdict !== 'saved' ? '<button type="button" class="fb-link" data-act="walk">' + icon('play') + 'Walk me through it</button>' : '') +
        '<button type="button" class="fb-link" data-act="tutor">' + icon('chat') + 'Ask the tutor</button></div>';
    }
    return h + '</div>';
  };

  P.confHtml = function (cs) {
    return '<div class="conf" role="group" aria-label="How sure are you?"><span class="conf-l">How sure?</span>' +
      '<button type="button" class="conf-b' + (cs.conf === 'sure' ? ' is-on' : '') + '" data-act="conf" data-v="sure" aria-pressed="' + (cs.conf === 'sure') + '">Sure</button>' +
      '<button type="button" class="conf-b' + (cs.conf === 'unsure' ? ' is-on' : '') + '" data-act="conf" data-v="unsure" aria-pressed="' + (cs.conf === 'unsure') + '">Not sure</button></div>';
  };
  P.levelHtml = function (level) {
    if (!level) return '';
    var n = level === 'hard' ? 3 : level === 'medium' ? 2 : 1;
    return '<span class="lvl" data-n="' + n + '" title="' + esc(level) + '"><span class="lvl-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="lvl-t">' + esc(level.charAt(0).toUpperCase() + level.slice(1)) + '</span></span>';
  };
  P.primaryHtml = function (p, cls) {
    return '<button type="button" class="c-primary ' + (cls || '') + '" data-act="' + p.act + '"' + (p.disabled ? ' disabled' : '') + '><span class="lbl">' + esc(p.label) + '</span>' +
      '<span class="c-primary-arrow"' + (p.arrow ? '' : ' hidden') + '>' + icon('right') + '</span></button>';
  };

  /* ── mounting and flow ───────────────────────────────────────────── */
  var root, dir, ctx;

  function freshState(c) { return { pick: null, pickB: null, part: 0, fc: 0, flip: false, stage: 0, done: false }; }

  function render(i, opts) {
    opts = opts || {};
    S.i = i; var c = P.deck[i];
    S.cs = freshState(c);
    var slot = root.querySelector('[data-slot="card"]');
    var parts = partsFor(c, S.cs);
    var html = dir.card(c, parts, ctx);
    var old = slot.firstElementChild;
    var mount = function () {
      slot.innerHTML = html;
      var el = slot.firstElementChild;
      if (el) {
        el.classList.add('c-card');
        el.dataset.kind = c.kind; if (c.type) el.dataset.type = c.type;
        if (!opts.instant && !reduced) { el.classList.add('is-entering'); setTimeout(function () { el.classList.remove('is-entering'); }, 700); }
      }
      if (dir.clearFeedback) dir.clearFeedback(root, ctx);
      syncPrimary();
      update();
      if (dir.mounted) dir.mounted(el, ctx);
      if (!opts.instant) { var sc = root.querySelector('[data-scroll]') || document.scrollingElement; if (sc) sc.scrollTop = 0; }
      S.busy = false;
      try { parent.postMessage({ type: 'sfp-card', i: i, dir: P.dirId }, '*'); } catch (e) {}
    };
    if (old && !opts.instant && !reduced) {
      S.busy = true;
      old.classList.add('is-leaving');
      setTimeout(mount, 170);            /* a timer, never animationend: a hidden tab runs no frames */
    } else mount();
  }
  P.go = function (i, opts) { render(Math.max(0, Math.min(P.deck.length - 1, i)), opts); };

  function rerenderWork() {
    var c = P.card(), w = root.querySelector('[data-slot="work"]');
    if (w) w.innerHTML = c.kind === 'q' ? T[c.type].work(c, S.cs) : partsFor(c, S.cs).work;
    syncPrimary();
  }

  function syncPrimary() {
    var c = P.card(); if (!c) return;
    var p = primaryFor(c, S.cs);
    root.querySelectorAll('.c-primary').forEach(function (b) {
      b.dataset.act = p.act; b.disabled = !!p.disabled;
      var l = b.querySelector('.lbl'); if (l) l.textContent = p.label;
      var a = b.querySelector('.c-primary-arrow'); if (a) a.hidden = !p.arrow;
      b.classList.toggle('is-continue', p.act === 'next' && c.kind === 'q');
      b.dataset.verdict = S.cs.done ? (S.cs.verdict || '') : '';
    });
    root.dataset.answered = S.cs.done ? '1' : '';
  }

  function update() {
    var c = P.card(); var qn = P.questionNumber(S.i);
    root.querySelectorAll('[data-bind="time"]').forEach(function (e) { e.textContent = P.time(); });
    root.querySelectorAll('[data-bind="mins"]').forEach(function (e) { e.textContent = Math.ceil(S.secs / 60) + ' min'; });
    root.querySelectorAll('[data-bind="score"]').forEach(function (e) { e.textContent = S.right + '/' + S.answered; });
    root.querySelectorAll('[data-bind="streak"]').forEach(function (e) { e.textContent = S.streak; });
    root.querySelectorAll('[data-bind="phase"]').forEach(function (e) { e.textContent = c.phase; });
    root.querySelectorAll('[data-bind="qnum"]').forEach(function (e) { e.textContent = c.phase === 'Practice' ? qn.n + ' of ' + qn.total : c.phase; });
    root.style.setProperty('--frac', P.fraction().toFixed(4));
    root.style.setProperty('--time-frac', P.timeFrac().toFixed(4));
    root.dataset.streak = S.streak >= 2 ? '1' : '';
    if (dir.update) dir.update(ctx);
  }
  P.update = update;

  function check(auto) {
    var c = P.card(), cs = S.cs, t = T[c.type];
    if (!t || cs.done || !t.ready(c, cs)) return;
    if (t.stage && t.stage(c, cs, root)) { syncPrimary(); update(); if (!auto) focusFirst('[data-part="b"] .opt'); return; }
    var g = t.grade(c, cs, root);
    cs.done = true;
    if (g.rerender) rerenderWork();
    var fb = feedbackFor(c, g);
    cs.verdict = fb.verdict;
    if (g.ok !== null && c.scored !== false) {
      S.answered++;
      if (g.ok) { S.right++; S.streak++; S.bestStreak = Math.max(S.bestStreak || 0, S.streak); }
      else { S.streak = 0; S.misses.push({ stem: c.stem.replace('___', '____'), mine: g.mine, answer: g.answer }); }
    }
    S.status[S.i] = g.ok === null ? 'done' : (g.ok ? 'right' : 'wrong');
    var cardEl = root.querySelector('.c-card');
    if (cardEl) { cardEl.dataset.verdict = fb.verdict; }
    if (dir.showFeedback) dir.showFeedback(root, fb, ctx);
    else {
      var slot = root.querySelector('[data-slot="feedback"]');
      if (slot) {
        slot.innerHTML = P.feedbackHtml(fb); slot.hidden = false;
        /* The verdict must be seen: bring it into view (directions set a
           scroll-margin so a sticky footer does not cover it). */
        if (!auto) setTimeout(function () { slot.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }, 60);
      }
    }
    syncPrimary(); update();
    if (!auto) { var nb = root.querySelector('.c-primary:not([disabled])'); if (nb) nb.focus({ preventScroll: true }); }
  }
  function next() {
    if (S.busy) return;
    if (S.i < P.deck.length - 1) render(S.i + 1);
  }
  P.check = check; P.next = next;

  function focusFirst(sel) { var e = root.querySelector(sel); if (e) e.focus({ preventScroll: true }); }

  function paintPicked(group, k) {
    root.querySelectorAll('.opt[data-group="' + group + '"]').forEach(function (b) {
      var on = +b.dataset.v === k; b.classList.toggle('is-picked', on); b.setAttribute('aria-checked', on);
    });
  }
  /* Answers the card on its own, right or wrong - the gallery uses it to put
     the three directions' feedback side by side. */
  P.autoAnswer = function (ok) {
    var c = P.card(); if (!P.isQuestion(c) || S.cs.done) return;
    var t = T[c.type];
    t.auto(c, S.cs, ok, 0);
    if (c.type === 'chart') { root.querySelector('[data-slot="stim"]').innerHTML = T.chart.stim(c, S.cs); syncPrimary(); }
    else rerenderWork();
    if (c.conf && !S.cs.stage) { S.cs.conf = ok ? 'sure' : 'unsure'; showConf(); }
    check(true);
    if (t.kind === 'staged' && !S.cs.done) { t.auto(c, S.cs, ok, 1); paintPicked('b', S.cs.pickB); syncPrimary(); check(true); }
  };

  P.toast = function (text) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  };

  function setTheme(th) {
    document.documentElement.dataset.theme = th;
    root.querySelectorAll('[data-act="theme"]').forEach(function (b) { b.setAttribute('aria-pressed', th === 'dark'); });
  }

  /* ── events ──────────────────────────────────────────────────────── */
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.disabled) {
      if (!e.target.closest('.menu')) closeMenus();
      return;
    }
    var act = el.dataset.act, v = el.dataset.v, c = P.card(), cs = S.cs;
    if (act !== 'menu') closeMenus();
    switch (act) {
      case 'pick':
        if (cs.done) return;
        if (el.dataset.group === 'b') cs.pickB = +v; else { if (cs.stage) return; cs.pick = +v; }
        el.parentNode.querySelectorAll('.opt').forEach(function (b) {
          var on = b === el; b.classList.toggle('is-picked', on); b.setAttribute('aria-checked', on);
        });
        if (c.conf && !cs.stage) showConf();
        syncPrimary(); break;
      case 'conf':
        cs.conf = v; root.querySelectorAll('.conf-b').forEach(function (b) { var on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); }); break;
      case 'check': check(); break;
      case 'next': next(); break;
      case 'ord':
        if (cs.done) return;
        cs.order = cs.order || [];
        var at = cs.order.indexOf(+v);
        if (at >= 0) cs.order.splice(at, 1); else cs.order.push(+v);
        rerenderWork(); break;
      case 'chip':
        if (cs.done) return;
        cs.place = cs.place || {};
        if (cs.place[+v] != null) { delete cs.place[+v]; cs.sel = null; }
        else cs.sel = cs.sel === +v ? null : +v;
        rerenderWork(); break;
      case 'bin':
        if (cs.done || cs.sel == null) return;
        cs.place = cs.place || {}; cs.place[cs.sel] = +v; cs.sel = null;
        rerenderWork(); break;
      case 'bar':
        if (cs.done || cs.stage) return;
        cs.bar = +v; root.querySelector('[data-slot="stim"]').innerHTML = T.chart.stim(c, cs); syncPrimary(); break;
      case 'hint':
        var hs = root.querySelector('[data-slot="hint"]');
        if (hs) {
          var open = !hs.hidden && hs.innerHTML;
          hs.innerHTML = open ? '' : '<div class="hint-box">' + icon('bulb') + '<span>' + esc(c.hint) + '</span></div>';
          hs.hidden = !!open;
          el.setAttribute('aria-expanded', !open);
          el.classList.toggle('is-on', !open);
        }
        break;
      case 'flag':
        var on = !el.classList.contains('is-on'); el.classList.toggle('is-on', on); el.setAttribute('aria-pressed', on);
        P.toast(on ? 'Flagged. Your teacher will see it.' : 'Flag removed'); break;
      case 'lp-next': cs.part = Math.min(c.parts.length - 1, cs.part + 1); rerenderWork(); break;
      case 'lp-prev': cs.part = Math.max(0, cs.part - 1); rerenderWork(); break;
      case 'lp-go': cs.part = +v; rerenderWork(); break;
      case 'flip':
        cs.flip = !cs.flip; el.classList.toggle('is-flipped', cs.flip); break;
      case 'fc-next': cs.fc = Math.min(c.cards.length - 1, cs.fc + 1); cs.flip = false; rerenderWork(); break;
      case 'fc-prev': cs.fc = Math.max(0, cs.fc - 1); cs.flip = false; rerenderWork(); break;
      case 'theme': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); break;
      case 'menu':
        var m = el.closest('.menu'); var was = m.classList.contains('is-open'); closeMenus();
        if (!was) { m.classList.add('is-open'); el.setAttribute('aria-expanded', 'true'); } break;
      case 'exit': P.toast('Goes back to your dashboard'); break;
      case 'end': P.go(P.deck.length - 1); break;
      case 'walk': P.toast('Opens the step-by-step walkthrough for this question'); break;
      case 'tutor': P.toast('Opens the study tutor (VIP)'); break;
      case 'restart':
        S.right = S.answered = S.streak = 0; S.status = {}; S.misses = []; S.secs = 24 * 60 + 10; P.go(0); break;
      case 'jump': P.go(+v); break;
      default: if (dir.onAct) dir.onAct(act, el, ctx);
    }
  }
  function closeMenus() {
    root.querySelectorAll('.menu.is-open').forEach(function (m) {
      m.classList.remove('is-open'); var b = m.querySelector('[data-act="menu"]'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function showConf() {
    var s = root.querySelector('[data-slot="conf"]');
    if (s && !s.innerHTML) { s.innerHTML = P.confHtml(S.cs); s.hidden = false; }
  }
  function onInput(e) {
    var el = e.target, cs = S.cs;
    if (!el.dataset || !el.dataset.input || cs.done) return;
    if (el.dataset.input === 'slot') { cs.slots = cs.slots || []; cs.slots[+el.dataset.v] = el.value; }
    else cs.a = el.value;
    var wc = root.querySelector('[data-bind-local="wc"]');
    if (wc) wc.textContent = (cs.a || '').trim().split(/\s+/).filter(Boolean).length + ' words';
    syncPrimary();
  }
  function onKey(e) {
    if (e.metaKey && e.key !== 'Enter') return;
    var c = P.card(), cs = S.cs, tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'Escape') { closeMenus(); return; }
    if (e.key === 'Enter') {
      if (tag === 'textarea' && !(e.metaKey || e.ctrlKey)) return;
      if (e.target.classList && e.target.classList.contains('slot-in') && !cs.done) {
        var k = +e.target.dataset.v, nx = root.querySelector('.slot-in[data-v="' + (k + 1) + '"]');
        if (nx && !nx.value) { e.preventDefault(); nx.focus(); return; }
      }
      /* Enter on a picked answer checks it, as a form would. On any other
         button (Hint, Flag, a menu item) it presses that button. */
      if (tag === 'button' && !e.target.classList.contains('c-primary') && !e.target.classList.contains('opt')) return;
      var b = root.querySelector('.c-primary:not([disabled])');
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    if (tag === 'input' || tag === 'textarea') return;
    if (/^[1-6]$/.test(e.key) && P.isQuestion(c) && !cs.done) {
      var grp = cs.stage ? 'b' : 'a';
      var o = root.querySelectorAll('.opt[data-group="' + grp + '"]')[+e.key - 1];
      if (o) { o.click(); o.focus({ preventScroll: true }); }
    }
    if (c.kind === 'lesson' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      cs.part = Math.max(0, Math.min(c.parts.length - 1, cs.part + (e.key === 'ArrowRight' ? 1 : -1))); rerenderWork();
    }
    if (c.kind === 'deck') {
      if (e.key === 'ArrowRight') { cs.fc = Math.min(c.cards.length - 1, cs.fc + 1); cs.flip = false; rerenderWork(); }
      if (e.key === 'ArrowLeft') { cs.fc = Math.max(0, cs.fc - 1); cs.flip = false; rerenderWork(); }
      if (e.key === ' ') { e.preventDefault(); cs.flip = !cs.flip; var f = root.querySelector('.fc'); if (f) f.classList.toggle('is-flipped', cs.flip); }
    }
  }

  function answerText(c) {
    if (c.options && c.correct != null) return c.options[c.correct];
    if (c.type === 'who') return c.claims[c.correct].name;
    if (c.type === 'seq') return c.items.join(' \u2192 ');
    if (c.type === 'sort') return c.groups[0] + ': ' + c.items.filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; }).join(', ');
    if (c.type === 'recall') return c.items.join(', ');
    return c.answer || '';
  }

  P.register = function (id, impl) { P.dirs[id] = impl; };

  P.boot = function () {
    var id = document.documentElement.dataset.dir || 'a';
    P.dirId = id; dir = P.dirs[id];
    root = document.getElementById('app');
    ctx = { P: P, S: S, root: root };
    root.innerHTML = dir.frame(ctx);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) closeMenus(); });
    setTheme(document.documentElement.dataset.theme || 'light');
    var start = +(qs.get('card') || 0);
    /* Opening mid-session (the gallery does): pretend the earlier questions
       were answered, mostly right, so the nav and progress look lived-in. */
    if (start) {
      for (var k = 0; k < start; k++) {
        var dk = P.deck[k]; if (dk.kind !== 'q') continue;
        var ok = k % 4 !== 1; S.status[k] = dk.scored === false ? 'done' : (ok ? 'right' : 'wrong');
        if (dk.scored !== false) { S.answered++; if (ok) S.right++; else S.misses.push({ stem: dk.stem.replace('___', '____'), mine: '', answer: answerText(dk) }); }
      }
      S.streak = 2; S.bestStreak = 3;
    }
    render(start, { instant: true });
    if (qs.get('auto')) setTimeout(function () { P.autoAnswer(qs.get('auto') === 'right'); }, 30);
    setInterval(function () {
      if (document.hidden) return;
      S.secs = Math.max(0, S.secs - 1);
      root.querySelectorAll('[data-bind="time"]').forEach(function (e) { e.textContent = P.time(); });
      root.querySelectorAll('[data-bind="mins"]').forEach(function (e) { e.textContent = Math.ceil(S.secs / 60) + ' min'; });
      root.style.setProperty('--time-frac', P.timeFrac().toFixed(4));
    }, 1000);
    window.addEventListener('message', function (e) {
      var d = e.data || {}; if (d.type !== 'sfp') return;
      if (d.theme) setTheme(d.theme);
      if (d.card != null) render(+d.card, { instant: !!d.instant });
      if (d.auto) setTimeout(function () { P.autoAnswer(d.auto === 'right'); }, d.card != null ? 220 : 0);
    });
  };
})();

/* sf-guide.js - the walkthrough, guided (Oct 2026).

   The Walkthrough button used to queue a board that TOLD the learner the
   answer in panels. The owner wanted one that walks them to it: a sheet rises
   over the question they just answered, and the steps of THAT question are
   asked one at a time, three choices each. A wrong pick is explained and
   tried again; a right one joins a trail, so by the end the whole route sits
   on one screen in the learner's own order. On a cell lesson a drawn cell
   shows the protein (or whatever moves) travelling from part to part.

   - One model call per question (api/generate), cached on the day
     (day.guides, last 16) and in the saved plan: reopening costs nothing.
   - Every string the model wrote goes in through esc(); the steps are
     validated (guideClean) and an unusable answer is a failure, not a card.
   - A failed or slow call (GUIDE_TIMEOUT_MS) offers the old walkthrough,
     which block 2 hands in as `fallback`. Nothing fails silently.
   - Not for teach-it-back cards (no right answer to walk to) or the
     labelling card (its pin-by-pin walk is already on the picture).
   - Never scored. It does not touch correctCount, SM-2 or the answer log.

   Reads block 1's globals (plan, day, dayIndex, SFStore, wrongItems,
   momentStem, momentAnswer) at CALL time only, so it can load before them.
   ES5, like lesson.html. */
(function (w) {
  'use strict';
  var doc = w.document;
  var GUIDE_TIMEOUT_MS = 30000;
  var GUIDE_KEEP = 16;
  var SKIP = { write: 1, labeldiagram: 1 };
  var inflight = {};

  function str(v) { return v == null ? '' : String(v); }
  function clip(v, n) {
    return str(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 300);
  }
  function esc(v) {
    return str(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function reduced() {
    try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ── what we tell the model ───────────────────────────────────────────── */
  function stemOf(q) {
    return typeof w.momentStem === 'function' ? w.momentStem(q) : clip(str(q.scenario) + ' ' + str(q.question), 420);
  }
  function answerOf(q) {
    var a = '';
    try { if (typeof w.momentAnswer === 'function') a = w.momentAnswer(q); } catch (e) { a = ''; }
    if (!a) { try { if (typeof w.correctAnswerText === 'function') a = clip(w.correctAnswerText(q), 240); } catch (e2) { a = ''; } }
    return a;
  }
  function theyAnswered(q) {
    var list = arr(w.wrongItems), i;
    for (i = list.length - 1; i >= 0; i--) {
      if (list[i] && list[i].q === q) {
        var t = clip(list[i].userAns, 140);
        return /^(—|-|check|submit|done|next)\b/i.test(t) ? '' : t;
      }
    }
    return '';
  }
  function subjectOf() {
    try { return w.resolveSubjectType(w.plan, w.day); } catch (e) { return ''; }
  }
  var CELL_WORDS = /\b(cells?|organelles?|ribosomes?|golgi|mitochondri\w*|endoplasmic|vesicles?|lysosomes?|cytoplasm|protein synthesis|cell membrane)\b/i;
  function isCellTopic(q) {
    var d = w.day || {};
    var text = [d.title, d.microTopic, w.plan && w.plan.subject, stemOf(q), answerOf(q)].join(' ');
    return subjectOf() !== 'math' && CELL_WORDS.test(text);
  }
  var PLACES = ['ribosome', 'rough-er', 'smooth-er', 'golgi', 'vesicle', 'membrane',
                'nucleus', 'mitochondria', 'lysosome', 'cytoplasm'];

  function facts(q, wasCorrect) {
    var d = w.day || {};
    var topic = str(d.microTopic || d.title).split(/\s*[›>]\s*/).pop();
    return {
      lesson: clip(d.title, 120), topic: clip(topic, 120), subject: subjectOf(),
      grade: clip(w.plan && w.plan.grade, 20),
      type: clip(q.type, 20), question: stemOf(q), answer: answerOf(q),
      they: wasCorrect ? '' : theyAnswered(q), correct: !!wasCorrect,
      why: clip(q.explanation, 420), cell: isCellTopic(q)
    };
  }

  function prompt(f) {
    var maths = f.subject === 'math';
    return [
      'You are a patient tutor. A learner' + (f.grade ? ' in grade ' + f.grade : '') +
        ' has just answered a practice question ' + (f.correct ? 'correctly, and wants to check their reasoning.' : 'WRONGLY.'),
      'Build a short guided walkthrough that leads THEM to the right answer, one decision at a time.',
      '',
      'LESSON: ' + f.lesson + (f.topic && f.topic !== f.lesson ? ' (' + f.topic + ')' : ''),
      'SUBJECT: ' + (f.subject || 'general'),
      'QUESTION: ' + f.question,
      'RIGHT ANSWER: ' + f.answer,
      f.they ? 'THEY ANSWERED: ' + f.they : '',
      f.why ? 'EXPLANATION: ' + f.why : '',
      '',
      'RULES:',
      '- ' + (maths ? '3 to 5' : '3 or 4') + ' steps, in order. Each step is ONE small move of the reasoning that gets',
      '  to the answer of THIS question. The last step lands on the answer itself.',
      maths ? '- Maths: work THIS problem. Each step asks what to do next ("What do you do first to 3x + 5 = 20?")\n  and its "why" states the result of that move ("Subtract 5 from both sides: 3x = 15.").' :
              '- Do not restate the question as step 1. Start from what the learner needs to notice first.',
      '- "ask" is one short question (under 110 characters). "options" are exactly 3 short answers (under 60',
      '  characters each) and exactly ONE has "right":true.',
      '- The wrong options are mistakes a real learner makes here.' + (f.they ? ' One step must offer the slip behind\n  what this learner answered, so they meet their own mistake and see why it fails.' : ''),
      '- Every option carries its own "note", one sentence: on the right option, why it is right; on a wrong',
      '  option, what is wrong with THAT option. Never just say "incorrect".',
      '- Use only what the lesson and the question say. Plain words for a ' + (f.grade ? 'grade ' + f.grade + ' ' : 'school ') + 'learner.',
      f.cell ? '- "place": ONLY when the walkthrough follows something MOVING through the cell (a protein, a molecule,\n' +
               '  a signal), name the part where it IS at that step, with ONE of: ' + PLACES.join(', ') + '.\n' +
               '  A step about what a part does, when nothing is there, gets "". If nothing moves, every place is "".' : '',
      '',
      'OUTPUT: ONLY this JSON, nothing else:',
      '{"title":"4 to 7 words","intro":"one sentence: what we will work out","steps":[{"ask":"","options":[' +
        '{"text":"","right":false,"note":""},{"text":"","right":true,"note":""},{"text":"","right":false,"note":""}]' +
        (f.cell ? ',"place":""' : '') + '}],"takeaway":"one sentence to remember"}'
    ].filter(function (l) { return l !== ''; }).join('\n');
  }

  /* ── what we accept back ─────────────────────────────────────────────── */
  function clean(o, cell) {
    if (!o || typeof o !== 'object') return null;
    var steps = arr(o.steps).map(function (s) {
      if (!s || typeof s !== 'object') return null;
      var raw = arr(s.options), notes = null, a = parseInt(s.answer, 10);
      /* The shape the prompt asks for: each option carries its own note, so
         a note can never sit beside the wrong option. */
      if (raw.length && raw[0] && typeof raw[0] === 'object') {
        var objs = raw.filter(function (x) { return x && clip(x.text, 90); });
        var rights = objs.filter(function (x) { return x.right === true || x.right === 'true'; });
        if (rights.length !== 1) return null;
        a = objs.indexOf(rights[0]);
        notes = objs.map(function (x) { return clip(x.note, 260); });
        raw = objs.map(function (x) { return x.text; });
      }
      var opts = raw.map(function (x) { return clip(x, 90); }).filter(Boolean);
      if (!clip(s.ask, 10) || opts.length < 2 || opts.length > 4 || !(a >= 0 && a < opts.length)) return null;
      var seen = {}, dup = false;
      opts.forEach(function (x) { var k = x.toLowerCase(); if (seen[k]) dup = true; seen[k] = 1; });
      if (dup) return null;
      var wr = notes ? notes.map(function (n, k) { return k === a ? '' : n; }) : arr(s.wrong);
      /* The older shape: a "wrong" list that is meant to line up with the
         options. Measured on a real reply, the model put its "" LAST instead
         of beside the right answer, so every note sat one option off. When
         the list is the wrong options' notes in order, re-seat them. */
      if (!notes && clip(wr[a], 5)) {
        var said = wr.map(function (x) { return clip(x, 220); }).filter(Boolean), slot = 0;
        if (said.length === opts.length - 1) wr = opts.map(function (_, k) { return k === a ? '' : said[slot++]; });
      }
      var place = cell ? clip(s.place, 20).toLowerCase() : '';
      return {
        ask: clip(s.ask, 200), options: opts, answer: a,
        why: (notes && notes[a]) || clip(s.why, 260) || 'That is the step that gets you closer to the answer.',
        wrong: opts.map(function (x, k) {
          return k === a ? '' : (clip(wr[k], 220) || 'That does not fit what the question says.');
        }),
        place: PLACES.indexOf(place) >= 0 ? place : ''
      };
    }).filter(Boolean).slice(0, 5);
    if (steps.length < 2) return null;
    return {
      title: clip(o.title, 70) || 'Let’s work through it',
      intro: clip(o.intro, 200),
      takeaway: clip(o.takeaway, 220),
      steps: steps
    };
  }

  /* ── cache: on the day and in the saved plan ─────────────────────────── */
  function key(q) {
    var s = 'guide|' + stemOf(q) + '|' + answerOf(q), h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'g' + (h >>> 0).toString(36);
  }
  function cache() {
    var d = w.day;
    if (!d) return {};
    if (!d.guides || typeof d.guides !== 'object' || arr(d.guides) === d.guides) d.guides = {};
    return d.guides;
  }
  function store(k, data) {
    try {
      var c = cache();
      c[k] = data;
      var ks = Object.keys(c);
      while (ks.length > GUIDE_KEEP) delete c[ks.shift()];
      var p = w.plan, i = w.dayIndex;
      if (p && p.days && p.days[i]) {
        p.days[i].guides = c;
        w.SFStore.setItem('studyflow_plan', JSON.stringify(p));
      }
    } catch (e) { /* storage full: it still shows now */ }
  }

  function request(k, f) {
    if (inflight[k]) return inflight[k];
    inflight[k] = new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, GUIDE_TIMEOUT_MS);
      fetch('api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt(f) })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        if (done) return;
        done = true; clearTimeout(timer);
        var raw = str(data && data.result), obj = null;
        try { obj = w.SFQuestions && w.SFQuestions.repairJSON ? w.SFQuestions.repairJSON(raw) : null; } catch (e) { obj = null; }
        if (!obj) { var m = raw.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch (e2) { obj = null; } } }
        var g = clean(obj, f.cell);
        if (!g) { reject(new Error('unusable')); return; }
        store(k, g);
        resolve(g);
      }).catch(function (e) {
        if (done) return;
        done = true; clearTimeout(timer);
        reject(e || new Error('failed'));
      });
    });
    inflight[k].then(function () { delete inflight[k]; }, function () { delete inflight[k]; });
    return inflight[k];
  }

  /* ── styles: the lesson's own tokens, injected once ──────────────────── */
  var CSS = [
    '.sg-scrim{position:fixed;inset:0;z-index:10000;background:rgba(14,18,32,.42);opacity:0;transition:opacity .32s ease;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}',
    '.sg-scrim.in{opacity:1}',
    'body.sg-open .container{transform:scale(.965) translateY(8px);filter:saturate(.9);transition:transform var(--spring-ms,560ms) var(--spring,ease),filter .3s;transform-origin:50% 0}',
    'body .container{transition:transform var(--spring-ms,560ms) var(--spring,ease),filter .3s}',
    '.sg-sheet{position:fixed;left:50%;bottom:0;z-index:10001;width:min(600px,100%);max-height:min(92vh,880px);display:flex;flex-direction:column;',
    '  background:var(--white,#fff);color:var(--ink,#1a1d2e);border-radius:28px 28px 0 0;box-shadow:0 -18px 50px -12px rgba(14,18,32,.35);',
    '  transform:translate(-50%,100%);will-change:transform;font-family:var(--sans,"DM Sans",sans-serif);overflow:hidden}',
    '@media (min-width:700px){.sg-sheet{bottom:24px;border-radius:28px;max-height:min(88vh,860px)}}',
    '.sg-head{position:relative;color:#fff;padding:12px 24px 18px;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;',
    '  background:radial-gradient(110% 130% at 100% 0%,rgba(140,176,255,.5),rgba(140,176,255,0) 55%),radial-gradient(80% 90% at 0% 100%,rgba(30,62,190,.45),rgba(30,62,190,0) 60%),linear-gradient(160deg,#4f82f8,#3a69ec 50%,#2c56d8)}',
    '.sg-head:active{cursor:grabbing}',
    '.sg-grab{display:block;width:40px;height:5px;border-radius:9px;background:rgba(255,255,255,.55);margin:0 auto 12px}',
    '.sg-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;color:#fff;',
    '  background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.24);display:flex;align-items:center;justify-content:center;transition:transform .2s}',
    '.sg-close:active{transform:scale(.92)}',
    '.sg-badge{display:inline-flex;gap:6px;align-items:center;background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.24);',
    '  font-size:.7rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:.3rem .75rem;border-radius:999px;margin-bottom:.55rem}',
    '.sg-head h2{font-family:var(--serif,"Instrument Serif",serif);font-weight:400;font-synthesis-weight:none;font-size:clamp(1.6rem,4.6vw,2rem);line-height:1.08;letter-spacing:-.015em;margin:0;color:#fff;padding-right:36px;text-wrap:balance}',
    '.sg-head p{margin:.4rem 0 0;font-size:.92rem;line-height:1.5;opacity:.9}',
    '.sg-rail{display:flex;gap:6px;margin-top:.9rem}.sg-rail i{flex:1;height:5px;border-radius:9px;background:rgba(255,255,255,.22);overflow:hidden}',
    '.sg-rail b{display:block;height:100%;width:0;background:#fff;border-radius:9px;transition:width .7s var(--spring,ease)}',
    '.sg-body{overflow-y:auto;overscroll-behavior:contain;padding:18px 22px calc(22px + env(safe-area-inset-bottom,0px))}',
    '.sg-mapwrap:not(:empty){position:sticky;top:-18px;z-index:3;background:var(--white,#fff);margin:-18px -22px 0;padding:18px 22px 4px}',
    '.sg-map{background:#f7f9fe;border-radius:18px;padding:4px 2px 0;margin:0 0 14px;animation:sgRise .5s var(--spring,ease) both}',
    '.sg-map svg{display:block;width:100%;height:auto}',
    '.sg-map .dr{stroke-dasharray:var(--l);stroke-dashoffset:var(--l);animation:sgDraw 1.1s var(--spring,ease) forwards}',
    '.sg-map .fi{opacity:0;animation:sgFade .6s ease forwards}',
    '.sg-lab{font:600 15.5px var(--sans,"DM Sans",sans-serif);fill:#8a93a6;transition:fill .4s}.sg-lab.on{fill:#1a1d2e}',
    '.sg-lead{stroke:#b9c3d6;stroke-width:1;transition:stroke .4s}.sg-lead.on{stroke:#4a7cf6}',
    '.sg-q{font-size:1.05rem;font-weight:600;line-height:1.4;margin:4px 0 10px;animation:sgRise .5s var(--spring,ease) both}',
    '.sg-num{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--blue,#4a7cf6);margin-bottom:4px}',
    '.sg-opt{display:flex;gap:11px;align-items:center;width:100%;text-align:left;margin:0 0 8px;padding:.8rem .95rem;border-radius:16px;',
    '  border:1.5px solid var(--border,#e8ecf4);background:var(--soft,#f4f6fb);font:500 .95rem var(--sans,"DM Sans",sans-serif);color:var(--ink,#1a1d2e);cursor:pointer;',
    '  transition:border-color .18s,background .18s,opacity .25s,transform var(--spring-fast-ms,340ms) var(--spring-fast,ease);animation:sgRise .5s var(--spring,ease) both}',
    '@media (hover:hover){.sg-opt:hover:not(:disabled){border-color:var(--blue,#4a7cf6)}}',
    '.sg-opt:active:not(:disabled){transform:scale(.985);transition-duration:80ms}',
    '.sg-opt:focus-visible{outline:2px solid var(--blue,#4a7cf6);outline-offset:2px}',
    '.sg-lt{width:26px;height:26px;border-radius:8px;background:rgba(26,29,46,.06);display:flex;align-items:center;justify-content:center;font-size:.74rem;font-weight:700;flex:none}',
    'body.dark .sg-lt{background:rgba(255,255,255,.08)}',
    '.sg-opt.r{background:#d1faf0;border-color:#38bfa1;color:#065f46;animation:sgPop .45s cubic-bezier(.34,1.56,.64,1) both}',
    '.sg-opt.w{background:#fee2e2;border-color:#ef4444;color:#7f1d1d;animation:sgShake .4s ease both}',
    'body.dark .sg-opt.r{background:rgba(56,191,161,.14);color:#a7f3d0}body.dark .sg-opt.w{background:rgba(239,68,68,.12);color:#fecaca}',
    '.sg-opt.dim{opacity:.45}',
    '.sg-mk{margin-left:auto;width:20px;height:20px;flex:none}.sg-mk path{stroke-dasharray:30;stroke-dashoffset:30;animation:sgDraw .35s .08s ease forwards}',
    '.sg-fb{border-radius:14px;padding:.7rem .9rem;font-size:.9rem;line-height:1.5;margin-top:4px;animation:sgRise .45s var(--spring,ease) both}',
    '.sg-fb.g{background:#ecfbf6;color:#0f5f4c}.sg-fb.x{background:#fff1f1;color:#7f1d1d}',
    'body.dark .sg-fb.g{background:rgba(56,191,161,.12);color:#a7f3d0}body.dark .sg-fb.x{background:rgba(239,68,68,.1);color:#fecaca}',
    '.sg-tr{display:flex;gap:11px;align-items:flex-start;font-size:.9rem;color:var(--muted,#6b7280);line-height:1.45;padding:0 0 10px;position:relative;animation:sgLand .55s var(--spring,ease) both}',
    '.sg-tr::before{content:"";position:absolute;left:12px;top:26px;bottom:0;width:2px;background:var(--blue-light,#dce8ff);transform-origin:top;animation:sgGrow .5s .25s var(--spring,ease) both}',
    'body.dark .sg-tr::before{background:#26345c}',
    '.sg-tr:last-child::before{display:none}',
    '.sg-tn{width:26px;height:26px;border-radius:50%;background:var(--blue,#4a7cf6);color:#fff;font-size:.74rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;animation:sgPop .5s .1s cubic-bezier(.34,1.56,.64,1) both}',
    '.sg-tr b{color:var(--ink,#1a1d2e);font-weight:600}',
    '.sg-done{text-align:center;padding:6px 0 4px;animation:sgRise .6s var(--spring,ease) both}',
    '.sg-done h3{font-family:var(--serif,"Instrument Serif",serif);font-weight:400;font-synthesis-weight:none;font-size:1.75rem;margin:6px 0 6px;color:var(--ink,#1a1d2e)}',
    '.sg-done p{margin:0 auto 16px;color:var(--muted,#6b7280);font-size:.95rem;line-height:1.5;max-width:42ch}',
    '.sg-btn{font:600 .95rem var(--sans,"DM Sans",sans-serif);background:var(--blue,#4a7cf6);color:#fff;border:0;border-radius:999px;padding:.75rem 1.4rem;cursor:pointer;transition:transform var(--spring-fast-ms,340ms) var(--spring-fast,ease)}',
    '.sg-btn:active{transform:scale(.96);transition-duration:80ms}',
    '.sg-btn.ghost{background:transparent;color:var(--blue,#4a7cf6);box-shadow:inset 0 0 0 1.5px var(--blue,#4a7cf6);margin-left:8px}',
    '.sg-skel{height:48px;border-radius:16px;margin:0 0 8px;background:linear-gradient(100deg,var(--soft,#f4f6fb) 30%,rgba(74,124,246,.10) 50%,var(--soft,#f4f6fb) 70%);background-size:300% 100%;animation:sgShimmer 1.4s linear infinite}',
    '.sg-wait{display:flex;align-items:center;gap:10px;color:var(--muted,#6b7280);font-size:.9rem;margin:2px 0 14px}',
    '.sg-wait svg path{stroke-dasharray:60;animation:sgPencil 1.6s ease-in-out infinite}',
    '.sg-spark{position:absolute;width:7px;height:7px;border-radius:2px;pointer-events:none;z-index:2;animation:sgFly 1.1s ease-out forwards}',
    '.sg-sheet.ok{box-shadow:0 -18px 50px -12px rgba(14,18,32,.35),inset 0 0 0 2px #38bfa1}',
    '.sg-sheet.no{box-shadow:0 -18px 50px -12px rgba(14,18,32,.35),inset 0 0 0 2px #ef4444}',
    '@keyframes sgRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@keyframes sgLand{from{opacity:0;transform:translateY(-14px) scale(.97)}to{opacity:1;transform:none}}',
    '@keyframes sgGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
    '@keyframes sgPop{0%{transform:scale(1)}45%{transform:scale(1.03)}100%{transform:scale(1)}}',
    '@keyframes sgShake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}',
    '@keyframes sgDraw{to{stroke-dashoffset:0}}',
    '@keyframes sgFade{to{opacity:1}}',
    '@keyframes sgFly{to{transform:translate(var(--dx),var(--dy)) rotate(260deg);opacity:0}}',
    '@keyframes sgShimmer{from{background-position:100% 0}to{background-position:-100% 0}}',
    '@keyframes sgPencil{0%{stroke-dashoffset:60}50%{stroke-dashoffset:0}100%{stroke-dashoffset:-60}}',
    '@media (prefers-reduced-motion:reduce){.sg-sheet *,.sg-scrim{animation:none!important;transition:opacity .2s ease!important}',
    '  .sg-map .dr{stroke-dashoffset:0}.sg-map .fi{opacity:1}.sg-mk path{stroke-dashoffset:0}body.sg-open .container{transform:none;filter:none}}',
    '@media (prefers-reduced-transparency:reduce){.sg-scrim{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(14,18,32,.6)}}'
  ].join('\n');
  function injectCss() {
    if (doc.getElementById('sf-guide-css')) return;
    var s = doc.createElement('style');
    s.id = 'sf-guide-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ── the cell, drawn once; only the parts this walk visits are named ── */
  var STATIONS = {
    ribosome:     { x: 166, y: 84,  name: 'Ribosomes' },
    'rough-er':   { x: 200, y: 124, name: 'Rough ER' },
    'smooth-er':  { x: 262, y: 72,  name: 'Smooth ER' },
    golgi:        { x: 322, y: 122, name: 'Golgi' },
    vesicle:      { x: 384, y: 150, name: 'Vesicle' },
    membrane:     { x: 489, y: 122, name: 'Cell membrane' },
    nucleus:      { x: 118, y: 122, name: 'Nucleus' },
    mitochondria: { x: 250, y: 168, name: 'Mitochondrion' },
    lysosome:     { x: 432, y: 170, name: 'Lysosome' },
    cytoplasm:    { x: 300, y: 184, name: 'Cytoplasm' }
  };
  var CELL_PATH = 'M40 122 C40 64 110 40 200 40 C290 40 330 52 400 52 C470 52 492 86 492 122 C492 170 452 196 380 198 C300 200 260 206 190 204 C100 202 40 182 40 122Z';
  function cellSvg(uid) {
    return '<svg viewBox="0 0 520 236" role="img" aria-label="An animal cell">' +
      '<defs><radialGradient id="' + uid + 'c" cx="45%" cy="45%" r="65%"><stop offset="0" stop-color="#f3f7ff"/><stop offset="1" stop-color="#e3ecff"/></radialGradient>' +
      '<radialGradient id="' + uid + 'n" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#dfe7fb"/><stop offset="1" stop-color="#c3d1f3"/></radialGradient></defs>' +
      '<path d="' + CELL_PATH + '" fill="url(#' + uid + 'c)"/>' +
      '<g class="fi" style="animation-delay:.2s"><circle cx="350" cy="176" r="5" fill="#d4dff7"/><circle cx="232" cy="62" r="4" fill="#d4dff7"/><circle cx="420" cy="80" r="5" fill="#d4dff7"/><circle cx="214" cy="186" r="4" fill="#d4dff7"/>' +
      '<g transform="translate(250 168) rotate(-12)"><ellipse rx="22" ry="11" fill="#e9dff5" stroke="#b6a3d8" stroke-width="1.3"/><path d="M-16 0 q4 -7 8 0 q4 7 8 0 q4 -7 8 0 q4 7 8 0" fill="none" stroke="#b6a3d8" stroke-width="1.2"/></g>' +
      '<circle cx="432" cy="170" r="9" fill="#f1e8fb" stroke="#b6a3d8" stroke-width="1.3"/><circle cx="429" cy="167" r="1.6" fill="#b6a3d8"/><circle cx="435" cy="172" r="1.6" fill="#b6a3d8"/><circle cx="430" cy="174" r="1.3" fill="#b6a3d8"/>' +
      '<path d="M244 76 q6 -8 12 0 t12 0 t12 0" fill="none" stroke="#9fb4ea" stroke-width="4" stroke-linecap="round"/><path d="M246 66 q6 -8 12 0 t12 0" fill="none" stroke="#9fb4ea" stroke-width="4" stroke-linecap="round"/></g>' +
      '<path class="dr" style="--l:1180" d="' + CELL_PATH + '" fill="none" stroke="#7d9be6" stroke-width="3"/>' +
      '<path class="dr" style="--l:1180;animation-delay:.1s" d="M46 122 C46 68 112 46 200 46 C290 46 330 58 400 58 C466 58 486 90 486 122 C486 166 448 190 380 192 C300 194 260 200 190 198 C104 196 46 178 46 122Z" fill="none" stroke="#b5c8f3" stroke-width="1.2"/>' +
      '<circle cx="118" cy="122" r="40" fill="url(#' + uid + 'n)" stroke="#7d9be6" stroke-width="2.4" class="fi" style="animation-delay:.25s"/>' +
      '<circle cx="108" cy="114" r="12" fill="#9fb4ea" class="fi" style="animation-delay:.35s"/>' +
      '<g fill="#fff" class="fi" style="animation-delay:.4s"><circle cx="157" cy="112" r="1.8"/><circle cx="150" cy="96" r="1.8"/><circle cx="154" cy="140" r="1.8"/></g>' +
      '<g fill="none" stroke="#7d9be6" stroke-width="5.5" stroke-linecap="round" opacity=".55">' +
        '<path class="dr" style="--l:140;animation-delay:.35s" d="M168 82 C186 96 186 148 168 162"/>' +
        '<path class="dr" style="--l:150;animation-delay:.45s" d="M182 78 C202 96 202 150 182 166"/>' +
        '<path class="dr" style="--l:160;animation-delay:.55s" d="M196 76 C218 96 218 152 196 170"/></g>' +
      '<g fill="#3a5bc7" class="fi" style="animation-delay:.9s"><circle cx="164" cy="86" r="2.4"/><circle cx="176" cy="104" r="2.4"/><circle cx="179" cy="130" r="2.4"/><circle cx="172" cy="152" r="2.4"/><circle cx="189" cy="86" r="2.4"/><circle cx="194" cy="118" r="2.4"/><circle cx="191" cy="156" r="2.4"/><circle cx="204" cy="82" r="2.4"/><circle cx="211" cy="140" r="2.4"/></g>' +
      '<g fill="none" stroke="#7d9be6" stroke-width="5" stroke-linecap="round" opacity=".7">' +
        '<path class="dr" style="--l:90;animation-delay:.6s" d="M296 92 C314 108 314 136 296 152"/>' +
        '<path class="dr" style="--l:96;animation-delay:.68s" d="M308 88 C328 106 328 138 308 156"/>' +
        '<path class="dr" style="--l:102;animation-delay:.76s" d="M320 84 C342 104 342 140 320 160"/>' +
        '<path class="dr" style="--l:108;animation-delay:.84s" d="M332 80 C356 102 356 142 332 164"/></g>' +
      '<g class="fi" style="animation-delay:1s" fill="#eef3ff" stroke="#7d9be6" stroke-width="1.6"><circle cx="372" cy="96" r="6"/><circle cx="384" cy="150" r="5"/><circle cx="410" cy="128" r="6.5"/></g>' +
      '<path class="sg-route" fill="none" stroke="none"/>' +
      '<path class="sg-route-on" fill="none" stroke="#4a7cf6" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>' +
      '<g class="sg-labels"></g>' +
      '<circle class="sg-ves" r="12" fill="#eef3ff" fill-opacity=".85" stroke="#4a7cf6" stroke-width="2" opacity="0"/>' +
      '<circle class="sg-halo" r="11" fill="#4a7cf6" opacity="0"/>' +
      '<circle class="sg-dot" r="5.5" fill="#4a7cf6" stroke="#fff" stroke-width="2" opacity="0"/>' +
      '</svg>';
  }

  /* A smooth route through the stations, in step order (Catmull-Rom). */
  function routePath(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0].x + ' ' + pts[0].y, i;
    for (i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  /* Labels above or below the cell, never on it; two that would touch on one
     side are split between the sides, then nudged apart. */
  function labelLayout(places) {
    var out = [], side = { top: [], bottom: [] };
    places.forEach(function (p) {
      var s = STATIONS[p], want = s.y <= 122 ? 'top' : 'bottom', other = want === 'top' ? 'bottom' : 'top';
      var w2 = s.name.length * 8.6 + 14;
      function clash(list) { return list.some(function (o) { return Math.abs(o.x - s.x) < (o.w + w2) / 2; }); }
      var put = clash(side[want]) && !clash(side[other]) ? other : want;
      var x = Math.max(w2 / 2 + 4, Math.min(516 - w2 / 2, s.x));
      side[put].forEach(function (o) { if (Math.abs(o.x - x) < (o.w + w2) / 2) x = o.x + (o.w + w2) / 2 * (x >= o.x ? 1 : -1); });
      var lab = { p: p, x: Math.round(x), w: w2, top: put === 'top', sx: s.x, sy: s.y, name: s.name };
      side[put].push(lab);
      out.push(lab);
    });
    return out;
  }

  /* ── a spring, in Apple's two numbers: damping ratio and response ─────
     The sheet is moved by this, never by a CSS transition, so a finger can
     catch it mid-flight and it carries the finger's velocity when let go. */
  function spring(st, to, zeta, resp, onFrame, onDone) {
    if (st.raf) w.cancelAnimationFrame(st.raf);
    var k = Math.pow(2 * Math.PI / resp, 2), c = 2 * zeta * (2 * Math.PI / resp), last = 0;
    function tick(ts) {
      var dt = last ? Math.min(0.064, (ts - last) / 1000) : 1 / 60, n = 4, h = dt / n, j;
      last = ts;
      for (j = 0; j < n; j++) { st.v += (-k * (st.y - to) - c * st.v) * h; st.y += st.v * h; }
      if (Math.abs(st.y - to) < 0.5 && Math.abs(st.v) < 8) { st.y = to; st.v = 0; onFrame(); st.raf = 0; if (onDone) onDone(); return; }
      onFrame();
      st.raf = w.requestAnimationFrame(tick);
    }
    st.raf = w.requestAnimationFrame(tick);
  }
  /* Where a flick is going, not where it was let go (Apple's projection). */
  function project(v) { var d = 0.998; return (v / 1000) * d / (1 - d); }
  function rubber(over, dim) { var c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }

  var S = null;   // the one open sheet

  function mark(ok) {
    return '<svg class="sg-mk" viewBox="0 0 24 24" fill="none" stroke="' + (ok ? '#1a9e80' : '#dc2626') +
      '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      (ok ? 'M5 12.5l4.5 4.5L19 7' : 'M6 6l12 12M18 6L6 18') + '"/></svg>';
  }
  var CLOSE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var WALK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var PENCIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a7cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20c4-1 6-6 9-6s4 4 9 3"/></svg>';

  function q$(sel) { return S && S.sheet.querySelector(sel); }

  function setHead(title, intro, n) {
    var h = q$('.sg-head');
    h.querySelector('h2').textContent = title;
    var p = h.querySelector('p');
    p.textContent = intro || '';
    p.style.display = intro ? '' : 'none';
    var rail = h.querySelector('.sg-rail');
    rail.innerHTML = '';
    for (var i = 0; i < (n || 0); i++) rail.appendChild(doc.createElement('i')).appendChild(doc.createElement('b'));
  }

  function paintY() {
    if (!S) return;
    S.sheet.style.transform = 'translate(-50%,' + S.st.y.toFixed(2) + 'px)';
    var h = S.sheet.offsetHeight || 1;
    S.scrim.style.opacity = Math.max(0, Math.min(1, 1 - S.st.y / h)).toFixed(3);
  }

  function open(q, explanation, wasCorrect, btn, fallback) {
    if (!q || S) return !!S;
    /* The old walkthroughs are the fallback, and the morning suite still
       tests them: it sets this to reach them without the sheet. */
    if (w.SF_GUIDE_OFF) return false;
    var t = str(q.type).toLowerCase();
    if (SKIP[t] || q.fromLesson) return false;
    if (!stemOf(q) || !answerOf(q)) return false;
    if (!q.explanation && explanation) q.explanation = explanation;
    injectCss();

    var scrim = doc.createElement('div');
    scrim.className = 'sg-scrim';
    var sheet = doc.createElement('div');
    sheet.className = 'sg-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'sg-title');
    sheet.innerHTML =
      '<div class="sg-head"><span class="sg-grab" aria-hidden="true"></span>' +
      '<button class="sg-close" type="button" aria-label="Close the walkthrough">' + CLOSE_ICON + '</button>' +
      '<span class="sg-badge">' + WALK_ICON + 'Walkthrough</span><h2 id="sg-title"></h2><p></p><div class="sg-rail"></div></div>' +
      '<div class="sg-body"><div class="sg-mapwrap"></div><div class="sg-trail"></div><div class="sg-stage" aria-live="polite"></div></div>';
    doc.body.appendChild(scrim);
    doc.body.appendChild(sheet);

    S = { q: q, sheet: sheet, scrim: scrim, btn: btn, fallback: fallback, wasCorrect: !!wasCorrect,
          st: { y: 0, v: 0, raf: 0 }, i: 0, busy: false, map: null, k: key(q), f: facts(q, wasCorrect) };
    setHead('Let’s work through it', clip(stemOf(q), 160), 0);
    doc.body.classList.add('sg-open');

    /* Rise from the bottom edge - the way it will leave. */
    if (reduced()) {
      sheet.style.transform = 'translate(-50%,0)';
      sheet.style.opacity = '0';
      sheet.style.transition = 'opacity .2s ease';
      w.requestAnimationFrame(function () { sheet.style.opacity = '1'; scrim.style.opacity = '1'; });
    } else {
      S.st.y = sheet.offsetHeight || 600;
      paintY();
      spring(S.st, 0, 1, 0.42, paintY);
    }

    sheet.querySelector('.sg-close').onclick = function () { close(); };
    scrim.onclick = function () { close(); };
    bindDrag(sheet.querySelector('.sg-head'));
    w.addEventListener('keydown', onKey, true);
    setTimeout(function () { var c = q$('.sg-close'); if (c) c.focus({ preventScroll: true }); }, 60);

    var cached = cache()[S.k];
    if (cached && cached.steps) start(cached);
    else load();
    return true;
  }

  function load() {
    if (!S) return;
    var stage = q$('.sg-stage'), me = S;
    stage.innerHTML = '<div class="sg-wait">' + PENCIL + '<span>Building steps for this exact question…</span></div>' +
      '<div class="sg-skel"></div><div class="sg-skel" style="animation-delay:.12s"></div><div class="sg-skel" style="animation-delay:.24s"></div>';
    request(S.k, S.f).then(function (g) {
      if (S === me) start(g);
    }, function () {
      if (S !== me) return;
      stage.innerHTML = '<div class="sg-fb x">Couldn’t build a walkthrough for this one just now.</div>' +
        '<div style="margin-top:14px"><button class="sg-btn" type="button" data-act="quick">Show the quick walkthrough</button>' +
        '<button class="sg-btn ghost" type="button" data-act="retry">Try again</button></div>';
      stage.querySelector('[data-act=quick]').onclick = function () { var fb = S.fallback; close(function () { if (fb) fb(); }); };
      stage.querySelector('[data-act=retry]').onclick = load;
    });
  }

  function start(g) {
    S.g = g;
    S.i = 0;
    setHead(g.title, g.intro, g.steps.length);
    buildMap(g);
    step();
  }

  /* ── the map: only on a cell lesson, only when 3+ steps name a part ── */
  function buildMap(g) {
    var wrap = q$('.sg-mapwrap');
    wrap.innerHTML = '';
    S.map = null;
    if (!S.f.cell) return;
    var order = [];
    g.steps.forEach(function (s) { if (s.place && STATIONS[s.place] && order[order.length - 1] !== s.place) order.push(s.place); });
    var distinct = order.filter(function (p, i) { return order.indexOf(p) === i; });
    if (distinct.length < 3) return;   // fewer is not a journey; two parts read as one
    var uid = 'sg' + Math.random().toString(36).slice(2, 7);
    wrap.innerHTML = '<div class="sg-map">' + cellSvg(uid) + '</div>';
    var svg = wrap.querySelector('svg'), NS = 'http://www.w3.org/2000/svg';
    var pts = order.map(function (p) { return STATIONS[p]; });
    var route = svg.querySelector('.sg-route'), on = svg.querySelector('.sg-route-on');
    route.setAttribute('d', routePath(pts));
    on.setAttribute('d', routePath(pts));
    var L = route.getTotalLength(), at = [], n, j, best, bd, pt;
    /* Each station's distance along the route, found by sampling it. */
    var samples = [];
    for (n = 0; n <= 300; n++) { pt = route.getPointAtLength(L * n / 300); samples.push({ x: pt.x, y: pt.y, l: L * n / 300 }); }
    var from = 0;
    pts.forEach(function (p) {
      best = from; bd = 1e9;
      for (j = from; j < samples.length; j++) {
        var dd = (samples[j].x - p.x) * (samples[j].x - p.x) + (samples[j].y - p.y) * (samples[j].y - p.y);
        if (dd < bd) { bd = dd; best = j; }
      }
      at.push(samples[best].l); from = best;
    });
    on.setAttribute('stroke-dasharray', '0 ' + (L + 1));
    var labs = labelLayout(distinct), lg = svg.querySelector('.sg-labels'), html = '';
    labs.forEach(function (l, k) {
      var ly = l.top ? 24 : 230, y1 = l.top ? 30 : 214;
      html += '<line data-p="' + l.p + '" class="sg-lead fi" x1="' + l.x + '" y1="' + y1 + '" x2="' + l.sx + '" y2="' + l.sy + '" style="animation-delay:' + (1.1 + k * 0.08) + 's"/>' +
              '<text data-p="' + l.p + '" class="sg-lab fi" x="' + l.x + '" y="' + ly + '" text-anchor="middle" style="animation-delay:' + (1.1 + k * 0.08) + 's">' + esc(l.name) + '</text>';
    });
    lg.innerHTML = html;
    S.map = { svg: svg, route: route, on: on, L: L, order: order, at: at, pos: -1, cur: 0, NS: NS,
              dot: svg.querySelector('.sg-dot'), halo: svg.querySelector('.sg-halo'), ves: svg.querySelector('.sg-ves') };
  }

  function mapPlace(len) {
    var m = S.map, p = m.route.getPointAtLength(len);
    [m.dot, m.halo, m.ves].forEach(function (c) { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); });
    m.on.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + (m.L + 1));
    m.cur = len;
  }

  /* Move the protein to this step's part, then ring the part. */
  function mapGo(place, doneRaw) {
    var m = S && S.map, fired = false;
    /* Frames drive the trip; a timer makes sure the step still advances in
       a tab that is not drawing them. */
    function done() { if (!fired) { fired = true; doneRaw(); } }
    setTimeout(done, 2200);
    if (!m || !place) { done(); return; }
    var idx = -1, j;
    for (j = m.pos + 1; j < m.order.length; j++) if (m.order[j] === place) { idx = j; break; }
    if (idx < 0) { done(); return; }
    var to = m.at[idx], from = m.pos < 0 ? to : m.cur, first = m.pos < 0;
    m.pos = idx;
    if (first) {
      mapPlace(to);
      m.dot.style.transition = m.halo.style.transition = 'opacity .4s';
      m.dot.setAttribute('opacity', '1');
      m.halo.setAttribute('opacity', '.18');
      if (!reduced() && m.halo.animate) m.halo.animate([{ r: 9, opacity: 0.25 }, { r: 16, opacity: 0 }], { duration: 1600, iterations: Infinity, easing: 'ease-out' });
      arrive(place);
      setTimeout(done, 450);
      return;
    }
    var carry = place === 'membrane' || place === 'vesicle';
    if (carry && m.ves.animate) m.ves.animate([{ opacity: 0, r: 4 }, { opacity: 1, r: 12 }], { duration: 400, fill: 'forwards', easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (reduced()) { mapPlace(to); arrive(place); setTimeout(done, 200); return; }
    var t0 = 0;
    function tick(ts) {
      if (!S || S.map !== m) return;
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 1050), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      mapPlace(from + (to - from) * e);
      if (k < 1) w.requestAnimationFrame(tick);
      else { arrive(place); setTimeout(done, 450); }
    }
    w.requestAnimationFrame(tick);
  }

  function arrive(place) {
    var m = S.map, s = STATIONS[place];
    var lab = m.svg.querySelectorAll('[data-p="' + place + '"]'), i;
    for (i = 0; i < lab.length; i++) lab[i].classList.add('on');
    if (reduced() || !m.svg.animate) return;
    var r = doc.createElementNS(m.NS, 'circle');
    r.setAttribute('cx', s.x); r.setAttribute('cy', s.y); r.setAttribute('fill', 'none');
    r.setAttribute('stroke', '#4a7cf6'); r.setAttribute('stroke-width', '2');
    m.svg.insertBefore(r, m.ves);
    r.animate([{ r: 6, opacity: 0.9 }, { r: 34, opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = function () { r.remove(); };
    if (place === 'membrane') {
      m.ves.animate([{ r: 12, opacity: 1 }, { r: 22, opacity: 0 }], { duration: 700, fill: 'forwards', easing: 'ease-out' });
      for (var n = 0; n < 6; n++) {
        var d = doc.createElementNS(m.NS, 'circle'), a = -1 + n * 0.4;
        d.setAttribute('cx', s.x); d.setAttribute('cy', s.y); d.setAttribute('r', '2.2'); d.setAttribute('fill', '#4a7cf6');
        m.svg.appendChild(d);
        d.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + (Math.cos(a) * 30).toFixed(1) + 'px,' + (Math.sin(a) * 30).toFixed(1) + 'px)', opacity: 0 }],
          { duration: 900, easing: 'ease-out', fill: 'forwards' }).onfinish = (function (x) { return function () { x.remove(); }; })(d);
      }
    }
  }

  /* ── one step: the question, three choices, one try at a time ───────── */
  function step() {
    var stage = q$('.sg-stage'), g = S.g;
    S.busy = false;
    if (S.i >= g.steps.length) { finish(); return; }
    var s = g.steps[S.i];
    /* The model puts the right answer first more often than chance. */
    var order = s.options.map(function (_, k) { return k; });
    for (var a = order.length - 1; a > 0; a--) { var b = Math.floor(Math.random() * (a + 1)), t = order[a]; order[a] = order[b]; order[b] = t; }
    S.order = order;
    stage.innerHTML = '<span class="sg-num">Step ' + (S.i + 1) + ' of ' + g.steps.length + '</span>' +
      '<p class="sg-q">' + esc(s.ask) + '</p><div class="sg-opts">' +
      order.map(function (k, n) {
        return '<button class="sg-opt" type="button" data-k="' + k + '" style="animation-delay:' + (80 + n * 70) + 'ms">' +
          '<span class="sg-lt">' + 'ABCD'.charAt(n) + '</span><span>' + esc(s.options[k]) + '</span></button>';
      }).join('') + '</div><div class="sg-fbw"></div>';
    var opts = stage.querySelectorAll('.sg-opt'), i;
    for (i = 0; i < opts.length; i++) opts[i].onclick = (function (b) { return function () { pick(b); }; })(opts[i]);
    if (S.i > 0) seat();
  }

  /* Bring the new step's question to the top of what can be seen - just
     under the pinned cell when there is one - so it never hides beneath it
     while its options show. */
  function seat() {
    var body = q$('.sg-body'), num = q$('.sg-num'), map = q$('.sg-mapwrap');
    if (!body || !num || !body.scrollBy) return;
    var edge = (map && map.firstChild ? map.getBoundingClientRect().bottom : body.getBoundingClientRect().top) + 10;
    var d = num.getBoundingClientRect().top - edge;
    if (Math.abs(d) > 4) body.scrollBy({ top: d, behavior: reduced() ? 'auto' : 'smooth' });
  }

  function pick(b) {
    if (!S || S.busy || b.classList.contains('w')) return;
    var s = S.g.steps[S.i], k = +b.getAttribute('data-k'), fbw = q$('.sg-fbw'), me = S;
    if (k === s.answer) {
      S.busy = true;
      b.classList.add('r');
      b.insertAdjacentHTML('beforeend', mark(true));
      var all = q$('.sg-opts').querySelectorAll('.sg-opt'), i;
      for (i = 0; i < all.length; i++) { if (all[i] !== b) all[i].classList.add('dim'); all[i].disabled = true; }
      fbw.innerHTML = '<div class="sg-fb g">' + esc(s.why) + '</div>';
      reveal(fbw);
      glow('ok');
      burst(b);
      try { if (w.navigator.vibrate) w.navigator.vibrate(8); } catch (e) { /* no haptics */ }
      var bars = q$('.sg-rail').querySelectorAll('b');
      if (bars[S.i]) bars[S.i].style.width = '100%';
      mapGo(s.place, function () {
        setTimeout(function () {
          if (S !== me) return;
          q$('.sg-trail').insertAdjacentHTML('beforeend', '<div class="sg-tr"><span class="sg-tn">' + (S.i + 1) + '</span><span><b>' +
            esc(shortOf(s)) + '</b> ' + esc(s.why) + '</span></div>');
          S.i++;
          step();
        }, reduced() ? 300 : 700);
      });
    } else {
      b.classList.add('w');
      b.disabled = true;
      b.insertAdjacentHTML('beforeend', mark(false));
      fbw.innerHTML = '<div class="sg-fb x"><b>Not quite.</b> ' + esc(s.wrong[k]) + ' Try another.</div>';
      reveal(fbw);
      glow('no');
    }
  }

  /* The trail line names the step by its right answer, which is what the
     learner just chose - "Ribosomes on the rough ER." */
  function shortOf(s) {
    var t = s.options[s.answer];
    return /[.!?]$/.test(t) ? t : t + '.';
  }

  /* The explanation lands under the options; on a phone that is below the
     fold, so bring it up into view inside the sheet (never the page). */
  function reveal(el) {
    var body = q$('.sg-body');
    if (!body || !el) return;
    var over = el.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom + 16;
    if (over > 0 && body.scrollBy) body.scrollBy({ top: over, behavior: reduced() ? 'auto' : 'smooth' });
  }

  function glow(kind) {
    var sh = S.sheet;
    sh.classList.remove('ok', 'no');
    void sh.offsetWidth;
    sh.classList.add(kind);
    clearTimeout(S.glowT);
    S.glowT = setTimeout(function () { sh.classList.remove(kind); }, 650);
  }

  function burst(b) {
    if (reduced()) return;
    var r = b.getBoundingClientRect(), o = S.sheet.getBoundingClientRect(), cols = ['#4a7cf6', '#8cb0ff', '#1a1d2e', '#38bfa1'];
    for (var n = 0; n < 14; n++) {
      var d = doc.createElement('span'), a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 60;
      d.className = 'sg-spark';
      d.style.left = (r.right - o.left - 34) + 'px';
      d.style.top = (r.top - o.top + r.height / 2) + 'px';
      d.style.background = cols[n % 4];
      d.style.setProperty('--dx', (Math.cos(a) * v).toFixed(1) + 'px');
      d.style.setProperty('--dy', (Math.sin(a) * v - 20).toFixed(1) + 'px');
      S.sheet.appendChild(d);
      setTimeout((function (x) { return function () { x.remove(); }; })(d), 1200);
    }
  }

  function finish() {
    var stage = q$('.sg-stage'), g = S.g;
    stage.innerHTML = '<div class="sg-done">' +
      '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#eef3ff"/>' +
      '<circle cx="32" cy="32" r="28" fill="none" stroke="#4a7cf6" stroke-width="4" stroke-dasharray="176" stroke-dashoffset="176" transform="rotate(-90 32 32)" style="animation:sgDraw .9s var(--spring,ease) forwards"/>' +
      '<path d="M21 33l7 7 15-16" fill="none" stroke="#4a7cf6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40" style="animation:sgDraw .45s .7s ease forwards"/></svg>' +
      '<h3>You worked it out</h3>' + (g.takeaway ? '<p>' + esc(g.takeaway) + '</p>' : '') +
      '<button class="sg-btn" type="button" data-act="back">Back to the question</button></div>';
    var back = stage.querySelector('[data-act=back]');
    back.onclick = function () { close(); };
    setTimeout(function () { try { back.focus({ preventScroll: true }); } catch (e) { /* old browser */ } }, 400);
    var body = q$('.sg-body');
    if (body.scrollTo) body.scrollTo({ top: body.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* ── leaving: the same way it came, at the speed it was thrown ─────── */
  function close(after, v) {
    if (!S || S.closing) return;
    var me = S;
    me.closing = true;
    w.removeEventListener('keydown', onKey, true);
    doc.body.classList.remove('sg-open');
    var over = false;
    function gone() {
      if (over) return;
      over = true;
      if (me.st.raf) { w.cancelAnimationFrame(me.st.raf); me.st.raf = 0; }
      me.sheet.remove();
      me.scrim.remove();
      if (me.btn && me.btn.focus) { try { me.btn.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
      if (S === me) S = null;
      if (after) after();
    }
    if (reduced()) {
      me.sheet.style.opacity = '0';
      me.scrim.style.opacity = '0';
      setTimeout(gone, 200);
      return;
    }
    /* A background tab runs no frames; the sheet must still go. */
    setTimeout(gone, 900);
    me.st.v = v || me.st.v || 0;
    spring(me.st, me.sheet.offsetHeight + 40, 1, 0.32, function () {
      me.sheet.style.transform = 'translate(-50%,' + me.st.y.toFixed(2) + 'px)';
      me.scrim.style.opacity = Math.max(0, 1 - me.st.y / (me.sheet.offsetHeight || 1)).toFixed(3);
    }, gone);
  }

  /* Drag the head: 1:1 with the finger from where it was grabbed, soft
     resistance upward, and on release the flick decides - projected past a
     third of the sheet closes it, anything less springs home. Grabbing it
     mid-flight stops it where it is. */
  function bindDrag(handle) {
    var start = 0, y0 = 0, hist = [], dragging = false, id = null;
    handle.addEventListener('pointerdown', function (e) {
      if (!S || S.closing || e.target.closest('.sg-close') || reduced()) return;
      if (S.st.raf) { w.cancelAnimationFrame(S.st.raf); S.st.raf = 0; }
      dragging = true; id = e.pointerId; start = e.clientY; y0 = S.st.y; hist = [{ y: e.clientY, t: e.timeStamp }];
      try { handle.setPointerCapture(id); } catch (err) { /* fine */ }
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== id) return;
      var raw = y0 + (e.clientY - start);
      S.st.y = raw < 0 ? rubber(raw, S.sheet.offsetHeight) : raw;
      hist.push({ y: e.clientY, t: e.timeStamp });
      if (hist.length > 6) hist.shift();
      paintY();
    });
    function end(e) {
      if (!dragging || (e && e.pointerId !== id)) return;
      dragging = false;
      var a = hist[0], b = hist[hist.length - 1], dt = (b.t - a.t) / 1000;
      var v = dt > 0 ? (b.y - a.y) / dt : 0;
      if (b.t - (e ? e.timeStamp : b.t) < -80) v = 0;   // held still before letting go
      S.st.v = v;
      if (S.st.y + project(v) > S.sheet.offsetHeight * 0.35) close(null, v);
      else spring(S.st, 0, Math.abs(v) > 300 ? 0.8 : 1, 0.32, paintY);
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* While the sheet is up, keys belong to it: Escape closes, 1-4 or A-D
     pick, and Enter never reaches the session behind (it would advance the
     card the learner is about to come back to). */
  function onKey(e) {
    if (!S) return;
    var k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    var n = '1234'.indexOf(k);
    if (n < 0 && k && k.length === 1) n = 'abcd'.indexOf(k.toLowerCase());
    if (n >= 0) {
      var opts = q$('.sg-opts') ? q$('.sg-opts').querySelectorAll('.sg-opt') : [];
      if (opts[n]) { e.preventDefault(); e.stopPropagation(); pick(opts[n]); }
      return;
    }
    if (k === 'Enter') {
      e.stopPropagation();
      var act = doc.activeElement;
      if (!(act && S.sheet.contains(act) && act.tagName === 'BUTTON')) e.preventDefault();
    }
    if (k === 'Tab') {
      var f = S.sheet.querySelectorAll('button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* Whether open() would take this question - so the page can decide which
     buttons to offer before anyone presses one. */
  function can(q) {
    if (!q || w.SF_GUIDE_OFF || q.fromLesson) return false;
    if (SKIP[str(q.type).toLowerCase()]) return false;
    return !!(stemOf(q) && answerOf(q));
  }

  w.SFGuide = {
    open: open, close: close, can: can, isOpen: function () { return !!S; },
    /* for tests */
    prompt: prompt, clean: clean, facts: facts, key: key, labelLayout: labelLayout, STATIONS: STATIONS
  };
})(window);

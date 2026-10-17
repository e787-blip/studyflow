/* ── sf-questions.js — the question templates and their validators ──────
   Moved out of app.html byte for byte (Oct 2026), so the teacher's
   assignment builder (teacher-build.html) asks for questions in exactly the
   shapes the plan builder does and drops exactly the cards it would drop.
   app.html calls these through thin wrappers of the same names. Nothing in
   here touches the page: it is data in, data out.

   The two blocks below are verbatim copies of what app.html held, with their
   original indentation. Change them HERE; app.html no longer has a copy. */
(function () {
  /* ── QUESTION TYPE TEMPLATES ──────────────────────────────────────────────
     One JSON fragment per question type, so a subject's mix can be written as
     a list of type names instead of a hand-assembled 2000-character string.
     Every name here has a renderer in lesson.html; a name with no renderer is
     queued and then silently skipped, so do not invent one. */
  function qtpl(entry, d, i) {
    var bits = String(entry).split(':'), type = bits[0], variant = bits[1] || '';
    var tail = '"hint":"","explanation":"","difficulty":"' + d + '"}';
    /* Rotate the key so a subject's answers are not all option A / all True -
       the model anchors hard on a repeated correctIndex. */
    var idx = i % 4;
    if (type === 'mcq')       return '{"type":"mcq","question":"","options":["","","",""],"correctIndex":' + idx + ',' + tail;
    if (type === 'scenario')  return '{"type":"scenario","question":"","options":["","","",""],"correctIndex":' + idx + ',' + tail;
    if (type === 'truefalse') return '{"type":"truefalse","question":"","correct":"' + (i % 2 ? 'False' : 'True') + '",' + tail;
    if (type === 'fill')      return '{"type":"fill","question":"","answer":"",' + tail;
    /* write:claim is a historical ARGUMENT - a question that can be answered
       either way, a claim, evidence, and why the evidence proves it (De La
       Paz's argument-writing work). Without the mode a write card becomes the
       "teach it back" explanation. */
    if (type === 'write' && variant === 'claim')
      return '{"type":"write","mode":"claim","question":"","source":"","modelAnswer":"",' + tail;
    if (type === 'write')     return '{"type":"write","question":"","modelAnswer":"",' + tail;
    /* classify:change is continuity and change - one of Seixas's six
       historical thinking concepts that nothing here asked for. */
    if (type === 'classify' && variant === 'change')
      return '{"type":"classify","question":"What changed, and what stayed the same?","categoryA":"Changed","categoryB":"Stayed the same","itemsA":["","",""],"itemsB":["","",""],' + tail;
    if (type === 'classify')  return '{"type":"classify","question":"Sort:","categoryA":"","categoryB":"","itemsA":["","",""],"itemsB":["","",""],' + tail;
    /* A Parsons problem: reorder given lines of code into a working program.
       Same pre-to-post gains as writing the equivalent code, faster and at
       lower cognitive load - and StudyFlow already had the format, because a
       sequence question over lines of code IS one. The only thing missing was
       saying so. NOTE: no distractor lines. Distractors reduce learning
       efficiency for young novices, and this app's learners are school age. */
    if (type === 'sequence' && variant === 'parsons')
      return '{"type":"sequence","question":"Put these lines in the order that makes the program work:","items":["","","",""],' + tail;
    if (type === 'sequence')  return '{"type":"sequence","question":"Put these in the order they happen:","items":["","","",""],' + tail;
    if (type === 'sentence')  return '{"type":"sentence","question":"","words":["","",""],"translation":"",' + tail;
    if (type === 'passage')   return '{"type":"passage","questionType":"' + (variant || 'main-idea') + '","passage":"","question":"","options":["","","",""],"correctIndex":' + idx + ',' + tail;
    if (type === 'errorspot') return '{"type":"errorspot","question":"Find the mistake:","steps":[{"text":"","hasError":false},{"text":"","hasError":false},{"text":"","hasError":true},{"text":"","hasError":false}],' + tail;
    if (type === 'wordproblem') return '{"type":"wordproblem","scenario":"","question":"","steps":[{"prompt":"","answer":"","unit":"","hint":""},{"prompt":"Now use {1} to find...","answer":"","unit":""}],"answer":"",' + tail;
    /* The six research-backed formats. Shapes must match the renderers in
       lesson.html exactly - a field the renderer does not read is dead, and a
       field it needs but never receives is a blank card. */
    if (type === 'twopart')     return '{"type":"twopart"' + (variant === 'passage' ? ',"passage":""' : '') + ',"question":"","options":["","","",""],"correctIndex":' + idx + ',"reasonPrompt":"' + (variant === 'passage' ? 'Which line from the text best supports that answer?' : 'Why is that the case?') + '","reasons":["","","",""],"reasonIndex":' + ((i + 2) % 4) + ',' + tail;
    if (type === 'corroborate') return '{"type":"corroborate","sourceA":{"label":"Source A","text":""},"sourceB":{"label":"Source B","text":""},"question":"","options":["","","",""],"correctIndex":' + idx + ',' + tail;
    if (type === 'highlight')   return '{"type":"highlight","question":"","sentences":["","","",""],"correctIndex":' + idx + ',' + tail;
    if (type === 'tracetable')  return '{"type":"tracetable","question":"","setup":"","columns":["Step","Value"],"rows":[["1",""],["2",""],["3",""]],"blankCol":1,' + tail;
    if (type === 'matchpairs')  return '{"type":"matchpairs","question":"Match each item to its pair.","pairs":[{"left":"","right":""},{"left":"","right":""},{"left":"","right":""},{"left":"","right":""}],' + tail;
    if (type === 'estimate')    return '{"type":"estimate","question":"","answer":0,"tolerance":0,"unit":"",' + tail;
    /* Partial dictation: the learner HEARS text and types the one word in "blank". */
    if (type === 'dictation')   return '{"type":"dictation","question":"Listen and type the missing word.","text":"","blank":"","translation":"",' + tail;
    /* One passage, several questions against it - the shape reading
       comprehension is actually practised in. buildQueue expands this into a
       passage card followed by its questions. */
    if (type === 'labeldiagram') return '{"type":"labeldiagram","question":"Label each numbered part.","drawing":{"title":"","w":400,"h":260,"shapes":[]},"pins":[{"x":0,"y":0,"answer":""},{"x":0,"y":0,"answer":""},{"x":0,"y":0,"answer":""}],"options":["",""],' + tail;
    if (type === 'readingset')  return '{"type":"readingset","title":"","passage":"","questions":[{"question":"What is the main idea of the passage?","options":["","","",""],"correctIndex":' + idx + ',"questionType":"main-idea"},{"question":"","options":["","","",""],"correctIndex":' + ((i + 1) % 4) + ',"questionType":"inference"},{"question":"","options":["","","",""],"correctIndex":' + ((i + 2) % 4) + ',"questionType":"vocab-in-context"}],' + tail;
    /* The five formats of Oct 2026 - see docs/question-design.md §11 for the
       evidence behind each. */
    /* Cued free recall: type every item of a set from memory. "items" holds the
       accepted answers, alternatives split by " / ". */
    if (type === 'recall')      return '{"type":"recall","question":"","items":["","","",""],"need":4,' + tail;
    /* Explain from memory, then judge the answer idea by idea (the idea-unit
       standard of Rawson & Dunlosky). :code is Explain in Plain English. */
    if (type === 'selfcheck')   return '{"type":"selfcheck","question":""' + (variant === 'code' ? ',"code":""' : '') + ',"ideas":["","",""],"modelAnswer":"",' + tail;
    /* A partly finished concept map, filled in from memory (Karpicke et al.
       2014). Node 0 is the main idea and is never blanked. */
    if (type === 'conceptmap')  return '{"type":"conceptmap","question":"Complete the map.","nodes":["","","","",""],"links":[{"from":0,"to":1,"label":""},{"from":0,"to":2,"label":""},{"from":1,"to":3,"label":""},{"from":2,"to":4,"label":""}],"blanks":' + (i % 2 ? '[2,3]' : '[1,4]') + ',"extra":"",' + tail;
    /* A concept cartoon: three classmates, one right, two holding real
       misconceptions, each answered with a refutation. The right one rotates,
       as correctIndex does. */
    if (type === 'whosright') {
      var wr = i % 3, claims = [];
      for (var c = 0; c < 3; c++) claims.push('{"says":"","right":' + (c === wr) + ',"why":""}');
      return '{"type":"whosright","question":"","claims":[' + claims.join(',') + '],' + tail;
    }
    /* Read the chart: tap the data (Part A), then say what it means (Part B). */
    if (type === 'readchart')   return '{"type":"readchart","chart":{"kind":"' + (i % 2 ? 'line' : 'bar') + '","title":"","x":"","y":"","unit":"","data":"notes","points":[{"label":"","value":0},{"label":"","value":0},{"label":"","value":0},{"label":"","value":0},{"label":"","value":0}]},"find":"","findIndex":' + (i % 5) + ',"question":"","options":["","","",""],"correctIndex":' + idx + ',' + tail;
    return '';
  }

  function buildQuestionSchema(types, d) {
    var out = [], i, frag;
    for (i = 0; i < types.length; i++) {
      frag = qtpl(types[i], d, i);
      if (frag) out.push(frag);
    }
    return out.join(',');
  }

  var QTYPE_NAME = { mcq:'MCQ', truefalse:'True/False', fill:'Fill', write:'Write',
                     classify:'Classify', sequence:'Sequence', sentence:'Sentence builder',
                     passage:'Passage', errorspot:'Errorspot', scenario:'Scenario',
                     wordproblem:'Wordproblem', twopart:'Two-part', corroborate:'Corroborate',
                     highlight:'Find-the-evidence', tracetable:'Trace table',
                     matchpairs:'Match pairs', estimate:'Estimate', dictation:'Listen and type',
                     readingset:'Reading set (passage + 3 questions)',
                     labeldiagram:'Label the diagram',
                     recall:'Name them all', selfcheck:'Explain and check yourself',
                     conceptmap:'Concept map', whosright:'Who\'s right', readchart:'Read the chart' };

  /* The quota line the model reads is counted from the same list the schema is
     built from, so the two can no longer drift apart. They were two hand-kept
     strings before, and a tally that disagrees with the schema is read by the
     model as permission to improvise. */
  function tallyFor(types) {
    var order = [], counts = {}, i, base;
    for (i = 0; i < types.length; i++) {
      base = String(types[i]).split(':')[0];
      if (!counts[base]) { counts[base] = 0; order.push(base); }
      counts[base]++;
    }
    var parts = [];
    for (i = 0; i < order.length; i++) {
      parts.push(counts[order[i]] + ' ' + (QTYPE_NAME[order[i]] || order[i]));
    }
    return parts.join(', ');
  }

    /* ── VALIDATORS FOR THE FIVE FORMATS OF OCT 2026 ─────────────────────
       Each returns false to drop the question. Strings are flattened, tags
       stripped and capped here; lesson.html escapes them again when it
       draws them, because a plan can be loaded that never came through here. */
    function scText(v, n) {
      return String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ')
        .replace(/\s+/g, ' ').trim().slice(0, n || 200);
    }
    /* Lowercase words with single spaces round them, for "is X printed in Y". */
    function scWords(v) {
      return ' ' + String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim() + ' ';
    }

    /* RECALL - a set typed from memory. An item the question already prints is
       read, not recalled, so it is dropped (and the card, if too few are
       left). "Name three causes..." sets how many count, whatever "need" said:
       the learner reads the stem, not the JSON. */
    function sanitizeRecall(q, qText) {
      if (!qText) return false;
      var stem = scWords(qText), seen = {}, items = [];
      (Array.isArray(q.items) ? q.items : []).forEach(function (it) {
        var v = scText(it && typeof it === 'object' ? (it.answer || it.text || '') : it, 80);
        var alts = v.split('/').map(function (a) { return a.trim(); }).filter(Boolean);
        if (!alts.length) return;
        var key = alts[0].toLowerCase();
        if (seen[key]) return;
        var given = alts.some(function (a) {
          var k = scWords(a);
          return k.length >= 5 && stem.indexOf(k) !== -1;
        });
        if (given) return;
        seen[key] = 1;
        items.push(alts.join(' / '));
      });
      if (items.length < 2) return false;
      q.items = items.slice(0, 8);
      var NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6 };
      var said = /\b(two|three|four|five|six)\b/.exec(qText.toLowerCase());
      var need = said ? NUMW[said[1]] : parseInt(q.need, 10);
      if (!isFinite(need) || need < 2) need = q.items.length;
      if (need > q.items.length) return false;   // "name five" with three answers in the key
      q.need = Math.min(need, 6);
      q.question = scText(q.question, 220);
      return true;
    }

    /* SELFCHECK - explain from memory, then judge the answer idea by idea.
       Needs 2-4 separate ideas; the model answer defaults to them joined. A
       code snippet keeps its line breaks (they are escaped line by line when
       drawn - esc() in lesson.html flattens newlines). */
    function sanitizeSelfCheck(q, qText) {
      if (!qText || qText.length < 8) return false;
      var seen = {}, ideas = [];
      (Array.isArray(q.ideas) ? q.ideas : []).forEach(function (it) {
        var v = scText(it && typeof it === 'object' ? (it.idea || it.text || '') : it, 90);
        var k = v.toLowerCase();
        if (v.length < 3 || seen[k]) return;
        seen[k] = 1;
        ideas.push(v);
      });
      if (ideas.length < 2) return false;
      q.ideas = ideas.slice(0, 4);
      q.modelAnswer = scText(q.modelAnswer, 420) || (q.ideas.join('; ') + '.');
      var code = String(q.code == null ? '' : q.code).replace(/\r\n?/g, '\n').replace(/\t/g, '  ');
      q.code = code.split('\n').slice(0, 14).map(function (l) { return l.slice(0, 80).replace(/\s+$/, ''); })
        .join('\n').replace(/^\n+|\n+$/g, '');
      q.question = scText(q.question, 260);
      return true;
    }

    /* CONCEPTMAP - 4-7 nodes, labelled links, 2-3 blanks. Refused when the map
       cannot be graded honestly:
         - not connected (a node floating alone has nothing to recall it by);
         - node 0, the hub, blanked or missing;
         - a blank with no visible neighbour (it is a guess, not a recall);
         - two blanks with the same propositions ("Photosynthesis -makes-> ?"
           twice): whichever way round the learner puts them, one is wrong;
         - a blank's own words printed elsewhere on the map. */
    function sanitizeConceptMap(q) {
      var nodes = [], idx = {}, seen = {};
      (Array.isArray(q.nodes) ? q.nodes : []).forEach(function (n, i) {
        var v = scText(n && typeof n === 'object' ? (n.label || n.name || '') : n, 32);
        var k = v.toLowerCase();
        if (!v || seen[k]) return;
        seen[k] = 1; idx[i] = nodes.length; nodes.push(v);
      });
      if (nodes.length < 4 || nodes.length > 7 || idx[0] !== 0) return false;
      var links = [], pairs = {};
      (Array.isArray(q.links) ? q.links : []).forEach(function (l) {
        if (!l) return;
        var a = idx[parseInt(l.from, 10)], b = idx[parseInt(l.to, 10)];
        var lab = scText(l.label, 28);
        if (a === undefined || b === undefined || a === b || !lab || lab.split(' ').length > 5) return;
        var pk = Math.min(a, b) + '-' + Math.max(a, b);
        if (pairs[pk]) return;
        pairs[pk] = 1;
        links.push({ from: a, to: b, label: lab });
      });
      if (links.length > 9) return false;
      var adj = nodes.map(function () { return []; });
      links.forEach(function (l) { adj[l.from].push(l.to); adj[l.to].push(l.from); });
      var reach = { 0: 1 }, stack = [0], n = 1;
      while (stack.length) {
        var x = stack.pop();
        for (var y = 0; y < adj[x].length; y++) if (!reach[adj[x][y]]) { reach[adj[x][y]] = 1; n++; stack.push(adj[x][y]); }
      }
      if (n !== nodes.length) return false;
      var blanks = [];
      (Array.isArray(q.blanks) ? q.blanks : []).forEach(function (b) {
        var j = idx[parseInt(b, 10)];
        if (j === undefined || j === 0 || blanks.indexOf(j) !== -1) return;
        blanks.push(j);
      });
      blanks = blanks.slice(0, 3);
      if (blanks.length < 2) return false;
      function isBlank(i) { return blanks.indexOf(i) !== -1; }
      if (!blanks.every(function (b) { return adj[b].some(function (y) { return !isBlank(y); }); })) return false;
      function sig(b) {
        return links.filter(function (l) { return l.from === b || l.to === b; }).map(function (l) {
          var other = l.from === b ? l.to : l.from;
          return (l.from === b ? '>' : '<') + l.label.toLowerCase() + '|' + (isBlank(other) ? '?' : nodes[other].toLowerCase());
        }).sort().join(';');
      }
      var sigs = {};
      for (var s = 0; s < blanks.length; s++) {
        var g = sig(blanks[s]);
        if (sigs[g]) return false;
        sigs[g] = 1;
      }
      var shown = [q.question];
      nodes.forEach(function (nm, i) { if (!isBlank(i)) shown.push(nm); });
      links.forEach(function (l) { shown.push(l.label); });
      var shownW = scWords(shown.join(' '));
      if (blanks.some(function (b) { var k = scWords(nodes[b]); return k.length >= 5 && shownW.indexOf(k) !== -1; })) return false;
      var extra = scText(Array.isArray(q.extra) ? q.extra[0] : q.extra, 32);
      if (extra && seen[extra.toLowerCase()]) extra = '';
      q.nodes = nodes;
      q.links = links;
      q.blanks = blanks.sort(function (a, b) { return a - b; });
      q.extra = extra;
      q.question = scText(q.question, 160) || 'Complete the map.';
      return true;
    }

    /* WHOSRIGHT - two to four classmates, exactly one right. A name the model
       wrote anyway ("Maya: ...") is stripped; the app gives the names. */
    function sanitizeWhosRight(q, qText) {
      if (!qText) return false;
      var seen = {}, claims = [];
      (Array.isArray(q.claims) ? q.claims : []).forEach(function (c) {
        if (!c) return;
        var says = scText(typeof c === 'string' ? c : (c.says || c.claim || c.text), 220)
          .replace(/^[A-Z][a-z]{1,12}(\s+(says|thinks|said))?\s*:\s*/, '')
          .replace(/^["“]+|["”]+$/g, '');
        var k = says.toLowerCase();
        if (says.length < 8 || seen[k]) return;
        seen[k] = 1;
        claims.push({ says: says, right: c.right === true || c.right === 'true', why: scText(c.why, 280) });
      });
      if (claims.filter(function (c) { return c.right; }).length !== 1 || claims.length < 2) return false;
      if (claims.length > 4) {
        var keep = claims.filter(function (c) { return c.right; }).concat(claims.filter(function (c) { return !c.right; }).slice(0, 3));
        claims = claims.filter(function (c) { return keep.indexOf(c) !== -1; });
      }
      q.claims = claims;
      q.question = scText(q.question, 220);
      return true;
    }

    /* READCHART - 3-8 points of one quantity, then Part A (tap a bar or point)
       and/or Part B (what the pattern means). A "most/least" tap is CHECKED
       against the data and re-pointed at the true maximum or minimum - the
       one answer key in this file that can be verified rather than trusted.
       A tap about a change between points has no single bar to tap, so that
       Part A is dropped. */
    function sanitizeReadChart(q) {
      var ch = q.chart && typeof q.chart === 'object' ? q.chart : {};
      var pts = [], seenL = {};
      (Array.isArray(ch.points) ? ch.points : []).forEach(function (p) {
        if (!p) return;
        var lab = scText(p.label != null ? p.label : p.x, 14);
        var v = parseFloat(p.value != null ? p.value : p.y);
        if (!lab || !isFinite(v) || seenL[lab.toLowerCase()]) return;
        seenL[lab.toLowerCase()] = 1;
        pts.push({ label: lab, value: v });
      });
      if (pts.length < 3) return false;
      pts = pts.slice(0, 8);
      var vals = pts.map(function (p) { return p.value; });
      var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
      if (mx === mn) return false;                  // a flat line has no pattern to read
      q.chart = { kind: ch.kind === 'line' ? 'line' : 'bar', title: scText(ch.title, 60), x: scText(ch.x, 30),
                  y: scText(ch.y, 30), unit: scText(ch.unit, 12), data: ch.data === 'example' ? 'example' : 'notes',
                  points: pts };
      var find = scText(q.find, 140), fi = parseInt(q.findIndex, 10);
      if (!find || !(fi >= 0 && fi < pts.length)) find = '';
      else if (/\b(increas\w*|rise|rises|rose|grow\w*|drop\w*|fall|falls|fell|declin\w*|chang\w*)\b/i.test(find)) find = '';
      else if (/\b(most|highest|largest|greatest|biggest|maximum|peak|wettest|hottest|warmest|longest|fastest|busiest)\b/i.test(find)) {
        if (vals.filter(function (v) { return v === mx; }).length !== 1) find = ''; else fi = vals.indexOf(mx);
      } else if (/\b(least|lowest|smallest|fewest|minimum|driest|coldest|coolest|shortest|slowest|quietest)\b/i.test(find)) {
        if (vals.filter(function (v) { return v === mn; }).length !== 1) find = ''; else fi = vals.indexOf(mn);
      }
      q.find = find;
      q.findIndex = find ? fi : -1;
      var raw = Array.isArray(q.options) ? q.options : [], opts = [], ci = parseInt(q.correctIndex, 10), nci = -1;
      raw.forEach(function (o, i) { var t = scText(o, 200); if (t) { if (i === ci) nci = opts.length; opts.push(t); } });
      var stemB = scText(q.question, 240);
      if (stemB && opts.length >= 2 && nci !== -1) { q.question = stemB; q.options = opts; q.correctIndex = nci; }
      else { q.question = ''; q.options = []; q.correctIndex = -1; }
      return !!(q.find || q.question);
    }

    /* ── QUESTION LINT (Oct 2026) ─────────────────────────────────────────
       Checks that need no model call, for the choice cards (mcq, scenario,
       passage) and true/false. What it replaced:
       - a missing or out-of-range correctIndex became 0, so a card with no
         key was graded against option A, confidently and wrongly;
       - short option lists were padded with "Option 3", "Option 4" - junk
         distractors on a real question;
       - options were never shuffled, so the model's own position habit
         (it favours B and C) reached the learner unchanged;
       - "All of the above" survived, and means nothing once options move;
       - two near-identical options, one marked right, one wrong.
       Flags it cannot fix (the right answer is much the longest option) go in
       q._lint for the review harness; they never drop a card.
       opts.edit: a teacher's own edit - keep their order and wording, check
       only that the card can be graded. */
    var LINT_NOTA = /^\s*(all|none|both|neither)\s+of\s+(the\s+)?(above|these|them|those|the\s+options|the\s+answers)\b|^\s*(both\s+|only\s+)?[a-d]\s*(and|&|,)\s*[a-d]\b|^\s*(answers?|options?)\s+[a-d]\s+and\s+[a-d]\b/i;
    function lintKey(s) {
      return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9À-￿]+/g, ' ').trim();
    }
    function lintWords(s) {
      var out = {}, n = 0;
      lintKey(s).split(' ').forEach(function (w) { if (w.length > 2 && !out[w]) { out[w] = 1; n++; } });
      return { set: out, n: n };
    }
    function lintOverlap(a, b) {
      var A = lintWords(a), B = lintWords(b), both = 0, k;
      if (!A.n || !B.n) return 0;
      for (k in A.set) if (B.set[k]) both++;
      return both / (A.n + B.n - both);
    }
    function lintSame(a, b) {
      var ka = lintKey(a), kb = lintKey(b);
      if (ka && ka === kb) return true;
      var A = lintWords(a), B = lintWords(b);
      return A.n >= 3 && B.n >= 3 && lintOverlap(a, b) >= 0.85;
    }
    function lintFlag(q, f) { (q._lint = q._lint || []).indexOf(f) === -1 && q._lint.push(f); }
    /* The key, from whatever field the model put it in. -1 when there is none. */
    function lintFindKey(q, opts) {
      var idx = q.correctIndex;
      if (typeof idx === 'string' && /^\s*\d+\s*$/.test(idx)) idx = parseInt(idx, 10);
      if (typeof idx === 'number' && idx >= 0 && idx < opts.length && String(opts[idx] || '').trim()) return idx;
      var L = String(q.correctLetter || q.correctAnswer || q.answer || q.correct || '').trim(), i;
      if (/^[A-Ha-h]$/.test(L)) { i = L.toUpperCase().charCodeAt(0) - 65; if (i < opts.length && String(opts[i] || '').trim()) return i; }
      if (L) for (i = 0; i < opts.length; i++) if (lintKey(opts[i]) && lintKey(opts[i]) === lintKey(L)) return i;
      return -1;
    }
    function lintChoice(q, opts) {
      var edit = opts && opts.edit;
      var raw = (Array.isArray(q.options) ? q.options : []).map(function (o) {
        return o && typeof o === 'object' ? String(o.text || o.label || o.option || '') : o;   // {text:...} options
      });
      var key = lintFindKey(q, raw);
      if (key === -1) return false;              // no key: ungradeable, never "assume A"
      var right = String(raw[key]).trim();
      if (!edit && LINT_NOTA.test(right)) return false;   // its meaning was its position
      var wrong = [];
      raw.forEach(function (o, i) {
        if (i === key) return;
        var t = String(o == null ? '' : o).trim();
        if (!t || /^option\s*\d+$/i.test(t)) return;
        if (!edit && LINT_NOTA.test(t)) { lintFlag(q, 'nota-removed'); return; }
        if (lintSame(t, right)) { lintFlag(q, 'dup-of-answer'); return; }
        for (var j = 0; j < wrong.length; j++) if (lintSame(t, wrong[j])) { lintFlag(q, 'dup-option'); return; }
        wrong.push(t);
      });
      if (!wrong.length) return false;
      /* Much the longest is the classic test-wise giveaway. Flag, never fix:
         rewriting a distractor needs the model. */
      var longest = 0;
      wrong.forEach(function (w) { if (w.length > longest) longest = w.length; });
      if (right.length > 24 && right.length > longest * 1.6) lintFlag(q, 'answer-longest');
      if (edit) {
        var kept = [], nk = -1;
        raw.forEach(function (o, i) {
          var t = String(o == null ? '' : o).trim();
          if (i === key) { nk = kept.length; kept.push(right); }
          else if (wrong.indexOf(t) !== -1 && kept.indexOf(t) === -1) kept.push(t);
        });
        q.options = kept; q.correctIndex = nk;
      } else {
        q.options = [right].concat(wrong.slice(0, 4)); q.correctIndex = 0;   // placed by lintSpread
      }
      return true;
    }
    function lintTrueFalse(q) {
      var c = q.correct;
      if (c === true || /^\s*true\s*$/i.test(String(c))) { q.correct = 'True'; return true; }
      if (c === false || /^\s*false\s*$/i.test(String(c))) { q.correct = 'False'; return true; }
      var a = String(q.answer == null ? '' : q.answer).trim();
      if (/^true$/i.test(a)) { q.correct = 'True'; return true; }
      if (/^false$/i.test(a)) { q.correct = 'False'; return true; }
      return false;                              // was: defaulted to True
    }
    /* Shuffle each card's options, with the RIGHT answer's slot dealt so the
       day's keys spread across A-D rather than landing at random (four cards
       at random put three keys in one slot about a third of the time). */
    function lintSpread(list) {
      var start = Math.floor(Math.random() * 4), k = 0;
      list.forEach(function (q) {
        if (!q || q._lintPlace !== 1) return;
        delete q._lintPlace;
        var n = q.options.length, right = q.options[0], wrong = q.options.slice(1), i, j, t;
        for (i = wrong.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = wrong[i]; wrong[i] = wrong[j]; wrong[j] = t; }
        var at = (start + k++) % n;
        wrong.splice(at, 0, right);
        q.options = wrong; q.correctIndex = at;
      });
    }
    /* The same question twice in one day: same type, near-identical stem.
       Only where the stem IS the question. A passage, scenario, chart or map
       card carries a generic stem ("What is the main idea?", "What does the
       pattern show?") over different material, and two of those are not
       repeats - this cut a test's second readchart before it was narrowed. */
    var LINT_STEM_IS_Q = { mcq: 1, truefalse: 1, fill: 1 };
    function lintRepeats(list) {
      var seen = [];
      return list.filter(function (q) {
        if (!LINT_STEM_IS_Q[q.type]) return true;
        var stem = String(q.question || '');
        if (lintWords(stem).n < 4) return true;
        for (var i = 0; i < seen.length; i++) {
          if (seen[i].type === q.type && lintOverlap(stem, seen[i].stem) >= 0.85) return false;
        }
        seen.push({ type: q.type, stem: stem });
        return true;
      });
    }
    function lintTFBalance(list) {
      var tf = list.filter(function (q) { return q.type === 'truefalse'; });
      if (tf.length >= 3 && tf.every(function (q) { return q.correct === tf[0].correct; }))
        tf.forEach(function (q) { lintFlag(q, 'tf-all-' + tf[0].correct.toLowerCase()); });
    }
    /* One question, for the mid-session top-up, which does not run the whole
       day validator. True = keep. Placement is that call's job (lintDay). */
    function lintQuestion(q) {
      if (!q || !q.type) return false;
      if (q.type === 'mcq' || q.type === 'scenario' || q.type === 'passage') {
        if (!lintChoice(q)) return false;
        q._lintPlace = 1;
        return true;
      }
      if (q.type === 'truefalse') return lintTrueFalse(q);
      return true;
    }
    function lintDay(list) {
      list = lintRepeats(list);
      lintSpread(list);
      lintTFBalance(list);
      return list;
    }

    function sanitizeDayQuestions(day, sopts) {
      var edit = !!(sopts && sopts.edit);
      if (!day) return day;
      if (!Array.isArray(day.questions)) { day.questions = []; return day; }
      var PH = /^\[.*\]$|^real |^exact |^specific |^numerical answer|^your answer|^formula here/i;
      day.questions = day.questions.filter(function(q) {
        if (!q || !q.type) return false;
        // Must have some question text
        var qText = (q.question || q.scenario || '').trim();

        if (q.type === 'mcq' || q.type === 'passage' || q.type === 'scenario') {
          if (q.type === 'passage' && (!q.passage || q.passage.trim().length < 5)) return false;
          /* Was: any 2 non-empty options, a missing key set to 0, and padding
             to four with "Option N". See QUESTION LINT above. */
          if (!lintChoice(q, { edit: edit })) return false;
          if (!edit) q._lintPlace = 1;
          return true;
        }
        if (q.type === 'truefalse') {
          if (!qText) return false;
          return lintTrueFalse(q);               // was: an unknown key defaulted to True
        }
        if (q.type === 'sentence') return Array.isArray(q.words) && q.words.length >= 2 && q.words.filter(function(w){ return w && String(w).trim(); }).length >= 2;
        if (q.type === 'errorspot') {
          if (!Array.isArray(q.steps) || q.steps.length < 2) return false;
          var validSteps = q.steps.filter(function(s){ return s && s.text && s.text.trim(); });
          if (validSteps.length < 2) return false;
          var errCount = q.steps.filter(function(s){ return s.hasError; }).length;
          if (errCount !== 1) return false;
          return true;
        }
        if (q.type === 'classify') return !!(q.categoryA && q.categoryB && Array.isArray(q.itemsA) && Array.isArray(q.itemsB) && q.itemsA.filter(function(i){ return i && String(i).trim(); }).length >= 2 && q.itemsB.filter(function(i){ return i && String(i).trim(); }).length >= 2);
        if (q.type === 'sequence') return Array.isArray(q.items) && q.items.filter(function(i){ return i && String(i).trim(); }).length >= 3;
        if (q.type === 'fill' || q.type === 'bigequation' || q.type === 'wordproblem') {
          if (!qText) return false;
          // Accept even if answer is empty — better to show question than strip it
          /* ── THIS IS WHERE BIG EQUATIONS WERE DISAPPEARING ────────────────
             A bigequation whose "equation" field was empty used to be demoted
             to fill. The very next block then rejects any fill question whose
             text starts with an instruction verb - and INSTRUCTION_START
             includes "solve" and "calculate". So a question like

               {type:"bigequation", question:"Solve 3x - 7 = 14", equation:""}

             was demoted, then DELETED. The model routinely puts the expression
             in `question` rather than `equation`, so an entire maths day could
             lose all five of its equation questions before it was ever saved,
             and the learner saw only the leftover multiple choice.

             Recover the equation from the question text instead. Only fall
             back to fill when there is genuinely no expression anywhere. */
          if (q.type === 'bigequation' && (!q.equation || q.equation.trim().length < 1)) {
            /* Read the QUESTION only. An earlier attempt appended the answer to
               the search text, so "Solve 3x - 7 = 14 for x" with answer "7"
               produced the equation "3x - 7 = 14 for x 7" - the answer printed
               inside the box the learner is meant to solve. */
            var qsrc = String(q.question || '');

            /* Drop the leading imperative and any trailing "for x" first, so
               what remains is the expression itself. */
            var body = qsrc
              .replace(/^\s*(?:solve|simplify|evaluate|expand|factor|compute|calculate|find|determine)\b\s*/i, '')
              .replace(/^(?:the\s+value\s+of|for)\s+/i, '')
              .replace(/\s+for\s+[a-z]\b\s*$/i, '')
              .replace(/[\s.?]+$/, '')
              .trim();

            /* Prefer a complete equation; fall back to a bare expression. */
            var eqm = body.match(/[-0-9a-zA-Z(][^,;?]{0,40}?(?:=|<=|>=)[^,;?]{0,40}/);
            var picked = eqm ? eqm[0] : '';
            if (!picked) {
              var exm = body.match(/[-0-9(][0-9a-zA-Z\s+\-*\/^().]{2,40}/);
              picked = exm ? exm[0] : '';
            }

            /* Keep a substitution clause: in "5x when x = 4" the "when x = 4"
               IS the problem, and dropping it left the box reading just "5x",
               which cannot be evaluated. Only strip a trailing clause that
               carries no value of its own. */
            picked = String(picked).trim();
            var tail = picked.match(/\s+(when|where|given|if)\b([\s\S]*)$/i);
            if (tail && tail[2].indexOf('=') === -1) {
              picked = picked.slice(0, tail.index);
            } else if (tail) {
              /* Normalise "5x when x = 4" to the compact "5x, x = 4". */
              picked = picked.slice(0, tail.index) + ', ' + tail[2].trim();
            }
            picked = picked.replace(/\s+(?:and|then)\b[\s\S]*$/i, '')
                           .replace(/[\s.,;?]+$/, '')
                           .trim();

            /* Must still look like maths: a digit or an operator, and short. */
            if (picked.length >= 2 && picked.length <= 44 &&
                /[0-9]/.test(picked) && /[a-z0-9)]/i.test(picked)) {
              q.equation = picked;
            }
            /* Nothing mathematical survived: it was never an equation question. */
            if (!q.equation || q.equation.length < 2) q.type = 'fill';
          }
          if (q.type === 'fill') {
            // A fill question must be a declarative sentence with one blank —
            // not an instruction like "Order these events ______". The model
            // ignores this rule often enough that it has to be enforced here.
            var INSTRUCTION_START = /^\s*(order|arrange|sort|match|list|choose|select|identify|explain|describe|compare|contrast|solve|calculate|draw|label|rank|group|classify|put|place|write|name)\b/i;
            if (INSTRUCTION_START.test(qText)) return false;
            // Answer must be a term/short phrase, not a sentence.
            var ans = String(q.answer || '').trim();
            if (!ans || ans.length > 60 || ans.split(/\s+/).length > 8) return false;
            // Normalize any blank marker variant to the canonical ________
            var normalized = qText
              .replace(/_{2,}/g, '________')
              .replace(/\[\s*blank\s*\]/gi, '________')
              .replace(/\.{3,}/g, '________');
            // If no blank survived but the answer appears in the sentence,
            // convert that occurrence into the blank.
            if (normalized.indexOf('________') === -1) {
              var re = new RegExp(ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
              if (re.test(normalized)) normalized = normalized.replace(re, '________');
              else return false; // no blank and no way to make one
            }
            // Needs real sentence context around the blank. A Chinese,
            // Japanese or Korean character carries about a word, so three of
            // them are enough: "我___学生。" is a whole sentence in four
            // characters, and the 15-character test dropped every CJK fill-in.
            var ctx = normalized.replace(/________/g, '').trim();
            var cjk = (ctx.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
            if (cjk ? cjk < 3 : ctx.length < 15) return false;
            q.question = normalized;
          }
          return true;
        }
        if (q.type === 'twopart') {
          var tpO = (q.options || []).filter(function(o){ return o && String(o).trim(); });
          var tpR = (q.reasons || []).filter(function(o){ return o && String(o).trim(); });
          if (!qText || tpO.length < 2 || tpR.length < 2) return false;
          if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) q.correctIndex = 0;
          if (typeof q.reasonIndex !== 'number' || q.reasonIndex < 0 || q.reasonIndex >= q.reasons.length) q.reasonIndex = 0;
          return true;
        }
        if (q.type === 'corroborate') {
          var sA = q.sourceA || {}, sB = q.sourceB || {};
          if (String(sA.text || '').trim().length < 15 || String(sB.text || '').trim().length < 15) return false;
          var coO = (q.options || []).filter(function(o){ return o && String(o).trim(); });
          if (!qText || coO.length < 2) return false;
          if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) q.correctIndex = 0;
          return true;
        }
        if (q.type === 'highlight') {
          var hs = (q.sentences || []).filter(function(o){ return o && String(o).trim(); });
          if (!qText || hs.length < 3) return false;
          q.sentences = q.sentences.filter(function(o){ return o && String(o).trim(); });
          if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.sentences.length) q.correctIndex = 0;
          return true;
        }
        if (q.type === 'tracetable') {
          if (!qText || !Array.isArray(q.columns) || q.columns.length < 2) return false;
          if (!Array.isArray(q.rows)) return false;
          /* Every row must be as wide as the header, or the blank column lands
             on a cell that does not exist and the card renders a short row. */
          q.rows = q.rows.filter(function(r){ return Array.isArray(r) && r.length === q.columns.length; });
          if (q.rows.length < 2) return false;
          if (typeof q.blankCol !== 'number' || q.blankCol < 0 || q.blankCol >= q.columns.length) q.blankCol = q.columns.length - 1;
          /* The blanked cells are the answer key: a row with nothing there
             cannot be graded. */
          var bc = q.blankCol;
          if (q.rows.some(function(r){ return !String(r[bc] == null ? '' : r[bc]).trim(); })) return false;
          return true;
        }
        if (q.type === 'matchpairs') {
          var pp = (q.pairs || []).filter(function(p){ return p && String(p.left || '').trim() && String(p.right || '').trim(); });
          if (pp.length < 3) return false;
          /* Two identical right-hand values make two rows indistinguishable,
             so one of them is graded wrong whatever the learner picks. */
          var seenR = {}, k2;
          for (k2 = 0; k2 < pp.length; k2++) {
            var rv = String(pp[k2].right).trim().toLowerCase();
            if (seenR[rv]) return false;
            seenR[rv] = 1;
          }
          q.pairs = pp;
          return true;
        }
        if (q.type === 'labeldiagram') {
          /* Needs a drawing AND pins that sit on it. The renderer checks the
             drawing again through SFSceneKit - that is the security boundary
             and it stays - but a card with two pins in the same spot, or an
             answer repeated across pins, is ungradeable however well it
             draws, so it is refused here. */
          var dw = q.drawing || q.diagram;
          if (!dw || !Array.isArray(dw.shapes) || dw.shapes.length < 4) return false;
          var W = Number(dw.w) || 440, H = Number(dw.h) || 250;
          var seenA = {}, pins = (q.pins || []).filter(function (pn) {
            if (!pn) return false;
            var a = String(pn.answer || '').trim();
            var px = parseFloat(pn.x), py = parseFloat(pn.y);
            if (!a || !isFinite(px) || !isFinite(py)) return false;
            if (px < 0 || px > W || py < 0 || py > H) return false;   // pin off the picture
            var key = a.toLowerCase();
            if (seenA[key]) return false;      // same label on two pins: ungradeable
            seenA[key] = 1;
            pn.x = px; pn.y = py; pn.answer = a;
            return true;
          });
          if (pins.length < 2) return false;
          q.pins = pins.slice(0, 6);
          q.options = (q.options || []).filter(function (o) { return String(o || '').trim(); });
          return true;
        }
        /* The blank must be ONE whole word of the sentence, or the gap cannot be
           drawn and the card has no answer. */
        if (q.type === 'dictation') {
          var dt = String(q.text || '').replace(/\s+/g, ' ').trim();
          var db = String(q.blank || '').replace(/^[\s¿¡"“«]+|[\s.!?,;:"”»]+$/g, '');
          /* "我是学生。" is a sentence in five characters. */
          var dMin = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(dt) ? 4 : 8;
          if (dt.length < dMin || dt.length > 140 || !db || /\s/.test(db)) return false;
          var dWords = dt.split(' ').map(function (w) { return w.replace(/^[¿¡"“«(]+|[.!?,;:"”»)]+$/g, '').toLowerCase(); });
          /* The blank is one whole word - or the word after an elision
             ("l'école", "dell'acqua"), or, in a script written without
             spaces (Chinese, Japanese), any run of the sentence. Both were
             dropped: a French dictation on "école" and every Chinese one. */
          var dbl = db.toLowerCase(), dOk = dWords.indexOf(dbl) !== -1;
          if (!dOk) dOk = dWords.some(function (w) { return w.split(/['’]/).pop() === dbl && w !== dbl; });
          if (!dOk && /[\u3040-\u30ff\u3400-\u9fff]/.test(db)) dOk = dt.indexOf(db) !== -1 && dt.replace(db, '').replace(/[\s。、！？.!?]/g, '').length > 0;
          if (!dOk) return false;
          q.text = dt; q.blank = db;
          q.translation = String(q.translation || '').trim().slice(0, 160);
          if (!String(q.question || '').trim()) q.question = 'Listen and type the missing word.';
          return true;
        }
        if (q.type === 'estimate') {
          if (!qText) return false;
          var ev = parseFloat(q.answer);
          if (!isFinite(ev)) return false;
          q.answer = ev;
          var et = parseFloat(q.tolerance);
          /* Zero tolerance would make this an exact-answer card wearing an
             estimate label. */
          q.tolerance = (isFinite(et) && et > 0) ? et : Math.abs(ev) * 0.1;
          return true;
        }
        if (q.type === 'readingset') {
          if (String(q.passage || '').trim().length < 120) return false;
          if (!Array.isArray(q.questions)) return false;
          q.questions = q.questions.filter(function(sq){
            if (!sq || !String(sq.question || '').trim()) return false;
            if (!Array.isArray(sq.options)) return false;
            var o = sq.options.filter(function(x){ return x && String(x).trim(); });
            if (o.length < 2) return false;
            while (sq.options.length < 4) sq.options.push('Option ' + (sq.options.length + 1));
            if (typeof sq.correctIndex !== 'number' || sq.correctIndex < 0 || sq.correctIndex >= sq.options.length) sq.correctIndex = 0;
            return true;
          });
          /* A passage with one question is just a long passage card - the
             point of the format is several questions against one text. */
          return q.questions.length >= 2;
        }
        if (q.type === 'write') {
          if (!(qText && qText.length > 3)) return false;
          /* An argument needs a question worth arguing and a model case to
             compare against; without one it is a teach-it-back card. */
          if (q.mode === 'claim') {
            if (!String(q.modelAnswer || '').trim()) q.mode = '';
            q.source = String(q.source || '').trim().slice(0, 600);
          } else if (q.mode) q.mode = '';
          return true;
        }
        /* A passage card is the passage. Without one the learner gets an empty
           quote block above four options about a text they were never shown -
           and nothing else validated this, because passage fell through to the
           unknown-type catch-all below, which only checks the question text. */
        if (q.type === 'passage') {
          if (String(q.passage || '').trim().length < 20) return false;
          return !!(qText && Array.isArray(q.options) && q.options.length >= 2);
        }
        /* ── The five formats of Oct 2026. Each is refused here rather than
           rendered broken: a card whose answer key cannot be graded teaches
           the wrong thing more confidently than no card at all. ── */
        if (q.type === 'recall')     return sanitizeRecall(q, qText);
        if (q.type === 'selfcheck')  return sanitizeSelfCheck(q, qText);
        if (q.type === 'conceptmap') return sanitizeConceptMap(q);
        if (q.type === 'whosright')  return sanitizeWhosRight(q, qText);
        if (q.type === 'readchart')  return sanitizeReadChart(q);
        // Unknown types — keep if they have question text
        return qText.length > 3;
      });
      if (edit) day.questions.forEach(function (q) { delete q._lintPlace; });
      else day.questions = lintDay(day.questions);
      // If sanitize stripped everything, build fallback questions from keyTerms
      if (day.questions.length === 0 && Array.isArray(day.keyTerms) && day.keyTerms.length >= 2) {
        day.keyTerms.forEach(function(t) {
          if (t && t.term && t.definition) {
            day.questions.push({
              type: 'fill',
              question: t.term + ' is defined as _______',
              answer: t.definition.substring(0, 80),
              hint: 'Think about what ' + t.term + ' means',
              explanation: t.definition,
              difficulty: 'Easy'
            });
          }
        });
      }
      return day;
    }

    // ── 6-layer JSON repair ──
    function repairJSON(raw) {
      var m = raw.match(/\{[\s\S]*/);
      if (!m) return null;
      var s = m[0]
        .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-').replace(/\u00A0/g, ' ')
        .replace(/\\'/g, "'").replace(/\t/g, ' ')
        .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, function(x){ return x.replace(/\n/g,' ').replace(/\r/g,' '); });
      try { return JSON.parse(s); } catch(e) {}
      var r = s.replace(/,\s*([}\]])/g, '$1');
      var ob=(r.match(/\{/g)||[]).length, cb=(r.match(/\}/g)||[]).length;
      var oa=(r.match(/\[/g)||[]).length, ca=(r.match(/\]/g)||[]).length;
      var i;
      for(i=0;i<oa-ca;i++) r+=']';
      for(i=0;i<ob-cb;i++) r+='}';
      try { return JSON.parse(r); } catch(e) {}
      var qi = r.indexOf('"questions":[');
      if (qi !== -1) {
        var pos = r.indexOf('[', qi)+1, last = pos, d = 0, ci;
        for(ci=pos; ci<r.length; ci++){
          if(r[ci]==='{') d++; else if(r[ci]==='}'){d--; if(d===0) last=ci+1;}
        }
        try { return JSON.parse(r.substring(0, last)+']}'); } catch(e) {}
      }
      var title   = (raw.match(/"title"\s*:\s*"([^"]{1,80})"/) ||[])[1];
      var brief   = (raw.match(/"briefing"\s*:\s*"([^"]{1,200})"/) ||[])[1];
      var content = (raw.match(/"content"\s*:\s*"([^"]{1,400})"/) ||[])[1];
      var qs = [];
      (raw.match(/\{"type":"[^"]+","question":"[^}]{5,300}?"difficulty":"[^"]+"\}/g)||[])
        .forEach(function(qs2){ try{ var q=JSON.parse(qs2); if(q.type) qs.push(q); }catch(e){} });
      return { title:title||'Study Session', briefing:brief||'', content:content||'',
               keyTerms:[], steps:[], concepts:[], diagram:{type:'none',label:''},
               microTopic:'', duration:30, isFinal:false, completed:false, questions:qs };
    }

  window.SFQuestions = {
    qtpl: qtpl,
    buildQuestionSchema: buildQuestionSchema,
    QTYPE_NAME: QTYPE_NAME,
    tallyFor: tallyFor,
    scText: scText,
    sanitizeDayQuestions: sanitizeDayQuestions,
    lintQuestion: lintQuestion,
    lintDay: lintDay,
    repairJSON: repairJSON
  };
})();

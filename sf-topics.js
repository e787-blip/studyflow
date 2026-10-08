/* sf-topics.js - StudyFlow's subtopic skill.

   ONE file that works out what a learner's notes are made of, for ANY
   subject - including one this app has never heard of - and turns that into
   the per-day question mixes the plan is generated from.

   Why it exists. The subtopics used to be premade: 25 entries in SUBTOPICS
   (app.html), each chosen by counting keywords. Measured on ten subjects,
   EIGHT fell straight through to "general" - music theory, contract law,
   nursing pharmacology, cooking, ethics, accounting, a driving test, and
   even astronomy - and every one of them got the same generic
   "3 MCQ, 2 True/False, 2 Fill, 1 Write" day. The two that did match were
   no better: a photosynthesis plan was split between "life science" and
   "physical science" because the notes said "light". A keyword list can
   only recognise what someone thought to type into it.

   So the model reads the notes and describes them, and the code decides:

     THE MODEL SAYS              THE CODE DECIDES
     what the subject is         which of the ten families it is held to
     what its parts are          how parts are grouped when days are short
     each part's kind            the question mix, from the rule tables below
     what material each has      which formats the material can honestly carry
     what a good question asks   (passed through, capped, one line)

   The model NEVER picks a question type. It describes what is in the notes
   ("these are dated events", "this is a thing with parts"), and a format is
   only allowed when the material can carry it: an ordering card needs a
   real order (invariant 6), a labelling card needs a thing with parts, a
   word problem needs an economics plan (invariant 8). A model that
   under-reports costs a plainer mix, never a broken one.

   The tree it builds, and how "generalise" works:

     family  (one of the app's ten - what the invariants key on)
       field     "Music"                  the broad discipline
         parent    "Harmony"              the bigger topic a part sits under
           subtopic  "Intervals"          what a day teaches
             covers    "major third"...   the specific things in it

   A plan shorter than its list of parts merges siblings under their shared
   PARENT, and past that under the FIELD, so nothing in the notes is left
   without a day. A part that is squarely one of the 25 premade subtopics
   may name it ("like"), and then inherits that subtopic's research-tuned
   mix - the premade list is now the set of known shapes a new part can be
   generalised under, not the set of things the app can teach.

   What is here:
     SFTopics.prompt(facts)        the one prompt: notes -> the tree
     SFTopics.request(prompt, ms)  api/generate -> Promise of the parsed
                                   object; REJECTS on a failed call
     SFTopics.judge(raw, ctx)      the only way a model answer becomes a plan's
                                   subtopics: validates, applies the family
                                   policy, fits the parts to the days,
                                   composes every mix. null = use the old way.
     SFTopics.compose(kind, material, family, inherited)   one mix, pure

   ES5, no DOM, no dependencies: it must parse before app.html's own script
   runs, and it runs under plain Node for the tests. */
(function (w) {
  'use strict';

  var VERSION = 1;
  /* Rotation cap. A 14-day plan with seven real parts would teach each for
     two days; more than six is a plan that never returns to anything. */
  var MAX_SUBTOPICS = 6;
  /* The same 8 000 characters the day prompts see (NOTES_PROMPT_CAP in
     app.html). A part that only exists past that point could never be
     taught, because no day would ever read it. */
  var NOTES_CAP = 8000;
  /* How many parts the model's answer may list. The prompt asks for 1-6;
     two more are read in case it over-splits, because a merged part names
     every part it absorbed in its covers, and that list is capped here too -
     so the cap is what guarantees no part is ever dropped by a merge. */
  var MAX_PARTS = 8;

  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  /* Everything the model writes goes into later prompts and onto the build
     screen, so it is flattened to one line, capped, and stripped of angle
     brackets. Objects and arrays are not strings and come back empty. */
  function clean(v, n) {
    if (v == null || typeof v === 'object' || typeof v === 'function') return '';
    var s = String(v).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
                     .replace(/[<>]/g, '')
                     .replace(/\s{2,}/g, ' ')
                     .replace(/^\s+|\s+$/g, '');
    if (s.length > n) {
      s = s.slice(0, n);
      var cut = s.lastIndexOf(' ');
      if (cut > n * 0.6) s = s.slice(0, cut);
      s = s.replace(/[\s,;:\-\u2013\u2014]+$/, '');
    }
    return s;
  }

  /* A rule the model writes ("Ask: count the half steps.") is stored without
     its own label and full stop, because the guide adds both. */
  function cleanRule(v, n, prefix) {
    var s = clean(v, n + 20);
    if (prefix) s = s.replace(prefix, '');
    s = s.replace(/[.\s]+$/, '');
    return clean(s, n);
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  /* ── WHAT THE MODEL IS ASKED TO CHOOSE FROM ───────────────────────────── */

  /* The ten families every downstream table in lesson.html is keyed on
     (PALETTE_FALLBACK, getFeynmanTip, wordProblemHeading, QUANTITATIVE_
     SUBJECTS, the top-up's format rules). A new subject still has to land
     in one of them, and "general" is an honest answer. */
  var FAMILIES = {
    science:    'natural science: biology, chemistry, physics, earth and space, the body and health',
    history:    'history, and how government and civic institutions work',
    english:    'reading, writing and literature in English',
    language:   'learning another language: Spanish, French, Japanese and so on',
    geography:  'places, landscapes, climate and where people live',
    psychology: 'the mind and behaviour',
    economics:  'money, markets, business, personal finance and accounting',
    cs:         'programming, algorithms and how computers work',
    math:       'mathematics itself - not a subject that merely uses numbers',
    general:    'anything else: music, art, cooking, sport, law, a trade, a licence test, a hobby'
  };

  var KINDS = {
    mechanism:      'how or why something works: causes, effects, processes',
    procedure:      'how to do something: a method, technique or calculation',
    facts:          'things to remember: names, terms, features, definitions',
    interpretation: 'reading a text or source and arguing what it shows',
    application:    'applying a rule, theory or principle to a case',
    language:       'using another language: its words, grammar and sentences'
  };

  /* Each flag is a promise that the notes contain something a particular
     kind of question can be written FROM. That is the whole contract: see
     NEEDS below. */
  var MATERIALS = {
    order:       'steps or stages whose order matters',
    dates:       'dated events',
    parts:       'a physical thing with named parts you could point at in a picture',
    numbers:     'real figures or quantities that the subject gives meaning to',
    calculation: 'numbers worked through step by step with a rule or formula',
    procedure:   'a method done in steps, where one step could be done wrong',
    code:        'program code or pseudocode',
    sources:     'primary sources, accounts or viewpoints that could disagree',
    text:        'a passage, poem or text to read closely',
    sentences:   'sentences to build or correct, in a language or its grammar',
    categories:  'two groups that are easy to confuse',
    cases:       'rules or principles to apply to real situations',
    places:      'real named places'
  };

  /* Phrased to follow "For this topic in particular, prefer " in the day
     prompt's diagram section. */
  var PICTURES = {
    flow:      'a flow for the steps or the chain of causes.',
    cycle:     'a cycle, since the last stage feeds the first.',
    timeline:  'a timeline for anything dated.',
    parts:     'parts, or a drawing, for the thing and its components.',
    compare:   'compare, for the two things set against each other.',
    hierarchy: 'a hierarchy for ranked or nested levels.',
    graph:     'a graph for how one quantity changes with another.',
    map:       'a map, but only with real place names the notes use.',
    concept:   'a concept hub around the central idea.',
    drawing:   'a drawing of the real thing, as it looks.'
  };

  /* ── THE MIX RULES (see docs/question-design.md) ─────────────────────── */

  /* The types that have renderers in lesson.html. bigequation is absent on
     purpose: maths never reaches this file (its mix is MATH_MIX and the
     synthesis floor - invariant 1). */
  var KNOWN = { mcq: 1, truefalse: 1, fill: 1, write: 1, classify: 1, sequence: 1,
                sentence: 1, passage: 1, errorspot: 1, scenario: 1, wordproblem: 1,
                twopart: 1, corroborate: 1, highlight: 1, tracetable: 1,
                matchpairs: 1, estimate: 1, readingset: 1, labeldiagram: 1,
                dictation: 1 };

  /* Producing an answer vs choosing one - the same split as §7 of the
     research doc. A dictation is typed from what was heard. */
  var PRODUCE = { fill: 1, write: 1, sentence: 1, estimate: 1, tracetable: 1, wordproblem: 1,
                  dictation: 1 };

  /* Formats a FAMILY rules in or out, whatever the material says.
       - dictation is read aloud in the language being learned, and
         lesson.html only knows that language on a language day (targetLang);
       - history has no true/false at all (docs/question-design.md §9: the
         thinnest multiple-choice item there is, and the one that drew the
         most test-taking thinking in think-alouds). */
  var ONLY_FAMILY = { dictation: 'language' };
  var NEVER_FAMILY = { history: { truefalse: 1 } };

  /* A format that needs something from the material, or it cannot be
     written honestly. ANY one of the listed flags is enough. A format not
     listed needs nothing. Looked up by full entry first
     ("sequence:parsons"), then by type. */
  var NEEDS = {
    labeldiagram:        ['parts'],
    'sequence:parsons':  ['code'],
    sequence:            ['order', 'dates'],
    tracetable:          ['calculation', 'code'],
    errorspot:           ['procedure', 'code', 'calculation'],
    estimate:            ['numbers', 'calculation'],
    wordproblem:         ['numbers', 'calculation'],
    corroborate:         ['sources', 'text'],
    passage:             ['sources', 'text'],
    readingset:          ['text', 'sources'],
    'twopart:passage':   ['text', 'sources'],
    sentence:            ['sentences'],
    dictation:           ['sentences'],
    classify:            ['categories']
  };

  /* At most one of these per day: each is a large or distinctive card, and
     two ordering cards or two labelling cards in one session is a pattern
     the learner notices before the content. Everything else: two. */
  var CAP = { labeldiagram: 1, corroborate: 1, tracetable: 1, sequence: 1,
              classify: 1, errorspot: 1, estimate: 1, wordproblem: 1 };

  /* The retrieval base for each kind, best first. Every list alone gives at
     least 3 producing formats in its first 9, so a part with no material at
     all still gets a sound day. */
  var CORE = {
    mechanism:      ['twopart', 'mcq', 'fill', 'write', 'truefalse', 'mcq', 'fill', 'matchpairs', 'truefalse'],
    procedure:      ['errorspot', 'twopart', 'fill', 'write', 'mcq', 'fill', 'truefalse', 'matchpairs', 'mcq'],
    /* Production first: recall beats recognition for being able to USE a
       fact (the language/vocab finding, §7). */
    facts:          ['fill', 'matchpairs', 'fill', 'write', 'mcq', 'twopart', 'truefalse', 'mcq', 'truefalse'],
    interpretation: ['twopart', 'highlight', 'write', 'mcq', 'fill', 'write', 'truefalse', 'mcq', 'matchpairs'],
    application:    ['scenario', 'twopart', 'scenario', 'fill', 'write', 'mcq', 'truefalse', 'fill', 'matchpairs'],
    /* Every premade language mix traded its true/false for a dictation
       (§8). Outside the language family the dictation is refused and a
       filler takes the slot. */
    language:       ['sentence', 'fill', 'sentence', 'write', 'fill', 'mcq', 'twopart', 'matchpairs', 'dictation']
  };

  /* What each material EARNS, in priority order. These are the formats that
     make a day fit its material, so they go in before the core. */
  function earnedFor(mat) {
    var out = [];
    if (mat.code) out.push('tracetable', 'sequence:parsons', 'errorspot');
    if (mat.sentences) out.push('sentence');
    if (mat.sources) {
      out.push('corroborate', 'passage:sourcing');
      /* Contextualisation - the fourth Reading Like a Historian skill -
         needs a source AND a moment to place it in. */
      if (mat.dates) out.push('passage:context');
    }
    if (mat.text) out.push('readingset', 'highlight');
    if (mat.parts) out.push('labeldiagram');
    if (mat.calculation) out.push('tracetable', 'wordproblem');
    if (mat.procedure) out.push('errorspot');
    if (mat.dates) out.push('sequence:chronology');
    if (mat.order) out.push('sequence:process');
    if (mat.cases) out.push('scenario');
    if (mat.categories) out.push('classify');
    if (mat.numbers) out.push('estimate', 'wordproblem');
    return out;
  }
  var MAX_EARNED = 5;

  function baseOf(e) { return String(e).split(':')[0]; }

  function allowed(e, mat, family) {
    var b = baseOf(e);
    if (!has(KNOWN, b)) return false;
    /* Invariant 8: only the quantitative subjects ask for word problems,
       and maths is not here, so that means economics. */
    if (b === 'wordproblem' && family !== 'economics') return false;
    if (has(ONLY_FAMILY, b) && ONLY_FAMILY[b] !== family) return false;
    if (has(NEVER_FAMILY, family) && has(NEVER_FAMILY[family], b)) return false;
    var need = has(NEEDS, e) ? NEEDS[e] : (has(NEEDS, b) ? NEEDS[b] : null);
    if (!need) return true;
    for (var i = 0; i < need.length; i++) if (mat && mat[need[i]]) return true;
    return false;
  }

  function produceCount(list) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (has(PRODUCE, baseOf(list[i]))) n++;
    return n;
  }

  /* ONE day's mix. Deterministic: the same description always gives the
     same list.
       - inherited (a premade subtopic's list) keeps its order and length,
         minus anything its material cannot carry;
       - the gaps, or a whole new list, are filled from what the material
         earns, then from the kind's core;
       - the producing share never drops below the inherited list's own, or
         3 for a new list. */
  function compose(kind, mat, family, inherited) {
    mat = mat || {};
    if (!has(CORE, kind)) kind = 'mechanism';
    var seed = isArr(inherited) ? inherited : null;
    var target = seed ? Math.max(7, Math.min(10, seed.length)) : 9;
    var out = [], count = {}, i, n;
    /* The caps bound what THIS function adds. An inherited list's own counts
       were chosen by whoever wrote that mix - history/era asks for three
       passage cards on purpose, because sourcing, context and perspective are
       three different reading skills - so they stand. */
    var own = {};
    if (seed) for (i = 0; i < seed.length; i++) own[baseOf(seed[i])] = (own[baseOf(seed[i])] || 0) + 1;

    function room(e) {
      var b = baseOf(e);
      return (count[b] || 0) < Math.max(has(CAP, b) ? CAP[b] : 2, own[b] || 0);
    }
    function add(e) {
      if (out.length >= target || !allowed(e, mat, family) || !room(e)) return false;
      out.push(e);
      count[baseOf(e)] = (count[baseOf(e)] || 0) + 1;
      return true;
    }

    if (seed) for (i = 0; i < seed.length; i++) add(String(seed[i]));
    var earned = earnedFor(mat);
    for (i = 0, n = 0; i < earned.length && n < MAX_EARNED; i++) if (add(earned[i])) n++;
    /* A reading set is one entry and four cards (a passage and three
       questions), so a new list that carries one is a card shorter. */
    if (!seed && count.readingset) target = 8;
    var core = CORE[kind];
    for (i = 0; i < core.length; i++) add(core[i]);
    var fillers = ['mcq', 'fill', 'write', 'truefalse', 'twopart', 'matchpairs', 'scenario', 'highlight'];
    for (i = 0; i < fillers.length * 2 && out.length < target; i++) add(fillers[i % fillers.length]);

    var floor = seed ? produceCount(seed) : 3;
    /* Swap the weakest choosing formats for fill or write, last first. */
    var SWAP = ['truefalse', 'matchpairs', 'mcq', 'highlight', 'scenario', 'twopart'];
    for (var guard = 0; guard < 10 && produceCount(out) < floor; guard++) {
      var to = (count.fill || 0) <= (count.write || 0) ? 'fill' : 'write';
      if (!room(to)) to = (to === 'fill') ? 'write' : 'fill';
      if (!room(to)) break;
      var at = -1;
      for (var s = 0; s < SWAP.length && at < 0; s++) {
        for (i = out.length - 1; i >= 0; i--) if (out[i] === SWAP[s]) { at = i; break; }
      }
      if (at < 0) break;
      count[out[at]]--;
      out[at] = to;
      count[to] = (count[to] || 0) + 1;
    }
    return out;
  }

  /* Said per kind, so a composed day's rules cannot contradict its own
     quota the way the subject-wide mandates do (science's still asks for
     word problems its palette forbids). */
  var KIND_RULE = {
    mechanism:      'This part is about HOW OR WHY something works. Ask for causes, effects and predictions. Where the topic allows, make a twopart\'s Part A a prediction ("what happens if...") and Part B the reason - committing to a prediction before seeing the answer is what shifts a misconception.',
    procedure:      'This part is a METHOD done in steps. The learner carries it out, checks it, or finds the step that was done wrong - naming the method is not doing it.',
    facts:          'This part is FACTS to remember. Have the learner PRODUCE the word or fact, inside a sentence that fixes its meaning, more often than pick it from options: recall builds knowledge the learner can use.',
    interpretation: 'This part is READING A TEXT OR SOURCE and arguing what it shows. Quote the words in the question; every answer must be supported by text the learner can see.',
    application:    'This part is APPLYING A RULE OR PRINCIPLE. Give a short, concrete case that cannot be answered without the rule, and ask what the rule decides.',
    language:       'This part is USING A LANGUAGE. The learner produces or corrects real sentences; never ask about grammar terminology in the abstract.'
  };

  var DEFAULT_ASK = {
    mechanism:      'what happens and why, and what changes when one condition changes',
    procedure:      'carry out or check one step of the method on a concrete example',
    facts:          'produce the fact or term inside a sentence that fixes its meaning',
    interpretation: 'what the quoted text shows, backed by its own words',
    application:    'what the rule decides in a short, concrete case',
    language:       'build or correct a real sentence'
  };
  var DEFAULT_AVOID = {
    mechanism:      'naming a part or a term with no cause or effect attached',
    procedure:      'naming the method instead of doing it',
    facts:          'trivia the notes do not stress',
    interpretation: 'outside knowledge, or opinions with no right answer',
    application:    'reciting the rule with no case to apply it to',
    language:       'grammar terminology asked in the abstract'
  };

  function kindFrom(mat) {
    if (mat.code || mat.calculation || mat.procedure) return 'procedure';
    if (mat.sentences) return 'language';
    if (mat.text || mat.sources) return 'interpretation';
    if (mat.cases) return 'application';
    return 'mechanism';
  }

  /* ── FROM THE MODEL'S ANSWER TO A PLAN ───────────────────────────────── */

  function parse(raw) {
    var o = raw;
    if (typeof raw === 'string') {
      var m = raw.match(/\{[\s\S]*\}/);
      o = null;
      if (m) { try { o = JSON.parse(m[0]); } catch (e) { o = null; } }
    }
    return (o && typeof o === 'object' && !isArr(o)) ? o : null;
  }

  /* One subtopic as the model described it, cleaned. null if it has no
     usable name. */
  function entry(r, broader) {
    if (!r || typeof r !== 'object' || isArr(r)) return null;
    var name = clean(r.name || r.title, 48);
    if (name.length < 2) return null;
    var mat = {}, list = isArr(r.material) ? r.material : [], i, k;
    for (i = 0; i < list.length && i < 20; i++) {
      k = clean(list[i], 20).toLowerCase();
      if (has(MATERIALS, k)) mat[k] = 1;
    }
    var kind = clean(r.kind, 20).toLowerCase();
    if (!has(KINDS, kind)) kind = kindFrom(mat);
    /* A kind carries the one material it cannot exist without. */
    if (kind === 'language') mat.sentences = 1;
    if (kind === 'procedure') mat.procedure = 1;
    var covers = [], seen = {}, cv = isArr(r.covers) ? r.covers : [];
    for (i = 0; i < cv.length && i < 12 && covers.length < 5; i++) {
      k = clean(cv[i], 44);
      if (k.length > 1 && !seen[norm(k)]) { seen[norm(k)] = 1; covers.push(k); }
    }
    var pic = clean(r.picture, 20).toLowerCase();
    return {
      name: name,
      parent: clean(r.parent, 48) || broader || name,
      parts: [name],
      covers: covers,
      kind: kind,
      mat: mat,
      like: clean(r.like, 40),
      ask: cleanRule(r.ask, 150, /^ask\b[\s:\-]*/i),
      avoid: cleanRule(r.avoid, 120, /^avoid\b[\s:\-]*/i),
      picture: has(PICTURES, pic) ? pic : ''
    };
  }

  /* How two parts relate in the tree. A part that was itself made by a
     merge is NAMED after the parent it generalised to, so the parent's
     remaining children must still recognise it as theirs - without the
     second and third tests, "Intervals" (parent Harmony) no longer matched
     the "Harmony" made from its two siblings, and a two-day music plan
     paired Harmony with the unrelated "Time signatures" instead. */
  function related(a, b) {
    var pa = norm(a.parent), pb = norm(b.parent);
    /* Two halves of the same parent, each made by an earlier merge. As
       siblings (both now sit under the field) they would be generalised one
       level too far - four Harmony parts came out as "Music". */
    if (norm(a.name) === norm(b.name)) return 'same';
    if (pa === pb) return 'siblings';
    if (pb === norm(a.name)) return 'a-holds-b';
    if (pa === norm(b.name)) return 'b-holds-a';
    return '';
  }

  /* Two parts taught as one. Siblings become their shared parent, and a
     part joins the parent node that holds it. Unrelated parts become
     "A and B" - once; a second unrelated merge, or a name too long to read,
     generalises to the whole field. ("Intervals and Harmony and Time
     signatures" is not a name.) Covers keep the names of what went in, so
     the day still knows everything it includes. */
  function mergeTwo(a, b, broader) {
    var rel = related(a, b), name, parent = broader;
    if (rel === 'siblings') name = a.parent;
    else if (rel === 'same' || rel === 'a-holds-b') { name = a.name; parent = a.parent; }
    else if (rel === 'b-holds-a') { name = b.name; parent = b.parent; }
    else name = (a.joined || b.joined) ? broader : a.name + ' and ' + b.name;
    if (name.length > 48) name = broader;
    /* The names of every original part come first, so however many merges
       it took, the day is still told each part it now carries (at most
       MAX_PARTS of them, all of which fit). Then the specifics, alternating,
       while there is room. */
    var parts = a.parts.concat(b.parts);
    var covers = [], seen = {}, i;
    seen[norm(name)] = 1;
    function put(x) {
      var k = norm(x);
      if (k && !seen[k] && covers.length < MAX_PARTS) { seen[k] = 1; covers.push(x); }
    }
    for (i = 0; i < parts.length; i++) put(parts[i]);
    for (i = 0; i < a.covers.length || i < b.covers.length; i++) {
      if (i < a.covers.length) put(a.covers[i]);
      if (i < b.covers.length) put(b.covers[i]);
    }
    var mat = {}, k;
    for (k in a.mat) if (has(a.mat, k)) mat[k] = 1;
    for (k in b.mat) if (has(b.mat, k)) mat[k] = 1;
    var lead = (rel === 'a-holds-b') ? a : (rel === 'b-holds-a') ? b :
               (b.covers.length > a.covers.length ? b : a);
    return {
      name: name,
      parent: parent,
      parts: parts,
      covers: covers,
      kind: lead.kind,
      mat: mat,
      like: a.like === b.like ? a.like : '',
      /* A sibling's specific ask still fits its sibling; across unrelated
         parts it would steer half the day wrong, so the kind's default
         stands in. */
      ask: rel ? lead.ask : '',
      avoid: rel ? lead.avoid : '',
      picture: a.picture === b.picture ? a.picture : '',
      joined: !rel || !!(a.joined || b.joined)
    };
  }

  /* Fewer days than parts: generalise, one merge at a time, until they fit.
     Siblings under one parent first (adjacent before apart), then the two
     neighbouring parts with the least in them. Ties go to the LATER pair,
     so the foundations the notes open with keep their own day longest. */
  function fit(list, cap, broader) {
    for (var guard = 0; list.length > cap && guard < 20; guard++) {
      var best = null, i, j, score;
      for (i = 0; i < list.length; i++) {
        for (j = i + 1; j < list.length; j++) {
          var sib = !!related(list[i], list[j]);
          if (!sib && j !== i + 1) continue;
          score = (sib ? 0 : 1000) + (j === i + 1 ? 0 : 100) +
                  list[i].covers.length + list[j].covers.length;
          if (!best || score <= best.score) best = { i: i, j: j, score: score };
        }
      }
      if (!best) break;
      var merged = mergeTwo(list[best.i], list[best.j], broader);
      list = list.slice(0, best.i).concat([merged], list.slice(best.i + 1, best.j), list.slice(best.j + 1));
    }
    return list;
  }

  /* Two parts with the same name are one part described twice. */
  function dedupe(list, broader) {
    var out = [], at = {}, i, k;
    for (i = 0; i < list.length; i++) {
      k = norm(list[i].name);
      if (has(at, k)) {
        var m = mergeTwo(out[at[k]], list[i], broader);
        m.name = out[at[k]].name;
        m.parent = out[at[k]].parent;
        m.joined = false;
        m.parts = out[at[k]].parts;
        out[at[k]] = m;
      } else { at[k] = out.length; out.push(list[i]); }
    }
    return out;
  }

  /* A premade subtopic, by "family/key" ("science/life", "psychology/bioCog"). */
  function archetype(like, table) {
    if (!like || !table) return null;
    var m = String(like).match(/^\s*([a-z]+)\s*[\/:.\-]\s*([a-z]+)\s*$/i);
    if (!m) return null;
    var fam = m[1].toLowerCase(), list = has(table, fam) ? table[fam] : null;
    if (!isArr(list)) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].key).toLowerCase() === m[2].toLowerCase() && isArr(list[i].types)) {
        return { id: fam + '/' + list[i].key, st: list[i] };
      }
    }
    return null;
  }

  function build(e, family, table, used) {
    var arch = archetype(e.like, table);
    var types = compose(e.kind, e.mat, family, arch ? arch.st.types : null);
    var guide = 'ASK: ' + (e.ask || DEFAULT_ASK[e.kind]) + '. AVOID: ' + (e.avoid || DEFAULT_AVOID[e.kind]) + '.' +
                (arch && arch.st.guide ? ' For this kind of material in general: ' + arch.st.guide : '');
    var p = produceCount(types);
    var key = norm(e.name).replace(/ /g, '-').slice(0, 32) || 'part', k = key, n = 2;
    while (has(used, k)) k = key + '-' + (n++);
    used[k] = 1;
    var material = [], m;
    for (m in MATERIALS) if (has(MATERIALS, m) && e.mat[m]) material.push(m);
    var sameName = norm(e.parent) === norm(e.name);
    return {
      key: k,
      /* label/types/guide/visual are the fields generateDay already reads
         from a premade subtopic, so a made one drops into the same slot. */
      label: e.name,
      name: e.name,
      parent: e.parent,
      /* The original parts this one carries - one, unless days were short. */
      parts: e.parts,
      covers: e.covers,
      kind: e.kind,
      material: material,
      like: arch ? arch.id : '',
      types: types,
      guide: guide,
      mandate: KIND_RULE[e.kind] + '\nThese formats were chosen for what this material is. ' + p + ' of the ' +
               types.length + ' ask the learner to PRODUCE an answer (typed, built or worked out) - keep them ' +
               'producing. Use exactly the types and counts in the quota line near the end of this prompt.',
      visual: PICTURES[e.picture] || (arch && arch.st.visual) || '',
      /* Semicolons, because a single covered item is often a list itself
         ("root, third, fifth"). */
      focus: e.name + (sameName ? '' : ' (part of ' + e.parent + ')') +
             (e.covers.length ? ': ' + e.covers.join('; ') : ''),
      dynamic: true
    };
  }

  /* THE JUDGE. Everything the model returns goes through here, and anything
     short of at least one usable part comes back null - the caller then
     builds the plan exactly as it did before this file existed.

     ctx: { localType: the local classifier's family,
            days:      plan length,
            subject:   the subject line the plan uses,
            archetypes: SUBTOPICS, for "like" }

     THE FAMILY POLICY, and it is asymmetric on purpose:
       - maths never reaches the skill (its mix is the point, invariant 1);
       - a family the local classifier committed to stands - it was tuned
         against real misfires, and changing it here would re-route every
         table in lesson.html on one model call's say-so;
       - only "general" is upgraded, and never to maths: a false maths
         upgrade turns a driving test into ten equations a day, while a
         missed one costs a composed mix that still produces answers. */
  function judge(raw, ctx) {
    ctx = ctx || {};
    var o = parse(raw);
    if (!o) return null;
    var local = has(FAMILIES, ctx.localType) ? ctx.localType : 'general';
    if (local === 'math') return null;
    var mf = clean(o.family, 20).toLowerCase().replace(/[^a-z]/g, '');
    if (!has(FAMILIES, mf)) mf = '';
    var family = local !== 'general' ? local : ((mf && mf !== 'math') ? mf : 'general');
    var subject = clean(o.subject, 60) || clean(ctx.subject, 60);
    var field = clean(o.field, 32);
    var broader = field || subject || 'These notes';
    var list = isArr(o.subtopics) ? o.subtopics : [];
    var raws = [], i, e;
    for (i = 0; i < list.length && raws.length < MAX_PARTS; i++) {
      e = entry(list[i], broader);
      if (e) raws.push(e);
    }
    raws = dedupe(raws, broader);
    if (!raws.length) return null;
    var days = Math.floor(Number(ctx.days));
    if (!(days >= 1)) days = MAX_SUBTOPICS;
    raws = fit(raws, Math.min(MAX_SUBTOPICS, days), broader);
    var used = {}, subs = [];
    for (i = 0; i < raws.length; i++) subs.push(build(raws[i], family, ctx.archetypes, used));
    return {
      v: VERSION,
      source: 'model',
      subject: subject,
      field: field,
      family: family,
      modelFamily: mf,
      tip: clean(o.tip, 140),
      subtopics: subs
    };
  }

  /* ── THE PROMPT ──────────────────────────────────────────────────────── */

  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

  function table(obj, indent, width) {
    var out = [], k;
    for (k in obj) if (has(obj, k)) out.push(indent + pad(k, width) + obj[k]);
    return out.join('\n') + '\n';
  }

  function archetypeLines(t) {
    var out = [], k, i, bits;
    if (!t) return '';
    for (k in t) {
      if (!has(t, k) || !isArr(t[k])) continue;
      bits = [];
      for (i = 0; i < t[k].length; i++) {
        if (t[k][i] && t[k][i].key) bits.push(k + '/' + t[k][i].key + ' (' + t[k][i].label + ')');
      }
      if (bits.length) out.push('                  ' + bits.join(', '));
    }
    return out.join('\n') + '\n';
  }

  /* facts: { subject, notes, days, archetypes } */
  function prompt(f) {
    f = f || {};
    var days = Math.max(1, Math.floor(Number(f.days)) || 1);
    return 'Map the study notes below into the parts a study plan should teach. Return ONLY JSON, no markdown.\n\n' +
      'SUBJECT LINE: ' + (clean(f.subject, 80) || '(nothing typed)') + '\n' +
      'PLAN LENGTH: ' + days + ' day' + (days === 1 ? '' : 's') + '\n' +
      'NOTES:\n' + String(f.notes || '').slice(0, NOTES_CAP) + '\n\n' +
      'Assume nothing about this subject in advance. It may be one no app has a list for - beekeeping,\n' +
      'contract law, music theory, a driving test. Read the notes and describe what is ACTUALLY in them.\n\n' +
      '1. WHAT IS IT?\n' +
      '   "subject": what these notes are about, in their own words, under 50 characters.\n' +
      '   "field": the broader discipline it belongs to, in one or two words (Music, Law, Biology, Nursing).\n' +
      '   "family": the ONE of these it is closest to - "general" when none really fits:\n' +
      table(FAMILIES, '     ', 11) +
      '2. WHAT ARE ITS PARTS? "subtopics": 1 to 6, in the order they should be taught - a part that\n' +
      '   another part builds on comes first.\n' +
      '   - Each is a genuinely different part of THESE notes, big enough to teach for a day.\n' +
      '   - Never invent a part the notes do not cover, and never split thin notes to fill the days:\n' +
      '     notes about one narrow thing are ONE part.\n' +
      '   - List every real part even if there are more parts than days. Parts that share a "parent"\n' +
      '     are taught together, as that parent, when the plan is short.\n' +
      '   For each part:\n' +
      '     "name"      under 40 characters, in the notes\' own words\n' +
      '     "parent"    the bigger topic it sits under, under 40 characters. Parts that belong together\n' +
      '                 share the same parent, written exactly the same way.\n' +
      '     "covers"    2 to 5 specific things from the notes that it includes, each under 40 characters\n' +
      '     "kind"      the kind of knowledge it is, ONE of:\n' +
      table(KINDS, '                  ', 16) +
      '     "material"  what the notes GIVE you to ask about in this part. List only what is really\n' +
      '                 there: each one unlocks a kind of question that is written from it.\n' +
      table(MATERIALS, '                  ', 13) +
      '     "like"      the closest of these known kinds of lesson, or "" if none is genuinely close:\n' +
      archetypeLines(f.archetypes) +
      '     "ask"       what a good question on this part makes the learner DO, under 140 characters\n' +
      '     "avoid"     the weak question to avoid on this part, under 110 characters\n' +
      '     "picture"   the one diagram that fits it: flow, cycle, timeline, parts, compare, hierarchy,\n' +
      '                 graph, map, concept or drawing\n' +
      '3. "tip": one sentence on how to explain this subject well in your own words, under 120 characters.\n\n' +
      /* A subject with no family of its own, on purpose: the case this file
         exists for. Two parts share a parent so the grouping is shown, not
         just described. */
      'EXAMPLE, for notes on camera exposure and composition:\n' +
      '{"subject":"Camera exposure and composition","field":"Photography","family":"general","subtopics":[\n' +
      ' {"name":"Aperture and depth of field","parent":"Exposure","covers":["f-numbers","depth of field","how much light gets in"],\n' +
      '  "kind":"mechanism","material":["numbers","categories"],"like":"science/physical",\n' +
      '  "ask":"Predict what a wider aperture does to the background, then say why","avoid":"Asking what the letter f stands for","picture":"compare"},\n' +
      ' {"name":"Shutter speed","parent":"Exposure","covers":["motion blur","freezing action","1/500 against 1/30"],\n' +
      '  "kind":"mechanism","material":["numbers","cases"],"like":"",\n' +
      '  "ask":"Choose a shutter speed for a described scene and justify it","avoid":"Recalling a speed with no scene to judge","picture":"compare"},\n' +
      ' {"name":"Rule of thirds","parent":"Composition","covers":["the grid","placing the subject","leading lines"],\n' +
      '  "kind":"application","material":["cases"],"like":"",\n' +
      '  "ask":"Judge where the subject should sit in a described shot","avoid":"Defining the rule with no shot to apply it to","picture":"drawing"}],\n' +
      ' "tip":"Say what the setting changes in the picture, then describe a photo where you would use it."}\n\n' +
      'Now describe THESE notes. Return exactly:\n' +
      '{"subject":"","field":"","family":"","subtopics":[{"name":"","parent":"","covers":[],"kind":"","material":[],"like":"","ask":"","avoid":"","picture":""}],"tip":""}';
  }

  /* One call to api/generate. Resolves the parsed object; REJECTS on
     anything that is not the model's answer - no reply, an error payload,
     prose with no JSON, or slower than ms - so the caller can go on without
     it. A late reply after the timeout is ignored. */
  function request(p, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('timeout'));
      }, ms || 20000);
      fetch('api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        var o = parse(String((data && (data.result || data.plan)) || ''));
        if (!o) { reject(new Error((data && data.error) || 'no json')); return; }
        resolve(o);
      })
      .catch(function (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e || new Error('failed'));
      });
    });
  }

  w.SFTopics = {
    VERSION: VERSION,
    MAX_SUBTOPICS: MAX_SUBTOPICS,
    FAMILIES: FAMILIES,
    KINDS: KINDS,
    MATERIALS: MATERIALS,
    PICTURES: PICTURES,
    NEEDS: NEEDS,
    PRODUCE: PRODUCE,
    prompt: prompt,
    request: request,
    parse: parse,
    judge: judge,
    compose: compose,
    allowed: allowed
  };
})(typeof window !== 'undefined' ? window : this);

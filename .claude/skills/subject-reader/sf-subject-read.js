/* sf-subject-read.js - PROTOTYPE. Loaded by no page. See the SKILL.md beside it.

   The question this answers: can a day's questions come from what the notes
   actually SAY, with no table of counts anywhere?

   sf-topics.js asks the model what KIND of knowledge each part is and what
   MATERIAL it has, then composes a mix from CORE[kind] - a fixed list per
   kind - plus whatever the material earns. This file drops the fixed list.

     THE MODEL SAYS                     THE CODE DECIDES
     the subject and its field          the family it is held to (same policy)
     its parts, in teaching order       how parts merge when days are short
     each part's IDEAS: one checkable   -
       sentence the notes state, and
       what KIND of idea it is
     the real mistake learners make     whether a "who's right?" card exists
       about an idea, if the notes warn
     which ideas the notes stress       which ideas survive a long part

   Each idea then picks its own format from what it IS (AS, below), the first
   option that the family allows, the idea's material can carry and the day
   still has room for. A day is as long as the notes support. There is no
   quota to meet, so there is nothing for a mix to drift away from.

   The model NEVER names a question format. It describes ideas; a format is
   only let in when the idea can carry it, exactly as in sf-topics.js, and
   allowed() is sf-topics.js's own function so the two cannot disagree about
   what a family or a material permits.

   The output is shaped like SFTopics.judge's, so a made part drops into the
   slot generateDay already reads (label, types, guide, mandate, visual,
   focus, key). It adds one field, `slots`: for each card, the format AND
   the idea it is built from.

   Needs sf-topics.js loaded first (FAMILIES, KINDS, MATERIALS, PRODUCE,
   PICTURES, allowed, parse). ES5, no DOM, no other dependency. */
(function (w) {
  'use strict';

  var VERSION = 1;
  var MAX_SUBTOPICS = 6;   // rotation cap, as in sf-topics.js
  var MAX_PARTS = 8;       // read this many in case the model over-splits
  var MAX_IDEAS_READ = 12; // per part, as the model wrote them
  var MIN_IDEAS = 3;       // a part with fewer is merged into a neighbour
  var DAY_MAX = 10;
  var DAY_MIN = 7;         // below this, a second look at the core ideas
  var NOTES_CAP = 8000;    // the same cap the day prompts see

  function T() { return w.SFTopics || null; }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function base(e) { return String(e).split(':')[0]; }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  /* A copy of sf-topics.js's clean(). Everything the model writes goes into
     later prompts and onto the build screen: one line, capped, no angle
     brackets, and objects are not strings. On promotion, export it from
     sf-topics.js instead of keeping two. */
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
      s = s.replace(/[\s,;:\-–—]+$/, '');
    }
    return s;
  }

  /* ── WHAT AN IDEA CAN BE ─────────────────────────────────────────────── */

  /* Describes an IDEA, never a subject: a new subject needs no new entry.
     The model picks one per idea. */
  var NATURES = {
    cause:       'why or how something happens: a cause and its effect, or what changes when a condition changes',
    step:        'one step of a method or process, where the order matters or one step could be done wrong',
    distinction: 'two things that are easy to confuse, and what separates them',
    term:        'a word or fact that has to be remembered, with what it means',
    quantity:    'a real figure, size or rate, and what it means',
    source:      'what a text, source or account says or shows, in its own words',
    rule:        'a rule, law or principle, and what it decides in a case',
    composition: 'a thing made of named parts you could point to',
    usage:       'how a word, form or structure of a language is used in a sentence',
    code:        'a piece of program code or pseudocode, and what it does',
    event:       'a dated event or development, and what led to it or came of it'
  };

  /* What each kind of idea gives allowed() to work with - the same material
     flags sf-topics.js uses, derived from the idea instead of reported. */
  var NATURE_MAT = {
    cause: {}, term: {},
    step:        { procedure: 1, order: 1 },
    distinction: { categories: 1 },
    quantity:    { numbers: 1 },
    source:      { sources: 1, text: 1 },
    rule:        { cases: 1 },
    composition: { parts: 1 },
    usage:       { sentences: 1 },
    code:        { code: 1 },
    event:       { dates: 1 }
  };

  /* What each kind of idea can be ASKED as, best first. This is the only
     place nature -> format is decided, and it is a list of options, not a
     quota: an option is skipped when the family forbids it, the idea cannot
     carry it, or the day already has its fill of that format. Variants are
     only the ones app.html already knows (sequence:process, passage:sourcing,
     twopart:passage, selfcheck:code, sequence:parsons, sequence:chronology). */
  var AS = {
    cause:       ['twopart', 'scenario', 'selfcheck', 'mcq'],
    step:        ['tracetable', 'errorspot', 'sequence:process', 'fill'],
    distinction: ['whosright', 'classify', 'matchpairs', 'mcq'],
    term:        ['fill', 'recall', 'matchpairs', 'mcq'],
    quantity:    ['estimate', 'readchart', 'fill', 'mcq'],
    source:      ['passage:sourcing', 'corroborate', 'highlight', 'twopart:passage'],
    rule:        ['scenario', 'twopart', 'selfcheck', 'mcq'],
    composition: ['labeldiagram', 'recall', 'matchpairs', 'mcq'],
    usage:       ['sentence', 'dictation', 'fill', 'write'],
    code:        ['tracetable', 'sequence:parsons', 'selfcheck:code', 'errorspot'],
    event:       ['sequence:chronology', 'twopart', 'fill', 'mcq']
  };
  /* Tried after an idea's own options, so a day with many ideas of one kind
     degrades to plain formats instead of dropping ideas. */
  var FALLBACK = ['fill', 'write', 'mcq', 'twopart'];

  /* Large or distinctive cards: one a day (the same list as sf-topics.js's
     CAP). Everything else: two. */
  var ONE = { labeldiagram: 1, corroborate: 1, tracetable: 1, sequence: 1, classify: 1, errorspot: 1,
              estimate: 1, wordproblem: 1, recall: 1, selfcheck: 1, conceptmap: 1, whosright: 1,
              readchart: 1 };
  function roomFor(e, count) { return (count[base(e)] || 0) < (has(ONE, base(e)) ? 1 : 2); }

  var KIND_OF = { cause: 'mechanism', step: 'procedure', distinction: 'facts', term: 'facts',
                  quantity: 'mechanism', source: 'interpretation', rule: 'application',
                  composition: 'facts', usage: 'language', code: 'procedure', event: 'mechanism' };

  /* One line per kind of idea, added to the day only for kinds it contains.
     These carry the quality rules sf-topics.js keeps in KIND_RULE. */
  var NATURE_RULE = {
    cause:       'Cause ideas: ask for a prediction ("what happens if...") or the reason, never just the name of the thing.',
    step:        'Step ideas: have the learner carry out or check the step on a concrete case, or find the step done wrong.',
    distinction: 'Distinction ideas: put the real confusion in front of the learner and make them separate the two things.',
    term:        'Term ideas: have the learner produce the word or fact inside a sentence that fixes its meaning.',
    quantity:    'Quantity ideas: use the notes\' real figures, and ask what the figure means or whether an answer is reasonable.',
    source:      'Source ideas: quote the words in the question; every answer must be supported by text the learner can see.',
    rule:        'Rule ideas: give a short, concrete case that cannot be answered without the rule, and ask what the rule decides.',
    composition: 'Composition ideas: ask about the parts and what each does, never about parts the notes do not name.',
    usage:       'Usage ideas: the learner builds or corrects a real sentence; never ask about grammar terminology in the abstract.',
    code:        'Code ideas: show the code as plain text and ask what it does or where it goes wrong.',
    event:       'Event ideas: place the event in its time, and ask what led to it or what came of it.'
  };

  /* A claim cut for a one-line focus: whole words, and an ellipsis so it
     never reads as a sentence that simply stops. */
  function short(s, n) {
    if (s.length <= n) return s;
    var t = s.slice(0, n), cut = t.lastIndexOf(' ');
    if (cut > n * 0.5) t = t.slice(0, cut);
    return t.replace(/[\s,;:\-\u2013\u2014]+$/, '') + '\u2026';
  }

  /* ── IDEAS ───────────────────────────────────────────────────────────── */

  /* One idea as the model described it, cleaned. null when it cannot be
     checked: no claim, or a nature outside the list. */
  function idea(r) {
    if (!r || typeof r !== 'object' || isArr(r)) return null;
    var nat = clean(r.nature, 20).toLowerCase();
    if (!has(NATURES, nat)) return null;
    var claim = clean(r.claim, 140);
    if (claim.length < 8) return null;
    var conf = clean(r.confusedWith, 100);
    /* A "mistake" that restates the claim is not one. */
    if (conf.length < 6 || norm(conf) === norm(claim)) conf = '';
    return { claim: claim, nature: nat, confusedWith: conf, core: r.core === true || r.core === 'true' };
  }

  function dedupeIdeas(list) {
    var out = [], seen = {}, i, k;
    for (i = 0; i < list.length; i++) {
      k = norm(list[i].claim);
      if (k && !has(seen, k)) { seen[k] = 1; out.push(list[i]); }
    }
    return out;
  }

  function ideaMat(d) {
    var m = {}, k, src = NATURE_MAT[d.nature];
    for (k in src) if (has(src, k)) m[k] = 1;
    /* A step with numbers in it is a calculation, which is what lets a trace
       table be written from it. */
    if (d.nature === 'step' && /\d/.test(d.claim)) m.calculation = 1;
    return m;
  }

  /* More ideas than a day holds: the ones the notes stress first, and no one
     kind more than half the day while others are left to choose from. */
  function selectIdeas(list, max) {
    if (list.length <= max) return list.slice();
    var order = [], i, j, pass, nat, per = {}, take = {}, n = 0, out = [];
    for (i = 0; i < list.length; i++) if (list[i].core) order.push(i);
    for (i = 0; i < list.length; i++) if (!list[i].core) order.push(i);
    var half = Math.ceil(max / 2);
    for (pass = 0; pass < 2; pass++) {
      for (j = 0; j < order.length && n < max; j++) {
        i = order[j];
        if (take[i]) continue;
        nat = list[i].nature;
        if (pass === 0 && (per[nat] || 0) >= half) continue;
        take[i] = 1; per[nat] = (per[nat] || 0) + 1; n++;
      }
    }
    for (i = 0; i < list.length; i++) if (take[i]) out.push(list[i]);
    return out;
  }

  /* ── ONE IDEA -> ONE FORMAT ──────────────────────────────────────────── */

  function optionsFor(d) {
    var o = AS[d.nature].slice(), out = [], i;
    for (i = 0; i < o.length; i++) {
      /* "Who's right?" is a real misconception put in a classmate's mouth;
         without one the wrong answers would be strawmen. */
      if (o[i] === 'whosright' && !d.confusedWith) continue;
      /* An estimate or a chart judges a measured size. A fixed count the
         notes state outright ("seven half steps") is a fact to recall. */
      if (d.nature === 'quantity' && !/\d/.test(d.claim) && (o[i] === 'estimate' || o[i] === 'readchart')) continue;
      out.push(o[i]);
    }
    return out.concat(FALLBACK);
  }

  /* The first option the family allows, the idea can carry, the day has room
     for, and (if given) this idea has not already been asked as. */
  function pick(d, family, count, avoid, produceOnly) {
    var st = T(), mat = ideaMat(d), opts = optionsFor(d), i, e;
    for (i = 0; i < opts.length; i++) {
      e = opts[i];
      if (avoid && has(avoid, e)) continue;
      if (produceOnly && !has(st.PRODUCE, base(e))) continue;
      if (st.allowed(e, mat, family) && roomFor(e, count)) return e;
    }
    return null;
  }

  /* A day's cards, one per idea in the order of the notes, then - only when
     the notes gave fewer ideas than a day holds - a second look at the ideas
     they stress, from a different side, at the end (spaced, not back to
     back). The one guardrail is a floor, not a target: a day of all choosing
     teaches recognition only, so a third of the cards must produce an answer. */
  function slotsFor(ideas, family) {
    var st = T(), count = {}, used = {}, n = {}, slots = [], i, d, e, round, added;
    function put(d, e) {
      count[base(e)] = (count[base(e)] || 0) + 1;
      if (!used[d.i]) used[d.i] = {};
      used[d.i][e] = 1;
      n[d.i] = (n[d.i] || 0) + 1;
      slots.push({ type: e, nature: d.nature, claim: d.claim, d: d });
    }
    for (i = 0; i < ideas.length; i++) {
      d = ideas[i];
      e = pick(d, family, count, null);
      if (e) put(d, e);
    }
    var order = [];
    for (i = 0; i < ideas.length; i++) if (ideas[i].core) order.push(ideas[i]);
    for (i = 0; i < ideas.length; i++) if (!ideas[i].core) order.push(ideas[i]);
    for (round = 0; round < 2 && slots.length < DAY_MIN; round++) {
      added = false;
      for (i = 0; i < order.length && slots.length < DAY_MIN; i++) {
        d = order[i];
        if ((n[d.i] || 0) >= 2) continue;
        e = pick(d, family, count, used[d.i]);
        if (e) { put(d, e); added = true; }
      }
      if (!added) break;
    }
    function produced() {
      var c = 0, k;
      for (k = 0; k < slots.length; k++) if (has(st.PRODUCE, base(slots[k].type))) c++;
      return c;
    }
    var floor = Math.ceil(slots.length / 3), s, swap;
    for (i = slots.length - 1; i >= 0 && produced() < floor; i--) {
      s = slots[i];
      if (has(st.PRODUCE, base(s.type))) continue;
      count[base(s.type)]--;
      swap = pick(s.d, family, count, used[s.d.i], true);
      if (swap) { count[base(swap)] = (count[base(swap)] || 0) + 1; used[s.d.i][swap] = 1; s.type = swap; }
      else count[base(s.type)]++;
    }
    return slots;
  }

  /* ── PARTS ───────────────────────────────────────────────────────────── */

  function entry(r, broader) {
    if (!r || typeof r !== 'object' || isArr(r)) return null;
    var name = clean(r.name || r.title, 48);
    if (name.length < 2) return null;
    var list = isArr(r.ideas) ? r.ideas : [], ideas = [], i, d;
    for (i = 0; i < list.length && i < MAX_IDEAS_READ; i++) {
      d = idea(list[i]);
      if (d) ideas.push(d);
    }
    ideas = dedupeIdeas(ideas);
    if (!ideas.length) return null;
    var pic = clean(r.picture, 20).toLowerCase();
    return {
      name: name,
      parent: clean(r.parent, 48) || broader || name,
      parts: [name],
      ideas: ideas,
      picture: has(T().PICTURES, pic) ? pic : ''
    };
  }

  /* How two parts sit in the tree (the same four cases as sf-topics.js). */
  function kin(a, b) {
    var na = norm(a.name), nb = norm(b.name), pa = norm(a.parent), pb = norm(b.parent);
    return na === nb || pa === pb || pb === na || pa === nb;
  }

  /* Two parts taught as one. Siblings become their shared parent; unrelated
     parts become "A and B" once, and the field after that. Every original
     name stays in `parts`, so a merge never hides what a day carries. */
  function mergeParts(a, b, broader) {
    var na = norm(a.name), nb = norm(b.name), pa = norm(a.parent), pb = norm(b.parent);
    var name, parent = broader;
    if (na === nb || pb === na) { name = a.name; parent = a.parent; }
    else if (pa === nb) { name = b.name; parent = b.parent; }
    else if (pa === pb) name = a.parent;
    else name = (a.joined || b.joined) ? broader : a.name + ' and ' + b.name;
    if (name.length > 48) name = broader;
    return {
      name: name,
      parent: parent,
      parts: a.parts.concat(b.parts),
      ideas: dedupeIdeas(a.ideas.concat(b.ideas)),
      picture: a.picture === b.picture ? a.picture : '',
      joined: !kin(a, b) || !!a.joined || !!b.joined
    };
  }

  function dedupeParts(list, broader) {
    var out = [], at = {}, i, k;
    for (i = 0; i < list.length; i++) {
      k = norm(list[i].name);
      if (has(at, k)) {
        var o = out[at[k]];
        o.ideas = dedupeIdeas(o.ideas.concat(list[i].ideas));
      } else { at[k] = out.length; out.push(list[i]); }
    }
    return out;
  }

  function neighbour(list, at) {
    var prev = at - 1, next = at + 1, hasP = prev >= 0, hasN = next < list.length;
    if (hasP && hasN) {
      var sp = norm(list[prev].parent) === norm(list[at].parent);
      var sn = norm(list[next].parent) === norm(list[at].parent);
      if (sp !== sn) return sp ? prev : next;
      return list[prev].ideas.length <= list[next].ideas.length ? prev : next;
    }
    return hasP ? prev : next;
  }

  /* A part with fewer than MIN_IDEAS cannot fill a day on its own; fold it
     into the neighbour it belongs with. */
  function absorbThin(list, broader) {
    for (var guard = 0; guard < 20 && list.length > 1; guard++) {
      var at = -1, i;
      for (i = 0; i < list.length; i++) if (list[i].ideas.length < MIN_IDEAS) { at = i; break; }
      if (at < 0) break;
      var nb = neighbour(list, at), lo = Math.min(at, nb), hi = Math.max(at, nb);
      list = list.slice(0, lo).concat([mergeParts(list[lo], list[hi], broader)], list.slice(hi + 1));
    }
    return list;
  }

  /* Fewer days than parts: merge siblings first, then the two neighbours with
     the least in them. Ties go to the LATER pair, so the foundations the
     notes open with keep their own day longest. */
  function fit(list, cap, broader) {
    for (var guard = 0; list.length > cap && guard < 20; guard++) {
      var best = null, i, j, score;
      for (i = 0; i < list.length; i++) {
        for (j = i + 1; j < list.length; j++) {
          var sib = kin(list[i], list[j]);
          if (!sib && j !== i + 1) continue;
          score = (sib ? 0 : 1000) + (j === i + 1 ? 0 : 100) + list[i].ideas.length + list[j].ideas.length;
          if (!best || score <= best.score) best = { i: i, j: j, score: score };
        }
      }
      if (!best) break;
      var m = mergeParts(list[best.i], list[best.j], broader);
      list = list.slice(0, best.i).concat([m], list.slice(best.i + 1, best.j), list.slice(best.j + 1));
    }
    return list;
  }

  function mandateFor(slots, kinds, produce) {
    var lines = [], seen = {}, rules = [], i, s, k;
    lines.push('This day is built from the ideas the notes actually state. Write ONE card for each line below, ' +
               'in this order, in the format named - the format was chosen for what the idea IS. Each card tests ' +
               'its own idea and nothing the notes do not say.');
    for (i = 0; i < slots.length; i++) {
      s = slots[i];
      lines.push((i + 1) + '. [' + s.type + '] ' + s.claim +
                 (s.d.confusedWith ? ' (the mistake to put in front of the learner: ' + s.d.confusedWith + ')' : ''));
      if (!has(seen, s.nature)) { seen[s.nature] = 1; rules.push(NATURE_RULE[s.nature]); }
    }
    return lines.join('\n') + '\n' + rules.join('\n') + '\n' + produce + ' of the ' + slots.length +
           ' cards ask the learner to PRODUCE an answer (typed, built or worked out) - keep them producing. ' +
           'Use exactly the types and counts in the quota line near the end of this prompt.';
  }

  function build(p, family, used) {
    var st = T(), ideas = selectIdeas(p.ideas, DAY_MAX), i, k, d;
    var sel = [];
    for (i = 0; i < ideas.length; i++) {
      d = ideas[i];
      sel.push({ claim: d.claim, nature: d.nature, confusedWith: d.confusedWith, core: d.core, i: i });
    }
    var slots = slotsFor(sel, family);
    if (!slots.length) return null;
    var types = [], produce = 0, tally = {}, kinds = {}, kind = '', best = 0, mat = {};
    for (i = 0; i < slots.length; i++) {
      types.push(slots[i].type);
      if (has(st.PRODUCE, base(slots[i].type))) produce++;
    }
    for (i = 0; i < sel.length; i++) {
      k = KIND_OF[sel[i].nature];
      kinds[k] = (kinds[k] || 0) + 1;
      var m = ideaMat(sel[i]);
      for (var mk in m) if (has(m, mk)) mat[mk] = 1;
    }
    for (i = 0; i < sel.length; i++) {
      k = KIND_OF[sel[i].nature];
      if (kinds[k] > best) { best = kinds[k]; kind = k; }
    }
    var material = [];
    for (mk in st.MATERIALS) if (has(st.MATERIALS, mk) && mat[mk]) material.push(mk);
    var key = norm(p.name).replace(/ /g, '-').slice(0, 32) || 'part', kk = key, n = 2;
    while (has(used, kk)) kk = key + '-' + (n++);
    used[kk] = 1;
    var covers = [];
    if (p.parts.length > 1) covers = p.parts.slice(0, 5);
    else for (i = 0; i < sel.length && covers.length < 3; i++) covers.push(short(sel[i].claim, 64));
    var sameName = norm(p.parent) === norm(p.name);
    var out = [];
    for (i = 0; i < slots.length; i++) out.push({ type: slots[i].type, nature: slots[i].nature, claim: slots[i].claim });
    return {
      key: kk,
      label: p.name,
      name: p.name,
      parent: p.parent,
      parts: p.parts,
      covers: covers,
      kind: kind,
      material: material,
      like: '',
      types: types,
      slots: out,
      guide: 'ASK: carry out what each idea says on a concrete case from the notes. AVOID: anything the notes do not state.',
      mandate: mandateFor(slots, kinds, produce),
      visual: st.PICTURES[p.picture] || '',
      focus: p.name + (sameName ? '' : ' (part of ' + p.parent + ')') + (covers.length ? ': ' + covers.join('; ') : ''),
      dynamic: true
    };
  }

  /* THE READER. Everything the model returns goes through here, and anything
     short of three usable ideas comes back null - the caller then builds the
     plan the way it did before this file existed.

     ctx: { localType, days, subject } - as SFTopics.judge, minus archetypes.
     The family policy is the same, on purpose: maths never reaches here, a
     family the local classifier chose stands, and only "general" is upgraded
     (never to maths). */
  function read(raw, ctx) {
    ctx = ctx || {};
    var st = T();
    if (!st) return null;
    var o = st.parse(raw);
    if (!o) return null;
    var local = has(st.FAMILIES, ctx.localType) ? ctx.localType : 'general';
    if (local === 'math') return null;
    var mf = clean(o.family, 20).toLowerCase().replace(/[^a-z]/g, '');
    if (!has(st.FAMILIES, mf)) mf = '';
    var family = local !== 'general' ? local : ((mf && mf !== 'math') ? mf : 'general');
    var subject = clean(o.subject, 60) || clean(ctx.subject, 60);
    var field = clean(o.field, 32);
    var broader = field || subject || 'These notes';
    var list = isArr(o.parts) ? o.parts : [];
    var raws = [], i, e, total = 0;
    for (i = 0; i < list.length && raws.length < MAX_PARTS; i++) {
      e = entry(list[i], broader);
      if (e) raws.push(e);
    }
    raws = dedupeParts(raws, broader);
    for (i = 0; i < raws.length; i++) total += raws[i].ideas.length;
    if (total < MIN_IDEAS) return null;
    var days = Math.floor(Number(ctx.days));
    if (!(days >= 1)) days = MAX_SUBTOPICS;
    raws = absorbThin(raws, broader);
    raws = fit(raws, Math.min(MAX_SUBTOPICS, days), broader);
    var used = {}, subs = [], b;
    for (i = 0; i < raws.length; i++) {
      b = build(raws[i], family, used);
      if (b) subs.push(b);
    }
    if (!subs.length) return null;
    return {
      v: VERSION,
      source: 'model-ideas',
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

  /* facts: { subject, notes, days }. Names no question format anywhere: the
     model describes ideas, and the app decides how to ask about them. */
  function prompt(f) {
    f = f || {};
    var st = T();
    var days = Math.max(1, Math.floor(Number(f.days)) || 1);
    return 'Read the study notes below and list the ideas a learner must know after studying them. Return ONLY JSON, no markdown.\n\n' +
      'SUBJECT LINE: ' + (clean(f.subject, 80) || '(nothing typed)') + '\n' +
      'PLAN LENGTH: ' + days + ' day' + (days === 1 ? '' : 's') + '\n' +
      'NOTES:\n' + String(f.notes || '').slice(0, NOTES_CAP) + '\n\n' +
      'Assume nothing about this subject in advance. It may be one no app has a list for - beekeeping,\n' +
      'contract law, music theory, a driving test. Describe what is ACTUALLY in the notes.\n\n' +
      '1. WHAT IS IT?\n' +
      '   "subject": what these notes are about, in their own words, under 50 characters.\n' +
      '   "field": the broader discipline it belongs to, in one or two words (Music, Law, Biology, Nursing).\n' +
      '   "family": the ONE of these it is closest to - "general" when none really fits:\n' +
      table(st.FAMILIES, '     ', 11) +
      '2. WHAT ARE ITS PARTS? "parts": 1 to 6, in the order they should be taught - a part that another\n' +
      '   part builds on comes first.\n' +
      '   - Each is a genuinely different part of THESE notes, big enough to teach for a day.\n' +
      '   - Never invent a part the notes do not cover, and never split thin notes to fill the days:\n' +
      '     notes about one narrow thing are ONE part.\n' +
      '   - List every real part even if there are more parts than days. Parts that share a "parent" are\n' +
      '     taught together, as that parent, when the plan is short.\n' +
      '   For each part:\n' +
      '     "name"     under 40 characters, in the notes\' own words\n' +
      '     "parent"   the bigger topic it sits under, under 40 characters, written exactly the same for\n' +
      '                parts that belong together\n' +
      '     "picture"  the one diagram that fits it: flow, cycle, timeline, parts, compare, hierarchy,\n' +
      '                graph, map, concept or drawing\n' +
      '     "ideas"    3 to 8 of them (fewer only if the notes say little)\n' +
      '3. WHAT ARE THE IDEAS? An idea is ONE thing the notes state that a learner could be checked on.\n' +
      '   "claim"          the idea as a complete sentence the notes support, under 130 characters. Use the\n' +
      '                    notes\' own facts, figures and words; never add one the notes do not give.\n' +
      '   "nature"         what KIND of idea it is, ONE of:\n' +
      table(NATURES, '                      ', 13) +
      '   "confusedWith"   the real mistake learners make about THIS idea, if the notes warn about one or it\n' +
      '                    is a well-known one; otherwise "". Never invent one to fill the field.\n' +
      '   "core"           true if the notes stress it or other ideas depend on it, else false\n' +
      '   Describe ideas only. Never write a question, and never name a question format.\n' +
      '4. "tip": one sentence on how to explain this subject well in your own words, under 120 characters.\n\n' +
      'EXAMPLE, for notes on camera exposure and composition:\n' +
      '{"subject":"Camera exposure and composition","field":"Photography","family":"general","parts":[\n' +
      ' {"name":"Aperture","parent":"Exposure","picture":"compare","ideas":[\n' +
      '  {"claim":"A wider aperture lets in more light and blurs the background more","nature":"cause","confusedWith":"That a bigger f-number means a bigger opening","core":true},\n' +
      '  {"claim":"f/2 is a wider opening than f/8","nature":"distinction","confusedWith":"That a bigger f-number means a bigger opening","core":true},\n' +
      '  {"claim":"Depth of field is how much of the picture is in focus","nature":"term","confusedWith":"","core":false}]},\n' +
      ' {"name":"Rule of thirds","parent":"Composition","picture":"drawing","ideas":[\n' +
      '  {"claim":"Placing the subject on a third line usually looks more balanced than the centre","nature":"rule","confusedWith":"","core":true},\n' +
      '  {"claim":"The grid divides the frame into nine equal parts with four crossing points","nature":"composition","confusedWith":"","core":false},\n' +
      '  {"claim":"Leading lines pull the eye towards the subject","nature":"cause","confusedWith":"","core":false}]}],\n' +
      ' "tip":"Say what the setting changes in the picture, then describe a photo where you would use it."}\n\n' +
      'Now describe THESE notes. Return exactly:\n' +
      '{"subject":"","field":"","family":"","parts":[{"name":"","parent":"","picture":"","ideas":[{"claim":"","nature":"","confusedWith":"","core":false}]}],"tip":""}';
  }

  w.SFSubjectRead = {
    VERSION: VERSION,
    NATURES: NATURES,
    NATURE_MAT: NATURE_MAT,
    AS: AS,
    DAY_MIN: DAY_MIN,
    DAY_MAX: DAY_MAX,
    MIN_IDEAS: MIN_IDEAS,
    prompt: prompt,
    read: read
  };
})(typeof window !== 'undefined' ? window : this);

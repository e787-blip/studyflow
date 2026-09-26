/* sf-draw.js - StudyFlow's drawing skill.

   ONE file that knows how to ask the model for a picture, loaded by both
   pages that ask: app.html, while a plan is being made, and lesson.html,
   while a lesson is being studied. The prompts used to live inside
   lesson.html, so the plan page could not ask for a picture without a
   second copy - and two copies of a prompt drift, the way the day prompt's
   "boxes" example outlived the lesson prompt's leaf for months.

   What is here:
     SFDraw.lessonPrompt(day)    one illustration for a whole lesson
     SFDraw.momentPrompt(facts)  one picture of the question just missed
     SFDraw.request(prompt, ms)  api/generate -> Promise of
                                   {spec}   the model drew something
                                   {none}   it said there was nothing to draw
                                 and REJECTS on a failed call (no reply, an
                                 error payload, prose with no JSON, too slow)
     SFDraw.looksDrawable(spec)  a cheap structural check for a page that has
                                 no renderer (app.html)

   What is deliberately NOT here: rendering. SFSceneKit in lesson.html turns a
   spec into SVG and is the SECURITY BOUNDARY - fixed shape kinds, colours by
   name, clamped numbers, grammar-checked path data. looksDrawable only saves
   a page from storing obvious junk; every spec is judged again by SFSceneKit
   when it is drawn, because a plan can be loaded that no validator saw.

   ES5, no DOM, no dependencies: it must parse on both pages before either
   page's own script runs. */
(function (w) {
  'use strict';

  function fmStr(v) { return v == null ? '' : String(v); }

  /* SFSceneKit's shape vocabulary, as the model is shown it. One copy, read
     by both prompts: a shape the model is shown and the kit does not know is
     a shape the kit silently drops. */
  var SCENE_SHAPES_DOC =
    'Shapes, each an entry in "shapes":\n' +
    '  {"s":"rect","x":,"y":,"w":,"h":,"r":8,"fill":"blueFill","stroke":"blue"}\n' +
    '  {"s":"circle","x":,"y":,"r":,"fill":"","stroke":""}\n' +
    '  {"s":"ellipse","x":,"y":,"rx":,"ry":,"fill":"","stroke":""}\n' +
    '  {"s":"line","x1":,"y1":,"x2":,"y2":,"stroke":"ink","sw":2,"arrow":true,"dash":true}\n' +
    '  {"s":"path","d":"M10 10 Q60 0 110 10","stroke":"ink","fill":"none","arrow":true}\n' +
    '  {"s":"poly","points":"10,90 60,20 110,90","fill":"faint","stroke":"ink"}\n' +
    '  {"s":"text","x":,"y":,"t":"label","size":11,"anchor":"middle|start|end","fill":"ink"}\n';

  function lessonPrompt(d) {
    function pick(arr, keys, n) {
      var out = [], i, k, v;
      arr = (Object.prototype.toString.call(arr) === '[object Array]') ? arr : [];
      for (i = 0; i < arr.length && out.length < n; i++) {
        v = '';
        if (typeof arr[i] === 'string') v = arr[i];
        else if (arr[i]) { for (k = 0; k < keys.length; k++) { if (arr[i][keys[k]]) { v = arr[i][keys[k]]; break; } } }
        v = fmStr(v);
        if (v) out.push(v.slice(0, 90));
      }
      return out;
    }
    var points = pick(d.steps, ['action', 'step', 'title'], 6);
    if (!points.length) points = pick(d.concepts, ['name', 'title'], 6);
    var terms = pick(d.keyTerms, ['term', 'name'], 6);

    return 'Draw ONE illustration for the lesson below. Return ONLY JSON, no markdown.\n\n' +
      'LESSON: ' + fmStr(d.title).slice(0, 120) + '\n' +
      (fmStr(d.microTopic) ? 'SPECIFICALLY: ' + fmStr(d.microTopic).slice(0, 120) + '\n' : '') +
      'IT TEACHES: ' + fmStr(d.content).slice(0, 700) + '\n' +
      (points.length ? 'KEY POINTS: ' + points.join(' | ') + '\n' : '') +
      /* Offered, never demanded. Asked to LABEL these terms, the model
         labelled all of them - including "Stomata", which it placed as a
         dot inside a chloroplast. Stomata are pores in a leaf. A term list
         read as an instruction produces a drawing that contains whatever
         was on the list, whether or not it belongs in the picture. */
      (terms.length ? 'TERMS THAT MAY BE RELEVANT (use only the ones that genuinely\n' +
        'appear in what you draw - ignore the rest): ' + terms.join(', ') + '\n' : '') +
      '\nDraw the THING this lesson is about, as it actually looks or works - a leaf, a\n' +
      'call stack, a trebuchet, a river meander, the layers of the atmosphere, an orbit.\n' +
      'Draw the part THIS lesson covers, not the whole subject. Do NOT draw boxes with\n' +
      'nouns in them; that is a different feature and it does it better.\n' +
      'Canvas: w 400, h 250. x goes right from 0, y goes DOWN from 0. Stay inside.\n' +
      SCENE_SHAPES_DOC +
      'COLOURS ARE NAMES, never hex: ink muted rule paper faint, blue blueFill blueInk,\n' +
      'green greenFill greenInk, red redFill redInk, violet violetFill violetInk,\n' +
      'teal tealFill tealInk, amber amberFill amberInk, pink pinkFill pinkInk, none.\n' +
      /* It reached for "yellow" for a photon, which is not in the palette and
         fell back to the default. Naming the miss is cheaper than widening
         the palette. */
      'There is NO yellow, orange, grey, black or white - use amber for yellow,\n' +
      'muted for grey, ink for black, paper for white.\n' +
      'Path data may only use M L H V Q C A Z and numbers.\n' +
      /* THE MODEL COPIES THE EXAMPLE, NOT THE INSTRUCTIONS.

         This prompt had NO example, and the one in app.html was "layers of
         the atmosphere" drawn as four rectangles - so the model's idea of a
         drawing was boxes. Asked for the light reactions it returned circles
         with "PSII", "PSI" and "ATP" written in them joined by arrows: a
         flowchart with biology words, which is the one thing the prompt
         explicitly forbids and the thing it had been shown.

         The rules below are the ones that can be CHECKED while drawing, and
         the example is a real cross-section. Both matter; the example
         matters more. */
      'RULES: 8 to 40 shapes. Keep labels under 22 characters.\n' +
      'DRAW THE THING, NOT A FLOWCHART. This is the part that goes wrong:\n' +
      '  - At least 6 shapes must be "path" or "poly". A picture made only of\n' +
      '    rects, circles and text is a flowchart, and you were asked for a picture.\n' +
      '  - NEVER put an acronym or a name inside a circle or a box - no {PSII},\n' +
      '    {ATP}, {DNA} in a bubble. That is a label pretending to be a drawing.\n' +
      '    Draw the structure; put its name OUTSIDE with a thin leader line to it.\n' +
      '  - Draw it the way a textbook would: a cross-section, a cutaway or a side\n' +
      '    view of the real thing, with its real proportions and its real shape.\n' +
      '  - Arrows show movement or change. They are not how parts connect.\n' +
      /* "at least 12 units clear of it, never on top" was already there and
         was ignored: "Stroma" landed on the thylakoid's own edge and
         "Thylakoid" floated 50 units left of the thing it named. A rule the
         model can CHECK works better than a rule it has to judge. */
      'LABEL PLACEMENT, and this is the part that usually goes wrong:\n' +
      '  - Work out where your shapes are BEFORE you place a label. A label\n' +
      '    whose x,y falls inside any other shape is wrong.\n' +
      '  - Put labels in the outer margin - above, below, or to the side of the\n' +
      '    drawing - not in the middle of it.\n' +
      '  - If a label cannot sit next to its part, draw a short thin line from\n' +
      '    the label to the part: {"s":"line","stroke":"rule","sw":1}.\n' +
      '  - A label must touch or point at the thing it names. A word floating\n' +
      '    in space near nothing is worse than no label.\n' +
      '  - This is read on a PHONE: keep w at most 400 and every text size 11\n' +
      '    or more. A size-9 label on a 440-wide canvas is 7px - unreadable.\n' +
      'If this lesson is purely abstract and there is genuinely nothing to draw,\n' +
      'return {"type":"none"} rather than inventing a picture.\n\n' +
      'This is the LEVEL of drawing expected - a leaf in cross-section. Note the\n' +
      'curved outline, the real internal structures, and every label sitting\n' +
      'outside on a leader line. Match this for YOUR topic, whatever it is:\n' +
      '{"type":"drawing","title":"A leaf in cross-section","w":400,"h":250,"shapes":[\n' +
      ' {"s":"path","d":"M60 70 Q220 52 380 70 L380 168 Q220 186 60 168 Z","fill":"greenFill","stroke":"green","sw":2},\n' +
      ' {"s":"path","d":"M60 70 Q220 52 380 70","stroke":"ink","sw":2.5,"fill":"none"},\n' +
      ' {"s":"path","d":"M92 78 Q96 74 100 78 L100 112 Q96 116 92 112 Z","fill":"paper","stroke":"green"},\n' +
      ' {"s":"path","d":"M112 78 Q116 74 120 78 L120 112 Q116 116 112 112 Z","fill":"paper","stroke":"green"},\n' +
      ' {"s":"path","d":"M132 78 Q136 74 140 78 L140 112 Q136 116 132 112 Z","fill":"paper","stroke":"green"},\n' +
      ' {"s":"circle","x":110,"y":132,"r":11,"fill":"paper","stroke":"green"},\n' +
      ' {"s":"circle","x":140,"y":143,"r":9,"fill":"paper","stroke":"green"},\n' +
      ' {"s":"circle","x":168,"y":130,"r":10,"fill":"paper","stroke":"green"},\n' +
      ' {"s":"path","d":"M236 120 Q252 108 268 120 Q252 132 236 120 Z","fill":"blueFill","stroke":"blue"},\n' +
      ' {"s":"path","d":"M236 136 Q252 126 268 136 Q252 146 236 136 Z","fill":"redFill","stroke":"red"},\n' +
      ' {"s":"path","d":"M300 168 Q308 156 316 168","stroke":"green","sw":2.5,"fill":"none"},\n' +
      ' {"s":"path","d":"M324 168 Q332 156 340 168","stroke":"green","sw":2.5,"fill":"none"},\n' +
      ' {"s":"line","x1":118,"y1":74,"x2":118,"y2":48,"stroke":"rule","sw":1},\n' +
      ' {"s":"text","x":118,"y":42,"t":"Palisade cells","size":12,"fill":"ink"},\n' +
      ' {"s":"line","x1":150,"y1":150,"x2":150,"y2":196,"stroke":"rule","sw":1},\n' +
      ' {"s":"text","x":150,"y":208,"t":"Spongy mesophyll","size":12,"fill":"ink"},\n' +
      ' {"s":"line","x1":320,"y1":172,"x2":320,"y2":200,"stroke":"rule","sw":1},\n' +
      ' {"s":"text","x":322,"y":212,"t":"Stoma and guard cells","size":12,"fill":"ink"}]}\n\n' +
      'Now draw YOUR lesson to that standard. Return exactly:\n' +
      '{"type":"drawing","title":"short caption","w":400,"h":250,"shapes":[...]}';
  }

  function momentPrompt(f) {
    return 'A student just got the question below wrong. Draw ONE small picture that\n' +
      'makes the right answer make sense. Return ONLY JSON, no markdown.\n\n' +
      'LESSON: ' + f.lesson + '\n' +
      (f.topic && f.topic !== f.lesson ? 'SPECIFICALLY: ' + f.topic + '\n' : '') +
      (f.subject ? 'SUBJECT: ' + f.subject + '\n' : '') +
      'QUESTION: ' + f.question + '\n' +
      'RIGHT ANSWER: ' + f.answer + '\n' +
      (f.they ? 'THEY ANSWERED (wrong): ' + f.they + '\n' : '') +
      (f.why ? 'WHY: ' + f.why + '\n' : '') +
      '\nDraw the ONE thing the right answer is about - the structure, the motion, the\n' +
      'force, the cause - as it really looks or works. Not the whole lesson: one idea,\n' +
      'drawn big. Do NOT draw boxes with words in them, and do not write the question out.\n' +
      'Canvas: w 400, h 240. x goes right from 0, y goes DOWN from 0. Stay inside.\n' +
      SCENE_SHAPES_DOC +
      'COLOURS ARE NAMES, never hex: ink muted rule paper faint, blue blueFill blueInk,\n' +
      'green greenFill greenInk, red redFill redInk, teal tealFill tealInk,\n' +
      'violet violetFill violetInk, none. There is NO yellow, orange, grey, black or\n' +
      'white - use red for heat or the sun, muted for grey, ink for black.\n' +
      'Path data may only use M L H V Q C A Z and numbers.\n' +
      /* The one rule that makes this picture different from the lesson's.
         A learner who missed the question needs to be shown WHERE the answer
         is, and one colour doing that job is how a textbook does it. */
      'THE BLUE PART IS THE ANSWER. This is what the picture is for:\n' +
      '  - Draw the part the right answer is about in blue (fill "blue" or "blueFill",\n' +
      '    stroke "blue"), and give it a label with fill "blueInk" and "weight":700.\n' +
      '  - Nothing else is blue. Everything else is ink, muted, rule or faint - or its\n' +
      '    natural colour where the colour means something: green for a plant, red\n' +
      '    for blood or heat, teal for water.\n' +
      '  - If their wrong answer names a real part of the picture, it may be in it,\n' +
      '    labelled truthfully in ink - never blue, never as if it were the answer.\n' +
      'RULES: 6 to 30 shapes, at least 4 of them "path" or "poly". 3 to 6 labels, each\n' +
      'under 22 characters, text size 11 or more (12 for the blue label).\n' +
      '  - Never an acronym or a name inside a circle or a box. A label sits OUTSIDE\n' +
      '    the thing it names, in the margin, with a thin leader line to it if it is\n' +
      '    not touching it: {"s":"line","stroke":"rule","sw":1}.\n' +
      '  - Work out where your shapes are BEFORE placing a label. A label whose x,y\n' +
      '    falls inside another shape is wrong.\n' +
      '  - Arrows show movement, force or change - not that two things are related.\n' +
      '  - Every label must be TRUE. No numbers the question and answer do not give.\n' +
      'If the answer is about words, grammar, spelling, a date or a name, and there is\n' +
      'no thing and no motion to draw, return {"type":"none"}. A wrong picture is\n' +
      'worse than no picture.\n\n' +
      /* Rendered and audited clean before it was pasted in (see the diagram
         skill): 21 shapes, every one a path or a poly, 7 labels, one blue
         part. The model copies the example, so the example has to be the
         standard. */
      'EXAMPLE. Question: "A crowbar lifts a heavy rock with a small push. What makes\n' +
      'that possible?" Right answer: "The long arm between the pivot and your push."\n' +
      'Note the real shapes, the arrows for the two forces, every label outside, and\n' +
      'the ONE blue part - the long arm - which is the answer:\n' +
      '{"type":"drawing","title":"Why a small push lifts a big rock","w":400,"h":232,"shapes":[\n' +
      ' {"s":"path","d":"M0 186 L400 186 L400 232 L0 232 Z","fill":"faint","stroke":"none"},\n' +
      ' {"s":"path","d":"M0 186 L400 186","stroke":"ink","sw":1.6,"fill":"none"},\n' +
      ' {"s":"poly","points":"150,186 170,156 190,186","fill":"faint","stroke":"ink","sw":2},\n' +
      ' {"s":"poly","points":"60,165 170,150 170,156 60,171","fill":"muted","stroke":"ink","sw":1.2},\n' +
      ' {"s":"poly","points":"170,150 384,120 384,126 170,156","fill":"blue","stroke":"blueInk","sw":1.2},\n' +
      ' {"s":"path","d":"M58 165 L48 134 L64 108 L96 98 L122 106 L134 132 L128 156 Z","fill":"faint","stroke":"ink","sw":2},\n' +
      ' {"s":"path","d":"M64 108 L84 126 L96 98 M84 126 L110 140 L134 132","stroke":"muted","sw":1.2,"fill":"none"},\n' +
      ' {"s":"path","d":"M92 90 L92 58","stroke":"ink","sw":3.4,"fill":"none","arrow":true},\n' +
      ' {"s":"path","d":"M376 62 L376 114","stroke":"ink","sw":1.6,"fill":"none","arrow":true},\n' +
      ' {"s":"path","d":"M92 204 L170 204 M92 198 L92 210 M170 198 L170 210","stroke":"muted","sw":1.6,"fill":"none"},\n' +
      ' {"s":"path","d":"M170 204 L376 204 M376 198 L376 210","stroke":"blue","sw":2.6,"fill":"none"},\n' +
      ' {"s":"text","x":8,"y":88,"t":"Heavy rock","size":11,"anchor":"start","fill":"ink"},\n' +
      ' {"s":"text","x":104,"y":72,"t":"Big lift","size":11,"anchor":"start","fill":"ink"},\n' +
      ' {"s":"text","x":366,"y":50,"t":"Small push","size":11,"anchor":"middle","fill":"ink"},\n' +
      ' {"s":"text","x":198,"y":178,"t":"Pivot","size":11,"anchor":"start","fill":"ink"},\n' +
      ' {"s":"text","x":131,"y":225,"t":"Short arm","size":11,"anchor":"middle","fill":"muted"},\n' +
      ' {"s":"text","x":273,"y":225,"t":"The long arm","size":12,"anchor":"middle","fill":"blueInk","weight":700}]}\n\n' +
      'Now draw THIS question to that standard. The title says what the picture\n' +
      'shows, in under 45 characters. Return exactly:\n' +
      '{"type":"drawing","title":"short caption","w":400,"h":240,"shapes":[...]}';
  }

  var KINDS = { rect: 1, circle: 1, ellipse: 1, line: 1, path: 1, poly: 1, text: 1 };

  /* Enough shapes, at least one label, only known kinds counted. Not a
     security check - see the header. */
  function looksDrawable(spec) {
    if (!spec || typeof spec !== 'object') return false;
    var sh = spec.shapes;
    if (Object.prototype.toString.call(sh) !== '[object Array]') return false;
    var n = 0, labels = 0, i, k;
    for (i = 0; i < sh.length && i < 80; i++) {
      if (!sh[i] || typeof sh[i] !== 'object') continue;
      k = String(sh[i].s || sh[i].kind || sh[i].type || '').toLowerCase();
      if (!KINDS[k]) continue;
      n++;
      if (k === 'text' && fmStr(sh[i].t || sh[i].text).trim()) labels++;
    }
    return n >= 3 && labels >= 1;
  }

  /* One call to api/generate. Resolves {spec} or {none}; rejects on anything
     that is not the model's answer, so the caller can tell "nothing to draw"
     (remember it) from "the call failed" (ask again later). A late reply
     after the timeout is ignored. */
  function request(prompt, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('timeout'));
      }, ms || 40000);
      fetch('api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        var raw = String((data && (data.result || data.plan)) || '');
        var m = raw.match(/\{[\s\S]*\}/);
        var spec = null;
        if (m) { try { spec = JSON.parse(m[0]); } catch (e) { spec = null; } }
        if (!spec || typeof spec !== 'object') { reject(new Error('no json')); return; }
        if (spec.shapes) resolve({ spec: spec });
        else resolve({ none: true });
      })
      .catch(function (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e || new Error('failed'));
      });
    });
  }

  w.SFDraw = {
    SHAPES_DOC: SCENE_SHAPES_DOC,
    lessonPrompt: lessonPrompt,
    momentPrompt: momentPrompt,
    request: request,
    looksDrawable: looksDrawable
  };
})(window);

/* SFAudit — mechanical checks over rendered SVG.
 *
 * Reading a diagram's source does not tell you whether it looks good. Neither
 * does a screenshot, entirely: a hue you have stopped noticing, a label two
 * pixels under the legibility floor, and white text on a white box all
 * photograph fine. This measures what is measurable so the looking can be spent
 * on what is not.
 *
 * Runs in a real browser on purpose — getBoundingClientRect, getScreenCTM and
 * getPointAtLength are real here. Everything is judged in SCREEN pixels at
 * phone width, because that is the only size a learner ever sees.
 *
 * Usage, on any page with SVGs in it:
 *     SFAudit()                                  // every svg on the page
 *     SFAudit(document.querySelector('#lesson-art'))
 *     SFAudit(el, { sources: ['Causes of the French Revolution'] })
 *     console.log(SFAudit.summary(SFAudit()))
 *
 * Returns [{ index, findings: [{ level, code, message }], counts }].
 * level is 'fail' | 'warn' | 'info'.
 *
 * Every threshold here was tuned against real StudyFlow output — the 23 curated
 * templates and all 11 kit layouts. A check that fires on a good drawing is
 * worse than no check, because it teaches you to skim the report.
 */
(function (global) {
  'use strict';

  /* The lesson card is ~343px of content inside a 375px phone. The board is
     width:100%, so the viewBox decides the type size: 9 units in a 470-wide
     viewBox lands at 6.6px. W sets the scale. */
  var PHONE_CONTENT_PX = 343;
  var TEXT_FAIL_PX = 7;       /* below this nobody reads it */
  var TEXT_WARN_PX = 9;       /* below this it is small on a phone */
  var MIN_CONTRAST = 3.0;     /* WCAG large-text floor */
  var FILL_RATIO = 0.7;       /* content should fill most of its own frame */
  var ROLE_MIN = 3;           /* a "series" is 3+ elements of the same kind */

  var HUE_NAMES = [
    [345, 361, 'red'], [-1, 18, 'red'], [18, 45, 'orange'], [45, 70, 'yellow'],
    [70, 160, 'green'], [160, 200, 'teal'], [200, 250, 'blue'],
    [250, 292, 'purple'], [292, 345, 'pink']
  ];

  var probe = null;
  function toRGB(value) {
    if (!value) return null;
    var v = String(value).trim().toLowerCase();
    if (!v || v === 'none' || v === 'transparent' || v.indexOf('url(') === 0) return null;
    if (!probe) {
      probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
    }
    probe.style.color = '';
    probe.style.color = v;
    if (!probe.style.color) return null;
    var out = global.getComputedStyle(probe).color;
    var m = out && out.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',');
    if (p.length > 3 && parseFloat(p[3]) < 0.12) return null;
    return [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2])];
  }

  function toHSL(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0, s = 0, l = (max + min) / 2;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function hueFamily(rgb) {
    var hsl = toHSL(rgb);
    /* Greys, near-blacks and true whites are structure, not colour: ink, rules
       and paper. A pale TINT is not exempt — #eaf1ff is 96% light and still
       reads as a blue box. */
    if (hsl[1] < 0.15) return null;
    if (hsl[2] > 0.985 || hsl[2] < 0.06) return null;
    for (var i = 0; i < HUE_NAMES.length; i++) {
      if (hsl[0] > HUE_NAMES[i][0] && hsl[0] <= HUE_NAMES[i][1]) return HUE_NAMES[i][2];
    }
    return 'red';
  }

  function luminance(rgb) {
    var c = [], i, v;
    for (i = 0; i < 3; i++) {
      v = rgb[i] / 255;
      c.push(v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    }
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function attrOf(el, name) {
    var v = el.getAttribute(name);
    if (v === null && global.getComputedStyle) {
      var cs = global.getComputedStyle(el)[name];
      if (cs && cs !== 'none') v = cs;
    }
    return v;
  }

  function rectsOverlap(a, b, pad) {
    pad = pad || 0;
    return !(a.right - pad <= b.left || b.right - pad <= a.left ||
             a.bottom - pad <= b.top || b.bottom - pad <= a.top);
  }

  function overlapArea(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }

  function pointInRect(p, r, pad) {
    pad = pad || 0;
    return p.x > r.left + pad && p.x < r.right - pad &&
           p.y > r.top + pad && p.y < r.bottom - pad;
  }

  function fmt(n) { return Math.round(n * 10) / 10; }

  /* Is a SCREEN point inside an element's filled area? Falls back to "yes"
     (the bounding-box answer) where the browser cannot say. */
  function insideFill(el, sx, sy) {
    try {
      if (!el.isPointInFill || !el.getScreenCTM) return true;
      var m = el.getScreenCTM();
      if (!m) return true;
      var svg = el.ownerSVGElement, pt = svg.createSVGPoint();
      pt.x = sx; pt.y = sy;
      var local = pt.matrixTransform(m.inverse());
      return el.isPointInFill(local);
    } catch (e) { return true; }
  }

  /* Points along a stroke, in screen space. A label a curve runs through is
     invisible to a bbox test — the curve's own box is huge and mostly empty. */
  function strokePoints(el) {
    var pts = [], ctm = el.getScreenCTM(), i, p, tag = el.tagName.toLowerCase();
    var svg = el.ownerSVGElement;
    if (!ctm || !svg) return pts;
    function push(x, y) {
      var q = svg.createSVGPoint();
      q.x = x; q.y = y;
      pts.push(q.matrixTransform(ctm));
    }
    try {
      if (tag === 'path' && el.getTotalLength) {
        var len = el.getTotalLength();
        if (!len) return pts;
        var n = Math.max(12, Math.min(160, Math.round(len / 2)));
        for (i = 0; i <= n; i++) {
          p = el.getPointAtLength(len * i / n);
          push(p.x, p.y);
        }
      } else if (tag === 'line') {
        var x1 = +el.getAttribute('x1'), y1 = +el.getAttribute('y1');
        var x2 = +el.getAttribute('x2'), y2 = +el.getAttribute('y2');
        for (i = 0; i <= 30; i++) push(x1 + (x2 - x1) * i / 30, y1 + (y2 - y1) * i / 30);
      } else if (tag === 'polyline' || tag === 'polygon') {
        var raw = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
        for (i = 0; i + 1 < raw.length; i += 2) push(raw[i], raw[i + 1]);
      }
    } catch (e) { /* a malformed d= is the renderer's problem, not the audit's */ }
    return pts;
  }

  function isConnector(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'line') return true;
    if (tag !== 'path' && tag !== 'polyline') return false;
    var fill = attrOf(el, 'fill');
    return !fill || fill === 'none';
  }

  /* Something drawn, rather than something that holds text. A flowchart is
     boxes and the lines between them; a picture has form in it. */
  function isDrawnForm(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'polygon' || tag === 'circle' || tag === 'ellipse') return true;
    if (tag === 'path') {
      var d = el.getAttribute('d') || '';
      if (/[CcQqAaSsTt]/.test(d)) return true;               /* curvature */
      var moves = d.match(/[MmLlHhVv]/g);
      return !!(moves && moves.length > 3);                   /* a drawn outline */
    }
    return false;
  }

  /* What KIND of element this is, roughly: tag, roundedness, stroke weight and
     a coarse size bucket. Two nodes of a flow chart share a role; a sun and a
     leaf do not. The rainbow that matters is hue varying ACROSS ONE ROLE —
     that is rotation, and rotation is decoration by definition. Representational
     colour (yellow sun, blue water, green leaf) varies across roles and is
     exactly what a good drawing does. */
  function roleKey(el, rect) {
    var tag = el.tagName.toLowerCase();
    var rx = el.getAttribute('rx') ? 'r' : 's';
    var sw = attrOf(el, 'stroke-width') || '1';
    /* Bucketed by ORDER OF MAGNITUDE of the longest side, not by exact size.
       Exact size split a flow chart's boxes the moment one label wrapped to two
       lines, which hid the very rotation this check exists to find; no size
       bucket at all grouped a 400-wide sky band with a 36-wide meteor and
       called a drawing's representational colour a rainbow. A log bucket keeps
       a series together and keeps unrelated things apart. */
    var mag = Math.round(Math.log(Math.max(rect.width, rect.height, 1)) / Math.LN2);
    return tag + '|' + rx + '|' + sw + '|' + mag;
  }

  function words(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9À-ɏ\s%°]/g, ' ')
      .split(/\s+/).filter(function (w) { return w.length > 2; });
  }

  function auditOne(svg, opts, index) {
    var findings = [];
    function add(level, code, message) { findings.push({ level: level, code: code, message: message }); }

    var vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    var vbW = vb.length === 4 && vb[2] ? vb[2] : 0;
    var vbH = vb.length === 4 && vb[3] ? vb[3] : 0;
    var svgRect = svg.getBoundingClientRect();
    /* The kit caps its own width (max-width: min(w*1.15, 560)px), so a narrow
       diagram does NOT stretch to fill a phone — a 200-wide flow renders at
       230px, not 343. Assuming it stretched overstated every narrow diagram's
       type by half again. */
    var phonePx = PHONE_CONTENT_PX;
    var mw = /max-width\s*:\s*([\d.]+)px/i.exec(svg.getAttribute('style') || '');
    if (mw && parseFloat(mw[1]) < phonePx) phonePx = parseFloat(mw[1]);
    var wAttr = svg.getAttribute('width');
    if (wAttr && /^\s*[\d.]+\s*(px)?\s*$/.test(wAttr) && parseFloat(wAttr) < phonePx) phonePx = parseFloat(wAttr);
    var phoneScale = vbW ? phonePx / vbW : 1;

    var texts = [].slice.call(svg.querySelectorAll('text'));
    var geo = [].slice.call(svg.querySelectorAll('rect,circle,ellipse,path,polygon,polyline,line'));
    var i, j, k;

    /* Screen rects once — everything below is measured in them, so transforms,
       rotation and nesting are already accounted for. getBBox is not: it
       ignores the element's own transform, and reported a rotated axis label as
       hanging off the canvas when it was plainly inside it. */
    var geoRects = [], textBoxes = [], hidden = 0;
    for (i = 0; i < geo.length; i++) geoRects.push(geo[i].getBoundingClientRect());
    for (i = 0; i < texts.length; i++) {
      var tr = texts[i].getBoundingClientRect();
      if (!tr.width || !tr.height) { hidden++; continue; }
      textBoxes.push({ el: texts[i], r: tr, s: texts[i].textContent || '' });
    }

    /* ---- 1. colour: rotation, or meaning? ---------------------------- */
    var roles = {}, allFamilies = {}, famCount = 0, f;
    for (i = 0; i < geo.length; i++) {
      var key = roleKey(geo[i], geoRects[i]);
      var here = {};
      var paint = [attrOf(geo[i], 'fill'), attrOf(geo[i], 'stroke')];
      for (j = 0; j < paint.length; j++) {
        var rgb = toRGB(paint[j]);
        if (!rgb) continue;
        f = hueFamily(rgb);
        if (!f) continue;
        here[f] = 1;
        if (!allFamilies[f]) { allFamilies[f] = 1; famCount++; }
      }
      if (!roles[key]) roles[key] = { n: 0, fams: {}, count: 0 };
      roles[key].n++;
      for (var fam in here) {
        if (!roles[key].fams[fam]) { roles[key].fams[fam] = 1; roles[key].count++; }
      }
    }
    var worstRole = null;
    for (var rk in roles) {
      if (roles[rk].n >= ROLE_MIN && roles[rk].count >= 3 &&
          (!worstRole || roles[rk].count > worstRole.count)) {
        worstRole = roles[rk];
      }
    }
    if (worstRole) {
      add('warn', 'rotated-hue',
          worstRole.n + ' elements of the same kind carry ' + worstRole.count + ' different hues (' +
          Object.keys(worstRole.fams).join(', ') + '). Rotating hue through a series is ' +
          'decoration: the colour tells the learner nothing the position does not. Use one hue ' +
          'at different tints, or say what each hue means.');
    }

    /* ---- 2. is anything actually drawn? ------------------------------ */
    /* A rect is a CONTAINER only when a label sits inside it. A rect with no
       text in it is geometry: a bar whose length is the data, a piece of an
       area model, a fraction strip. Counting those as boxes called every bar
       chart a flowchart. */
    var forms = 0, containers = 0;
    for (i = 0; i < geo.length; i++) {
      var tag = geo[i].tagName.toLowerCase();
      if (tag === 'rect') {
        var gr0 = geoRects[i], holds = false;
        for (j = 0; j < textBoxes.length && !holds; j++) {
          var tcx = (textBoxes[j].r.left + textBoxes[j].r.right) / 2;
          var tcy = (textBoxes[j].r.top + textBoxes[j].r.bottom) / 2;
          if (tcx > gr0.left && tcx < gr0.right && tcy > gr0.top && tcy < gr0.bottom) holds = true;
        }
        if (holds) containers++;
        else if (gr0.width > 2 && gr0.height > 2) forms++;
        continue;
      }
      if (isDrawnForm(geo[i])) forms++;
    }
    if (forms === 0 && texts.length >= 3) {
      /* A warning, not a failure: a flow chart IS boxes by design, and a check
         that fails every flow teaches you to skim the report. What it cannot
         know is whether the topic has a physical form - that is the question
         it hands back. */
      add('warn', 'box-and-arrow',
          'Nothing is drawn: ' + containers + ' text boxes, ' + texts.length + ' labels, no form. ' +
          'Right for a relation (steps, a loop, a 2x2); wrong for a THING - a cell, a volcano, ' +
          'the atmosphere - which should be drawn, not boxed.');
    } else if (forms > 0 && forms < 3 && containers >= forms * 3) {
      add('warn', 'mostly-boxes',
          containers + ' boxes to ' + forms + ' drawn shapes. Check the picture carries ' +
          'something the labels do not.');
    }

    /* ---- 3. type size at phone width --------------------------------- */
    var smallest = Infinity, smallestS = '';
    for (i = 0; i < texts.length; i++) {
      var fs = parseFloat(attrOf(texts[i], 'font-size')) || 0;
      if (!fs) continue;
      var px = fs * phoneScale;
      if (px < smallest) { smallest = px; smallestS = (texts[i].textContent || '').slice(0, 30); }
    }
    if (smallest < TEXT_WARN_PX) {
      add(smallest < TEXT_FAIL_PX ? 'fail' : 'warn', 'small-text',
          '"' + smallestS + '" renders at ' + fmt(smallest) + 'px on a 375px phone (' +
          fmt(smallest / phoneScale) + ' units in a ' + vbW + '-wide viewBox). ' +
          'Narrow the viewBox, raise the size, or cut the label — W sets the scale, and ' +
          'a narrower board scales UP where there is room.');
    }

    /* ---- 4. label collisions ----------------------------------------- */
    var collided = 0, firstPair = null;
    for (i = 0; i < textBoxes.length; i++) {
      for (j = i + 1; j < textBoxes.length; j++) {
        if (!rectsOverlap(textBoxes[i].r, textBoxes[j].r, 1)) continue;
        var a = overlapArea(textBoxes[i].r, textBoxes[j].r);
        var small = Math.min(textBoxes[i].r.width * textBoxes[i].r.height,
                             textBoxes[j].r.width * textBoxes[j].r.height);
        if (small && a / small > 0.08) {
          collided++;
          if (!firstPair) {
            firstPair = '"' + textBoxes[i].s.slice(0, 22) + '" / "' + textBoxes[j].s.slice(0, 22) + '"';
          }
        }
      }
    }
    if (collided) {
      add('fail', 'label-overlap',
          collided + ' label pair' + (collided > 1 ? 's overlap' : ' overlaps') + ', e.g. ' +
          firstPair + '. Two labels in one place is one unreadable label.');
    }

    /* ---- 5. labels with a line through them --------------------------- */
    /* Paint order matters: a spoke drawn before a filled hub is hidden by it,
       and flagging that would be a lie about what is on screen. */
    function occludedAt(fromIdx, p) {
      for (var m = fromIdx + 1; m < geo.length; m++) {
        var fill = toRGB(attrOf(geo[m], 'fill'));
        if (!fill) continue;
        if (pointInRect(p, geoRects[m], 0)) return true;
      }
      return false;
    }
    var onStroke = null;
    for (i = 0; i < geo.length && !onStroke; i++) {
      if (!isConnector(geo[i])) continue;
      var sc = toRGB(attrOf(geo[i], 'stroke'));
      if (!sc) continue;
      /* A gridline at #eef2f7 is 1.1:1 against paper. A label over it is not
         a label with a line through it; nobody can see the line. */
      var so = parseFloat(attrOf(geo[i], 'stroke-opacity') || attrOf(geo[i], 'opacity') || '1');
      if (contrast(sc, [255, 255, 255]) < 1.3 || so < 0.2) continue;
      var pts = strokePoints(geo[i]);
      for (j = 0; j < textBoxes.length && !onStroke; j++) {
        var hits = 0;
        for (k = 0; k < pts.length; k++) {
          if (!pointInRect(pts[k], textBoxes[j].r, 1.5)) continue;
          if (occludedAt(i, pts[k])) continue;
          if (++hits >= 3) { onStroke = textBoxes[j].s.slice(0, 30); break; }
        }
      }
    }
    if (onStroke) {
      add('fail', 'text-on-line',
          '"' + onStroke + '" has a line running through it. Move the label off the curve, ' +
          'or give it a paper-coloured stroke behind the glyphs (paint-order="stroke"), the ' +
          'way a map sets place names over terrain.');
    }

    /* ---- 6. invisible text -------------------------------------------- */
    for (i = 0; i < textBoxes.length; i++) {
      var tf = toRGB(attrOf(textBoxes[i].el, 'fill')) || [26, 29, 46];
      var cx = (textBoxes[i].r.left + textBoxes[i].r.right) / 2;
      var cy = (textBoxes[i].r.top + textBoxes[i].r.bottom) / 2;
      var bg = [255, 255, 255], hitEl = null;
      for (j = 0; j < geo.length; j++) {
        var gf = toRGB(attrOf(geo[j], 'fill'));
        if (!gf) continue;
        var gr = geoRects[j];
        if (!(cx > gr.left && cx < gr.right && cy > gr.top && cy < gr.bottom)) continue;
        /* The bounding box is not the shape. A curved slab's box includes
           the empty space under its curve, and text sitting there was
           reported as dark-on-dark. Ask the geometry itself. */
        if (!insideFill(geo[j], cx, cy)) continue;
        bg = gf; hitEl = geo[j];
      }
      var ratio = contrast(tf, bg);
      if (ratio < MIN_CONTRAST) {
        add('fail', 'low-contrast',
            '"' + textBoxes[i].s.slice(0, 30) + '" is ' + fmt(ratio) + ':1 against what is behind it' +
            (hitEl ? ' (' + hitEl.tagName.toLowerCase() + ')' : '') +
            '. This palette has no dark fills, so near-white text is invisible — use ink.');
        break;
      }
    }

    /* ---- 7. clipped at the edge, and dead space ----------------------- */
    if (svgRect.width && svgRect.height) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, seen = 0;
      var all = geoRects.concat(textBoxes.map(function (b) { return b.r; }));
      for (i = 0; i < all.length; i++) {
        if (!all[i].width && !all[i].height) continue;
        seen++;
        if (all[i].left < minX) minX = all[i].left;
        if (all[i].top < minY) minY = all[i].top;
        if (all[i].right > maxX) maxX = all[i].right;
        if (all[i].bottom > maxY) maxY = all[i].bottom;
      }
      if (seen) {
        var over = [];
        if (minX < svgRect.left - 1) over.push('left');
        if (minY < svgRect.top - 1) over.push('top');
        if (maxX > svgRect.right + 1) over.push('right');
        if (maxY > svgRect.bottom + 1) over.push('bottom');
        if (over.length) {
          add('fail', 'off-canvas',
              'Content runs past the ' + over.join(' and ') + ' edge and is clipped. Clamp the ' +
              'whole WORD, not its anchor point — a middle-anchored label hangs half its ' +
              'width either side of x.');
        }
        var fillW = (maxX - minX) / svgRect.width, fillH = (maxY - minY) / svgRect.height;
        if (fillW < FILL_RATIO || fillH < FILL_RATIO) {
          add('warn', 'dead-space',
              'Content fills ' + Math.round(fillW * 100) + '% of the width and ' +
              Math.round(fillH * 100) + '% of the height. An empty band reads as a mistake — ' +
              'crop the viewBox to the drawing, or use the room.');
        }
      }
    }

    /* ---- 8. words that went in and did not come out -------------------- */
    /* Compared against every label on the card, not label by label: the kit
       wraps one item onto two lines and splits "Nitrogen: 78" into a name and a
       value, and neither is a loss. A word that is nowhere is a loss. */
    var rendered = {}, srcList = (opts && opts.sources) || [];
    for (i = 0; i < textBoxes.length; i++) {
      var ws = words(textBoxes[i].s);
      for (j = 0; j < ws.length; j++) rendered[ws[j]] = 1;
    }
    if (textBoxes.length) {
      for (i = 0; i < srcList.length; i++) {
        var sw2 = words(srcList[i]);
        if (sw2.length < 2) continue;
        var missing = [];
        for (j = 0; j < sw2.length; j++) if (!rendered[sw2[j]]) missing.push(sw2[j]);
        if (missing.length && missing.length < sw2.length) {
          add('fail', 'dropped-words',
              '"' + srcList[i] + '" reached the drawing as a fragment — ' +
              missing.join(', ') + ' appear' + (missing.length > 1 ? '' : 's') + ' nowhere on it. ' +
              'A label trimmed to fit says something the material did not; rewrite it shorter ' +
              'instead, at the source.');
          break;
        }
      }
    }

    if (hidden) add('info', 'unmeasured', hidden + ' label(s) had no box — hidden, or not laid out.');

    return {
      index: index,
      findings: findings,
      counts: {
        shapes: geo.length, labels: texts.length, forms: forms, containers: containers,
        hues: Object.keys(allFamilies), viewBox: vbW + '×' + vbH,
        smallestTextPx: smallest === Infinity ? null : fmt(smallest),
        renderedWidth: Math.round(svgRect.width)
      }
    };
  }

  function SFAudit(root, opts) {
    opts = opts || {};
    var scope = root || document;
    var svgs = scope.tagName && scope.tagName.toLowerCase() === 'svg'
      ? [scope] : [].slice.call(scope.querySelectorAll('svg'));
    var out = [], i;
    for (i = 0; i < svgs.length; i++) out.push(auditOne(svgs[i], opts, i));
    return out;
  }

  SFAudit.summary = function (results) {
    var lines = [], i, j;
    for (i = 0; i < results.length; i++) {
      var r = results[i], bad = 0, warn = 0;
      for (j = 0; j < r.findings.length; j++) {
        if (r.findings[j].level === 'fail') bad++;
        else if (r.findings[j].level === 'warn') warn++;
      }
      lines.push('#' + r.index + ' ' + (bad ? bad + ' FAIL' : (warn ? warn + ' warn' : 'clean')) +
                 ' · ' + r.counts.shapes + ' shapes, ' + r.counts.forms + ' drawn, ' +
                 r.counts.hues.length + ' hues, smallest ' + r.counts.smallestTextPx + 'px');
      for (j = 0; j < r.findings.length; j++) {
        if (r.findings[j].level === 'info') continue;
        lines.push('   [' + r.findings[j].level + '] ' + r.findings[j].code + ': ' + r.findings[j].message);
      }
    }
    return lines.join('\n');
  };

  global.SFAudit = SFAudit;
})(window);

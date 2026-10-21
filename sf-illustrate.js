/* sf-illustrate.js - makes a real illustration ready for a phone.

   One implementation for two callers:
     - the offline pipeline (.claude/skills/diagram/scripts/prep-illustration.html,
       run by prep_illustration.py) that built the 14 files in illustrations/;
     - the lesson page, for an illustration found on Wikimedia Commons for
       THIS lesson (api/illustration.js) - so a picture found live gets
       exactly the treatment the hand-picked ones got.

     SFIllustrate.prepare(svgText, job [, opts])  -> Promise of
       { svg, report: { labels, missingKeys, overlaps, legible, w, h } }

   What it does, in order: keeps only drawing (a sanitise pass BEFORE anything
   is put on the page), resolves <switch> to English, bakes a <style> block's
   classes into the elements, measures every label after all transforms,
   merges split labels (CO + 2 -> CO₂), translates/drops/keeps per the job,
   crops to the drawing, re-sets every label in DM Sans at phone size (the
   key ones bold, so the labelling card can pin them), crops again round the
   bigger labels, and bakes the credit in.

   It needs a real layout (a label's place is its box after every transform),
   so the file is drawn off-screen, inside a SHADOW ROOT: a file's own
   <style> - "* { display: none }" in the worst case - cannot reach the page.

   job: { id, title, credit, key:[exact labels, in order], terms:[the day's key
          terms - labels naming one become key], translate:{}, drop:[], keep:[],
          leave:[], join:[], nudge:{}, add:[], hide:[selectors], page:bool }
   opts.finalize: run the allowlist again on the result (the lesson page does;
                  the offline pipeline sanitises in Python instead). */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FONT = "'DM Sans', system-ui, -apple-system, sans-serif";
  var PROPS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap',
               'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'display', 'visibility',
               'clip-path', 'mask'];
  var PRIM = /^(fegaussianblur|feoffset|feblend|fecolormatrix|fecomposite|feflood|femerge|femergenode)$/;
  var SUB = '₀₁₂₃₄₅₆₇₈₉';

  /* Elements that draw. `a` is unwrapped (its children kept), anything else
     not listed is removed with its contents. */
  var DRAW = { svg: 1, g: 1, path: 1, rect: 1, circle: 1, ellipse: 1, line: 1, polyline: 1, polygon: 1, text: 1,
               tspan: 1, textpath: 1, defs: 1, lineargradient: 1, radialgradient: 1, stop: 1, clippath: 1, mask: 1,
               pattern: 1, use: 1, symbol: 1, marker: 1, filter: 1, fegaussianblur: 1, feoffset: 1, feblend: 1,
               fecolormatrix: 1, fecomposite: 1, feflood: 1, femerge: 1, femergenode: 1, switch: 1, style: 1 };
  var FINAL = {};
  Object.keys(DRAW).forEach(function (k) { if (k !== 'switch' && k !== 'style' && k !== 'textpath') FINAL[k] = 1; });

  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function squash(s) { return norm(s).replace(/\s+/g, '').toLowerCase(); }
  function r1(n) { return Math.round(n * 10) / 10; }

  function cleanCss(css) {
    return String(css).replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(?!['"]?\s*#)[^)]*\)/gi, 'none')
      .replace(/expression\s*\(|javascript:|behavior\s*:|-moz-binding/gi, '');
  }

  /* Walks a parsed tree and removes what does not draw. Runs on an INERT
     document, so nothing in the file can run before it is gone. */
  function scrub(root, allowed) {
    var all = Array.prototype.slice.call(root.querySelectorAll('*')), i, el, tag, j, a, n, v;
    for (i = 0; i < all.length; i++) {
      el = all[i];
      if (!el.parentNode) continue;
      tag = String(el.localName).toLowerCase();
      if (tag === 'a') { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.parentNode.removeChild(el); continue; }
      /* Filter primitives stay for now, whichever they are: run() drops a
         whole filter built from ones the page cannot keep, with every
         reference to it - removing just the primitive here would leave an
         emptied filter, and an element under an empty filter is not drawn.
         feImage is the one primitive that can fetch from outside. */
      if (!allowed[tag] && !(allowed === DRAW && /^fe/.test(tag) && tag !== 'feimage')) { el.parentNode.removeChild(el); continue; }
      if (tag === 'style') el.textContent = cleanCss(el.textContent);
    }
    all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    for (i = 0; i < all.length; i++) {
      el = all[i];
      for (j = el.attributes.length - 1; j >= 0; j--) {
        a = el.attributes[j]; n = String(a.name).toLowerCase(); v = String(a.value);
        if (/^on/.test(n) ||
            ((n === 'href' || n === 'xlink:href') && v.charAt(0) !== '#') ||
            /javascript:|data:|expression\(|vbscript:/i.test(v) ||
            (n !== 'style' && /url\(\s*(?!['"]?\s*#)/i.test(v))) { el.removeAttribute(a.name); continue; }
        if (n === 'style') el.setAttribute('style', cleanCss(v));
      }
    }
  }

  /* Text -> a clean <svg> element, parsed where nothing can run. */
  function parseSafe(text) {
    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = String(text || '');
    var svg = doc.body.querySelector('svg');
    if (!svg) return null;
    scrub(svg, DRAW);
    return document.importNode(svg, true);
  }

  /* The allowlist once more, on the finished picture: no <style>, no
     <switch> are left by then, so neither is allowed through. */
  function finalize(str) {
    var doc;
    try { doc = new DOMParser().parseFromString(str, 'image/svg+xml'); } catch (e) { return null; }
    var root = doc && doc.documentElement;
    if (!root || String(root.localName).toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
    scrub(root, FINAL);
    return new XMLSerializer().serializeToString(root);
  }

  /* An off-screen place with real layout, sealed from the page. */
  function stage() {
    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    /* all:initial so nothing the page sets is inherited into the picture,
       and hidden by opacity - NOT visibility, which children inherit and
       the style-baking step would then write onto every element of the
       drawing (it did, and the whole picture came out invisible). */
    host.style.cssText = 'all:initial;display:block;position:absolute;left:-20000px;top:0;width:1000px;opacity:0;pointer-events:none;contain:layout style;';
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var box = document.createElement('div');
    box.style.width = '1000px';
    root.appendChild(box);
    return { host: host, box: box };
  }

  function overlapCount(texts) {
    var boxes = [], i, j, n = 0;
    for (i = 0; i < texts.length; i++) {
      try { var b = texts[i].getBBox(); if (b.width && b.height) boxes.push(b); } catch (e) { /* not laid out */ }
    }
    for (i = 0; i < boxes.length; i++) {
      for (j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], c = boxes[j];
        var ix = Math.min(a.x + a.width, c.x + c.width) - Math.max(a.x, c.x);
        var iy = Math.min(a.y + a.height, c.y + c.height) - Math.max(a.y, c.y);
        if (ix <= 0 || iy <= 0) continue;
        if (ix * iy > 0.2 * Math.min(a.width * a.height, c.width * c.height)) n++;
      }
    }
    return n;
  }

  function prepare(txt, job, opts) {
    opts = opts || {};
    job = job || {};
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return fonts.then(function () {
      var svg = parseSafe(txt);
      if (!svg) throw new Error('no svg');
      var st = stage();
      try {
        st.box.appendChild(svg);
        return run(svg, job, opts);
      } finally {
        if (st.host.parentNode) st.host.parentNode.removeChild(st.host);
      }
    });
  }

  function run(svg, job, opts) {
    if (!svg.getAttribute('viewBox')) {
      var w0 = parseFloat(svg.getAttribute('width')) || 1000, h0 = parseFloat(svg.getAttribute('height')) || 1000;
      svg.setAttribute('viewBox', '0 0 ' + w0 + ' ' + h0);
    }
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('width', '1000');

    /* 1. A <style> block's classes would leak into the whole page once the
          picture is inlined (and two files both use ".st0"). Bake the
          computed values into each element, then drop the block. */
    var styles = svg.querySelectorAll('style');
    if (styles.length) {
      svg.querySelectorAll('[class]').forEach(function (el) {
        var cs = getComputedStyle(el);
        PROPS.forEach(function (p) {
          var v = cs.getPropertyValue(p);
          if (v && !el.getAttribute(p)) el.setAttribute(p, v.indexOf('url(') >= 0 ? v.replace(/url\("?[^#"]*#/, 'url(#').replace(/"\)/, ')') : v);
        });
        el.removeAttribute('class');
      });
      styles.forEach(function (s) { s.remove(); });
    }

    /* 1b. A <switch> holds the same label in several languages; keep the
           English child (or the default one) and drop the rest. */
    Array.prototype.slice.call(svg.querySelectorAll('switch')).forEach(function (sw) {
      var kids = Array.prototype.slice.call(sw.children), pick = null;
      kids.forEach(function (k) { if (!pick && /(^|[\s,])en\b/.test(k.getAttribute('systemLanguage') || '')) pick = k; });
      kids.forEach(function (k) { if (!pick && !k.hasAttribute('systemLanguage')) pick = k; });
      kids.forEach(function (k) { if (k !== pick) k.remove(); });
      if (pick) pick.removeAttribute('systemLanguage');
      var g2 = document.createElementNS(NS, 'g');
      Array.prototype.slice.call(sw.attributes).forEach(function (a) { g2.setAttribute(a.name, a.value); });
      while (sw.firstChild) g2.appendChild(sw.firstChild);
      sw.parentNode.replaceChild(g2, sw);
    });
    var leave = (job.leave || []).map(squash);

    /* 1b2. A filter built from primitives the app's sanitiser does not
           allow (lighting, turbulence...) would be stripped to an empty
           filter on the page, and an element under an empty filter is not
           drawn at all. Drop the filter and every reference to it here. */
    Array.prototype.slice.call(svg.querySelectorAll('filter')).forEach(function (f) {
      var bad = Array.prototype.some.call(f.querySelectorAll('*'), function (k) { return !PRIM.test(String(k.localName).toLowerCase()); });
      if (!bad) return;
      var id = f.getAttribute('id');
      if (id) svg.querySelectorAll('[filter], [style]').forEach(function (el) {
        if ((el.getAttribute('filter') || '').indexOf('#' + id + ')') >= 0) el.removeAttribute('filter');
        var st = el.getAttribute('style') || '';
        if (st.indexOf('#' + id + ')') >= 0) el.setAttribute('style', st.replace(/filter\s*:\s*url\([^)]*\)\s*;?/g, ''));
      });
      f.remove();
    });

    /* 1c. Parts of the file that are not drawing: the leader lines of labels
           we drop, a stray layer. CSS selectors, written in the catalogue. */
    (job.hide || []).forEach(function (sel) {
      svg.querySelectorAll(sel).forEach(function (el) { el.remove(); });
    });

    /* 2. Every label, measured in the root's own units, then removed. */
    var vb = svg.viewBox.baseVal, inv = svg.getScreenCTM().inverse();
    var page = { x0: vb.x, y0: vb.y, x1: vb.x + vb.width, y1: vb.y + vb.height };
    function rootBox(el) {
      var b = el.getBBox(), m = inv.multiply(el.getScreenCTM());
      var pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(function (p) {
        var P = svg.createSVGPoint(); P.x = p[0]; P.y = p[1]; P = P.matrixTransform(m); return [P.x, P.y];
      });
      var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
      return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
    }
    var labels = [];
    Array.prototype.slice.call(svg.querySelectorAll('text')).forEach(function (t) {
      if (t.closest('defs')) return;
      var spans = t.querySelectorAll('tspan'), lines = [];
      /* Bare text, then a tspan per further line - "Stapes<tspan x="0" y="20">(attached
         to</tspan><tspan x="0" y="40">oval window)</tspan>" (Commons' ear). Read by
         tspans only, "Stapes" was lost; by textContent, "Semicircular" + "canals" read
         "Semicircularcanals". A tspan with its own x and y starts a line; one without
         (a subscript, a bold word) carries on the line it is in. */
      var bare = Array.prototype.some.call(t.childNodes, function (n) { return n.nodeType === 3 && norm(n.nodeValue); });
      if (bare && spans.length) {
        Array.prototype.forEach.call(t.childNodes, function (n) {
          var raw = n.textContent || '';
          var br = n.nodeType === 1 && n.hasAttribute('x') && (n.hasAttribute('y') || n.hasAttribute('dy'));
          if ((br || !lines.length) && norm(raw)) lines.push(raw); else if (lines.length) lines[lines.length - 1] += raw;
        });
        lines = lines.map(norm).filter(Boolean);
      } else if (spans.length > 1) {
        var lastY = null;
        spans.forEach(function (s) {
          var y = s.getBBox ? Math.round(s.getBBox().y) : 0, v = norm(s.textContent);
          if (!v) return;
          if (lastY !== null && Math.abs(y - lastY) < 2 && lines.length) lines[lines.length - 1] += v; else lines.push(v);
          lastY = y;
        });
      }
      if (!lines.length) lines = [norm(t.textContent)];
      var full = norm(lines.join(' '));
      if (!full) { t.remove(); return; }
      if (leave.indexOf(squash(full)) >= 0) return;          // part of the drawing, not a label
      var box = rootBox(t), cs = getComputedStyle(t);
      var scale = Math.sqrt(Math.abs(inv.multiply(t.getScreenCTM()).a * inv.multiply(t.getScreenCTM()).d));
      labels.push({ text: full, lines: lines, box: box, anchor: cs.textAnchor || 'start',
                    size: (parseFloat(cs.fontSize) || 12) * (scale || 1) });
      t.remove();
    });
    /* Pieces written as separate texts on one line - "CO" then a lowered "2"
       - are one label. A lone digit after letters is a subscript. */
    labels.sort(function (a, b) { return a.box.x0 - b.box.x0; });
    for (var mi = 0; mi < labels.length; mi++) {
      var A = labels[mi];
      if (!A || A.lines.length > 1) continue;
      for (var mj = 0; mj < labels.length; mj++) {
        var B = labels[mj];
        if (!B || B === A || B.lines.length > 1) continue;
        var ah = A.box.y1 - A.box.y0, gap = B.box.x0 - A.box.x1;
        var sameLine = B.box.y0 < A.box.y1 && B.box.y1 > A.box.y0 + ah * 0.3;
        if (!sameLine || gap < -1 || gap > ah * 0.45) continue;
        var sub = /^\d+$/.test(B.text) && /[A-Za-z]$/.test(A.text);
        A.text = A.text + (sub ? B.text.replace(/\d/g, function (d) { return SUB.charAt(+d); }) : (gap > ah * 0.15 ? ' ' : '') + B.text);
        A.lines = [A.text];
        A.box = { x0: A.box.x0, x1: Math.max(A.box.x1, B.box.x1), y0: Math.min(A.box.y0, B.box.y0), y1: Math.max(A.box.y1, B.box.y1) };
        labels[mj] = null; mj = -1;
      }
    }
    labels = labels.filter(Boolean);
    /* A label written as one text per line ("Small" over "intestine") is one
       label - but only when the catalogue says so (`join`), because a
       column of separate labels ("Duodenum" over "Jejunum") looks the same. */
    var joins = (job.join || []).map(squash);
    for (var ji = 0; ji < labels.length; ji++) {
      var J = labels[ji];
      if (!J || !joins.length) continue;
      for (var jj = 0; jj < labels.length; jj++) {
        var K = labels[jj];
        if (!K || K === J) continue;
        var jh = (J.box.y1 - J.box.y0) / J.lines.length, below = K.box.y0 - J.box.y1;
        var overlapX = Math.min(J.box.x1, K.box.x1) - Math.max(J.box.x0, K.box.x0);
        if (below < -jh * 0.3 || below > jh * 0.6 || overlapX < 0) continue;
        var cand = squash(J.text + ' ' + K.text);
        if (!joins.some(function (w) { return w.indexOf(cand) === 0; })) continue;
        J.text = J.text + ' ' + K.text; J.lines = J.lines.concat(K.lines);
        J.box = { x0: Math.min(J.box.x0, K.box.x0), x1: Math.max(J.box.x1, K.box.x1), y0: J.box.y0, y1: K.box.y1 };
        labels[jj] = null; jj = -1;
      }
    }
    labels = labels.filter(Boolean);

    /* 2b. Labels WE place, for a drawing whose own labels were outlines or
           absent: {text, x, y, anchor, to:[x,y]} in the file's own viewBox
           units ("\n" breaks a line). x/y is where the label sits; `to` is
           the point on the part it names - a leader line is drawn to it
           once the label has its final size (step 3). Every one of these
           is a claim we make about the drawing: look at the result. */
    (job.add || []).forEach(function (A) {
      var lines = String(A.text).split('\n').map(norm).filter(Boolean), guess = 10 * vb.width / 320;
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', A.x); t.setAttribute('y', A.y); t.setAttribute('text-anchor', A.anchor || 'start');
      t.setAttribute('font-size', guess); t.setAttribute('font-family', FONT); t.setAttribute('font-weight', 700);
      t.textContent = lines.join(' ');
      svg.appendChild(t);
      var box = rootBox(t);
      t.remove();
      var h = (box.y1 - box.y0) * lines.length * 1.18, cy = (box.y0 + box.y1) / 2;
      labels.push({ text: lines.join(' '), lines: lines, anchor: A.anchor || 'start', size: 0, to: A.to || null, added: true,
                    box: { x0: box.x0, x1: box.x1, y0: cy - h / 2, y1: cy + h / 2 } });
    });
    var tr = {};
    Object.keys(job.translate || {}).forEach(function (k) { tr[squash(k)] = job.translate[k]; });
    var drop = (job.drop || []).map(squash), keepOnly = (job.keep || []).map(squash), nudge = {};
    Object.keys(job.nudge || {}).forEach(function (n) { nudge[squash(n)] = job.nudge[n]; });
    var keep = (job.key || []).map(squash), out = [], seen = {};
    /* Without a list of exact labels (a picture found live), a label that
       names one of the day's key terms is a key label. */
    var terms = (job.terms || []).map(function (t) { return norm(t).toLowerCase(); }).filter(function (t) { return t.length >= 3; });
    function termIndex(text) {
      var l = norm(text).toLowerCase(), i, t;
      for (i = 0; i < terms.length; i++) {
        t = terms[i];
        if (l === t || l.replace(/s$/, '') === t.replace(/s$/, '')) return i;
        if (t.length >= 4 && new RegExp('(^|\\W)' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?(\\W|$)').test(l)) return i;
      }
      return -1;
    }
    labels.forEach(function (L) {
      var k = squash(L.text);
      if (tr[k] && !L.added) { L.text = tr[k]; L.lines = [tr[k]]; k = squash(L.text); }
      var nd = nudge[k];                                          // `nudge`: {label: [dx, dy]}, file units
      if (nd) L.box = { x0: L.box.x0 + nd[0], x1: L.box.x1 + nd[0], y0: L.box.y0 + nd[1], y1: L.box.y1 + nd[1] };
      if (!L.added && drop.indexOf(k) >= 0) return;               // `drop` and `keep` are about the FILE's labels
      if (!L.added && keepOnly.length && keepOnly.indexOf(k) < 0) return;   // `keep`: these and no others
      var cx = (L.box.x0 + L.box.x1) / 2, cy = (L.box.y0 + L.box.y1) / 2, dk = k + '@' + Math.round(cx / 6) + ',' + Math.round(cy / 6);
      if (seen[dk]) return;                               // the halo copy many files draw under each label
      seen[dk] = 1;
      L.key = keep.length ? keep.indexOf(k) : termIndex(L.text);
      out.push(L);
    });

    /* 3. Crop to the drawing, then put the labels back in one style, sized
          for a phone: nothing under ~10px on a 320px-wide picture. */
    /* `page`: the file's own canvas is the picture. Some files keep an old
       draft below it, or let a shape run past its edge - the page hid both. */
    if (job.page) {
      Array.prototype.slice.call(svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, use, text')).forEach(function (el) {
        if (el.closest('defs, clipPath, pattern, mask, marker, symbol')) return;
        var b; try { b = rootBox(el); } catch (e) { return; }
        if (b.x1 < page.x0 || b.x0 > page.x1 || b.y1 < page.y0 || b.y0 > page.y1) el.remove();
      });
    }
    var bb = rootBox(svg.querySelector('g') ? svg : svg);
    try { var gb = svg.getBBox(); bb = { x0: gb.x, y0: gb.y, x1: gb.x + gb.width, y1: gb.y + gb.height }; } catch (e) {}
    if (job.page) {
      bb = { x0: Math.max(bb.x0, page.x0), y0: Math.max(bb.y0, page.y0), x1: Math.min(bb.x1, page.x1), y1: Math.min(bb.y1, page.y1) };
      /* and what still runs past the edge is cut there, as the file's page cut it */
      var cp = document.createElementNS(NS, 'clipPath'), cr = document.createElementNS(NS, 'rect'), pg = document.createElementNS(NS, 'g');
      cp.setAttribute('id', 'sfPage'); cr.setAttribute('x', page.x0); cr.setAttribute('y', page.y0);
      cr.setAttribute('width', page.x1 - page.x0); cr.setAttribute('height', page.y1 - page.y0); cp.appendChild(cr);
      Array.prototype.slice.call(svg.childNodes).forEach(function (n) { if (n.localName !== 'defs') pg.appendChild(n); });
      var defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
      defs.appendChild(cp); pg.setAttribute('clip-path', 'url(#sfPage)'); svg.appendChild(pg);
    }
    out.forEach(function (L) { bb.x0 = Math.min(bb.x0, L.box.x0); bb.x1 = Math.max(bb.x1, L.box.x1); bb.y0 = Math.min(bb.y0, L.box.y0); bb.y1 = Math.max(bb.y1, L.box.y1); });
    var W = bb.x1 - bb.x0, pad = W * 0.02;
    var floorU = 10 * (W + pad * 2) / 320;
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'sf-labels'); g.setAttribute('font-family', FONT);
    out.sort(function (a, b) { return (a.key < 0 ? 99 : a.key) - (b.key < 0 ? 99 : b.key); });
    var leaders = [];
    out.forEach(function (L) {
      var size = r1(Math.max(L.size, floorU)), lh = size * 1.18, n = L.lines.length;
      var x = L.anchor === 'middle' ? (L.box.x0 + L.box.x1) / 2 : L.anchor === 'end' ? L.box.x1 : L.box.x0;
      var cy = (L.box.y0 + L.box.y1) / 2, y = cy - (n - 1) * lh / 2 + size * 0.35;
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', r1(x)); t.setAttribute('y', r1(y)); t.setAttribute('text-anchor', L.anchor);
      t.setAttribute('font-size', size); t.setAttribute('font-weight', L.key >= 0 ? 700 : 500);
      t.setAttribute('fill', '#1a1d2e'); t.setAttribute('stroke', '#ffffff'); t.setAttribute('stroke-width', r1(size * 0.28));
      t.setAttribute('stroke-linejoin', 'round'); t.setAttribute('paint-order', 'stroke');
      L.lines.forEach(function (line, i) {
        if (n === 1) { t.textContent = line; return; }
        var s = document.createElementNS(NS, 'tspan');
        s.setAttribute('x', r1(x)); if (i) s.setAttribute('dy', r1(lh)); s.textContent = line; t.appendChild(s);
      });
      g.appendChild(t);
      if (L.to) leaders.push([t, L.to, size]);
    });
    svg.appendChild(g);
    /* The leader lines of the labels we placed, from the label's near edge
       to the part, under every label so the halos cross them. */
    if (leaders.length) {
      var lg = document.createElementNS(NS, 'g');
      lg.setAttribute('class', 'sf-leaders');
      svg.insertBefore(lg, g);
      leaders.forEach(function (Ld) {
        var b = Ld[0].getBBox(), to = Ld[1], sz = Ld[2], gap = sz * 0.3, x, y;
        if (to[0] > b.x + b.width) { x = b.x + b.width + gap; y = b.y + b.height / 2; }
        else if (to[0] < b.x) { x = b.x - gap; y = b.y + b.height / 2; }
        else { x = Math.max(b.x, Math.min(b.x + b.width, to[0])); y = to[1] > b.y + b.height ? b.y + b.height + gap * 0.5 : b.y - gap * 0.5; }
        var ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', r1(x)); ln.setAttribute('y1', r1(y)); ln.setAttribute('x2', r1(to[0])); ln.setAttribute('y2', r1(to[1]));
        ln.setAttribute('stroke', '#1a1d2e'); ln.setAttribute('stroke-width', r1(sz * 0.09)); ln.setAttribute('stroke-linecap', 'round');
        lg.appendChild(ln);
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', r1(to[0])); dot.setAttribute('cy', r1(to[1])); dot.setAttribute('r', r1(sz * 0.16));
        dot.setAttribute('fill', '#1a1d2e'); dot.setAttribute('stroke', '#ffffff'); dot.setAttribute('stroke-width', r1(sz * 0.07));
        lg.appendChild(dot);
      });
    }
    /* The labels were drawn bigger than the file had them: crop again round
       what is really there, or a long label is cut at the edge. */
    try { var lb = g.getBBox(); bb.x0 = Math.min(bb.x0, lb.x - pad * 0.3); bb.x1 = Math.max(bb.x1, lb.x + lb.width + pad * 0.3);
          bb.y0 = Math.min(bb.y0, lb.y); bb.y1 = Math.max(bb.y1, lb.y + lb.height); W = bb.x1 - bb.x0; pad = W * 0.02; } catch (e) {}

    /* The legibility gate, for a picture found live: labels that sit on each
       other once they are phone-sized make the picture unreadable, whatever
       it looked like at full size. (The catalogue's pictures were looked at
       by a person instead.) */
    var overlaps = overlapCount(Array.prototype.slice.call(g.querySelectorAll('text')));

    /* 4. The credit, inside the picture so it goes wherever the picture goes. */
    var cSize = r1(9.5 * (W + pad * 2) / 320);
    var credit = document.createElementNS(NS, 'text');
    credit.setAttribute('class', 'sf-credit'); credit.setAttribute('x', r1(bb.x1 + pad));
    credit.setAttribute('y', r1(bb.y1 + pad + cSize * 1.1)); credit.setAttribute('text-anchor', 'end');
    credit.setAttribute('font-family', FONT); credit.setAttribute('font-size', cSize); credit.setAttribute('font-weight', 400);
    credit.setAttribute('fill', '#5b6478'); credit.textContent = job.credit || '';
    svg.appendChild(credit);
    /* On a narrow picture the credit is longer than the picture is wide:
       two lines, author first, rather than run off the left edge. */
    var cLines = 1;
    if (credit.getComputedTextLength() > W + pad && /, Wikimedia Commons/.test(job.credit || '')) {
      var cut = job.credit.indexOf(', Wikimedia Commons'), c1 = job.credit.slice(0, cut + 1), c2 = job.credit.slice(cut + 2);
      credit.textContent = '';
      [c1, c2].forEach(function (line, i) {
        var ts = document.createElementNS(NS, 'tspan');
        ts.setAttribute('x', r1(bb.x1 + pad)); if (i) ts.setAttribute('dy', r1(cSize * 1.25));
        ts.textContent = line; credit.appendChild(ts);
      });
      cLines = 2;
    }
    var vbw = W + pad * 2, vbh = bb.y1 - bb.y0 + pad * 2 + cSize * (1.6 + (cLines - 1) * 1.25);
    svg.setAttribute('viewBox', [r1(bb.x0 - pad), r1(bb.y0 - pad), r1(vbw), r1(vbh)].join(' '));
    svg.setAttribute('width', '100%');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', job.title || '');
    svg.setAttribute('data-sf-lib', job.id || 'web');
    svg.setAttribute('style', 'display:block;margin:0 auto;max-width:520px;');
    var report = { id: job.id, labels: out.map(function (L) { return (L.key >= 0 ? '*' : '') + L.text; }),
                   missingKeys: (job.key || []).filter(function (k) { return !out.some(function (L) { return squash(L.text) === squash(k); }); }),
                   keys: out.filter(function (L) { return L.key >= 0; }).length,
                   overlaps: overlaps, w: r1(vbw), h: r1(vbh),
                   legible: overlaps <= 1 && out.length <= 30 && vbw / vbh >= 0.45 && vbw / vbh <= 2.4 };
    var str = new XMLSerializer().serializeToString(svg);
    if (opts.finalize) {
      str = finalize(str);
      if (!str) throw new Error('refused after preparing');
    }
    return { svg: str, report: report };
  }

  window.SFIllustrate = { prepare: prepare, finalize: finalize, parseSafe: parseSafe };
})();

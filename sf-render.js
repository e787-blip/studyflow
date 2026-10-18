/* sf-render.js - pictures that are DRAWN BY CODE from facts the model wrote.

   WHY THIS EXISTS. Everything the model draws with coordinates (SFSceneKit)
   is a guess at where lines go, and a guess looks like one. For a picture
   that is only numbers or dates there is nothing to guess: the model says
   "the plant was 3 cm on day 4" and code puts a dot exactly there, on an axis
   it scaled itself. The model supplies FACTS; this file supplies the ruler.

     SFRender.check(spec)        the cleaned spec, or null when it cannot be
                                 drawn honestly (shared by the plan builder and
                                 the lesson, so a bad one is dropped early)
     SFRender.fromSpec(spec, o)  an <svg> string, or null. o.subject picks the
                                 pictures on a timeline (SFIcons)
     SFRender.types              the spec types this file draws

   Three pictures:

     chart       {type:"chart", kind:"line|bar", title, xLabel, yLabel,
                  xUnit, yUnit, points:[[x,y],...], highlight:2, example:false}
                 also {type:"bars", items:[{label,value}] | ["Oxygen: 21"]}
     numberline  {type:"numberline", min, max, step | denominator,
                  marks:[{at, label}], jumps:[{from, to, label}]}
     timeline    {type:"timeline", items:["1914: war begins", ...]} or
                 items:[{year, label}] - events set in PROPORTION to their dates

   RULES THAT KEEP IT HONEST
   - It declines (returns null) rather than drawing a broken frame: under 3
     points, a number that is not finite, a flat series, a range of nothing.
     The caller then draws what it drew before. A wrong choice costs a plainer
     picture, never a wrong one.
   - Numbers come from the notes. When the model had to invent figures to
     illustrate, it sets example:true and the picture says so on its face.
   - Nothing the model wrote reaches the SVG except numbers (clamped) and
     text (escaped, length-capped). No markup, no colours, no ids.
   - Every size is set for a PHONE: nothing under 11 units on a 400 wide
     canvas, which the kit's legible() then keeps at 9px+ on a 375px screen.

   ES5 on purpose (the pages are). No dependencies; SFIcons is used if loaded. */
(function () {
  'use strict';

  var FONT = "'DM Sans', system-ui, -apple-system, sans-serif";
  var SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
  var BRAND = '#4a7cf6', FOCAL = '#3563e9', INK = '#1a1d2e', MUTED = '#5b6478';
  var RULE = '#cbd5e1', GRID = '#e6ebf3', LINK = '#9aabcc';
  var TINT = '#e9f0ff', TONE_S = '#9db6f7', TONE_T = '#1d3a8a';
  var W = 400;                       /* every canvas is this wide, as the kit's */

  var MAX_POINTS = 12, MAX_EVENTS = 8, MAX_MARKS = 6, MAX_JUMPS = 3;
  var MAX_TEXT = 60;

  var SEQ = 0;

  /* ── small helpers ───────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function r1(n) { return Math.round(Number(n) * 10) / 10; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function own(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }

  /* Text from a model: one line, no angle brackets, capped. */
  function clean(v, max) {
    var s = String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    max = max || MAX_TEXT;
    return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
  }

  /* A number from a number, a numeric string ("3.5", "1,200") or a fraction
     string ("3/4"). Anything else is NaN, and the caller declines. */
  function toNum(v) {
    if (isNum(v)) return v;
    if (typeof v !== 'string') return NaN;
    var s = v.replace(/,/g, '').replace(/−/g, '-').trim();
    var f = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (f) return +f[2] ? (+f[1]) / (+f[2]) : NaN;
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    return +s;
  }

  /* Approximate advance width. It only has to be about right and to err wide:
     everything is laid out with padding on top. */
  function tw(s, size, weight) {
    s = String(s == null ? '' : s);
    var t = 0, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      t += /[ilj.,:;'|! ]/.test(c) ? 0.3 : /[mwMW]/.test(c) ? 0.86 : /[A-Z0-9]/.test(c) ? 0.64 : 0.55;
    }
    return t * size * (weight >= 600 ? 1.06 : 1) * 1.04;
  }

  function wrap(s, maxW, size, weight, maxLines) {
    var words = String(s == null ? '' : s).split(/\s+/), lines = [], cur = '', i, trial;
    maxLines = maxLines || 2;
    for (i = 0; i < words.length; i++) {
      trial = cur ? cur + ' ' + words[i] : words[i];
      if (cur && tw(trial, size, weight) > maxW) {
        lines.push(cur); cur = words[i];
        if (lines.length === maxLines) { cur = ''; lines[maxLines - 1] += '…'; break; }
      } else { cur = trial; }
    }
    if (cur) lines.push(cur);
    for (i = 0; i < lines.length; i++) {              /* a single huge word */
      while (lines[i].length > 3 && tw(lines[i], size, weight) > maxW) {
        lines[i] = lines[i].slice(0, -2).replace(/…$/, '') + '…';
      }
    }
    return lines.length ? lines : [''];
  }

  function T(x, y, s, o) {
    o = o || {};
    var halo = o.halo ? ' stroke="#ffffff" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"' : '';
    var fam = o.family ? ' font-family="' + o.family.replace(/"/g, "'") + '"' : '';
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + (o.anchor || 'middle') +
      '" font-size="' + (o.size || 12) + '" font-weight="' + (o.weight || 500) + '"' + fam +
      ' fill="' + (o.fill || INK) + '"' + halo + '>' + esc(s) + '</text>';
  }

  function open(kind, h, label, w) {
    SEQ++;
    w = Math.round(w || W);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + Math.round(h) +
      '" width="100%" role="img" aria-label="' + esc(label) + '" data-sf-render="' + kind +
      '" style="font-family:' + FONT + ';max-width:' + Math.round(Math.min(w * 1.15, 460)) + 'px;display:block;margin:0 auto;">';
  }

  function titleBlock(title, w) {
    w = w || W;
    if (!title) return { svg: '', h: 8 };
    var lines = wrap(title, w - 28, 17 * 0.8, 400, 2), lh = 17 * (lines.length > 1 ? 1.26 : 1.12), out = '', i;
    for (i = 0; i < lines.length; i++) {
      out += T(w / 2, 4 + 17 * 0.82 + i * lh, lines[i], { size: 17, weight: 400, family: SERIF });
    }
    return { svg: out, h: 12 + lines.length * lh };
  }

  /* 1, 2, 5 x 10^n - the steps a person would choose for an axis. */
  function niceStep(range, target) {
    var raw = range / Math.max(1, target);
    if (!(raw > 0) || !isFinite(raw)) return 1;
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  function fmt(n, commas) {
    var v = Math.round(n * 1000) / 1000, s = String(v);
    if (commas && Math.abs(v) >= 1000) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s;
  }

  function exampleNote(y, example) {
    return example ? T(W / 2, y, 'Example numbers – not taken from your notes',
      { size: 11, weight: 500, fill: MUTED }) : '';
  }

  /* ── validation ──────────────────────────────────────────────────────────── */

  /* "Oxygen: 21", "Oxygen 21%", {label, value} -> {x:'Oxygen', y:21}. */
  function pairFromItem(it) {
    var m, lab, val;
    if (typeof it === 'string') {
      m = it.match(/^\s*(.*?)\s*[:=–—-]\s*(-?[\d,]*\.?\d+)\s*(%|[A-Za-z]{0,6})\s*$/);
      if (!m) return null;
      lab = m[1]; val = toNum(m[2]);
    } else if (it && typeof it === 'object') {
      lab = own(it, 'label'); if (lab == null) lab = own(it, 'name');
      val = toNum(own(it, 'value') != null ? own(it, 'value') : own(it, 'y'));
    } else return null;
    lab = clean(lab, 28);
    return lab && isNum(val) ? { x: lab, y: val } : null;
  }

  function checkChart(s) {
    var kind = /^bar/i.test(String(own(s, 'kind') || '')) || String(own(s, 'type')) === 'bars' ? 'bar' : 'line';
    var raw = own(s, 'points'), src = Array.isArray(raw) ? raw : (Array.isArray(own(s, 'items')) ? s.items : null);
    var pts = [], i, p, x, y;
    if (!src) return null;
    for (i = 0; i < src.length && pts.length < MAX_POINTS; i++) {
      p = src[i];
      if (Array.isArray(p) && p.length === 2) {
        y = toNum(p[1]);
        x = kind === 'bar' ? clean(p[0], 28) : toNum(p[0]);
        if (kind === 'bar' ? !x : !isNum(x)) return null;
        if (!isNum(y)) return null;
        pts.push({ x: x, y: y });
      } else {
        p = pairFromItem(p);
        if (!p) return null;
        if (kind === 'line') return null;               /* a line needs a numeric x */
        pts.push(p);
      }
    }
    if (pts.length < 3) return null;
    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < pts.length; i++) { lo = Math.min(lo, pts[i].y); hi = Math.max(hi, pts[i].y); }
    if (hi === lo) return null;                          /* a flat series says nothing */
    if (Math.abs(hi) > 1e12 || Math.abs(lo) > 1e12) return null;
    /* highlight names a point in the order the model wrote them; mark it
       before sorting, or a line given out of order lights the wrong dot. */
    var hl = own(s, 'highlight');
    hl = isNum(hl) && hl >= 0 && hl < pts.length && Math.floor(hl) === hl ? hl : -1;
    if (hl >= 0) pts[hl].hl = true;
    if (kind === 'line') {
      pts.sort(function (a, b) { return a.x - b.x; });
      for (i = 1; i < pts.length; i++) if (pts[i].x === pts[i - 1].x) return null;
    }
    for (i = 0, hl = -1; i < pts.length; i++) if (pts[i].hl) hl = i;
    return {
      type: 'chart', kind: kind, title: clean(own(s, 'title'), 70),
      xLabel: clean(own(s, 'xLabel'), 36), yLabel: clean(own(s, 'yLabel'), 40),
      xUnit: clean(own(s, 'xUnit'), 10), yUnit: clean(own(s, 'yUnit'), 10),
      points: pts, highlight: hl, example: own(s, 'example') === true
    };
  }

  function checkNumberline(s) {
    var lo = toNum(own(s, 'min')), hi = toNum(own(s, 'max'));
    if (!isNum(lo) || !isNum(hi) || hi <= lo || hi - lo > 1e6) return null;
    var den = toNum(own(s, 'denominator')), step = toNum(own(s, 'step'));
    den = isNum(den) && den >= 2 && den <= 12 && Math.floor(den) === den ? den : 0;
    if (den && (hi - lo) * den > 48) den = 0;
    step = isNum(step) && step > 0 ? step : 0;
    if (!den && step && (hi - lo) / step > 40) step = 0;
    var marks = [], jumps = [], src, i, m, v, f, t;
    src = own(s, 'marks'); src = Array.isArray(src) ? src : [];
    for (i = 0; i < src.length && marks.length < MAX_MARKS; i++) {
      m = src[i]; v = toNum(m && typeof m === 'object' ? own(m, 'at') : m);
      if (!isNum(v) || v < lo || v > hi) return null;
      marks.push({ at: v, label: clean(m && typeof m === 'object' ? own(m, 'label') : '', 18),
                   raw: m && typeof m === 'object' ? own(m, 'at') : m });
    }
    src = own(s, 'jumps'); src = Array.isArray(src) ? src : [];
    for (i = 0; i < src.length && jumps.length < MAX_JUMPS; i++) {
      m = src[i]; f = toNum(m && own(m, 'from')); t = toNum(m && own(m, 'to'));
      if (!isNum(f) || !isNum(t) || f === t || f < lo || f > hi || t < lo || t > hi) return null;
      jumps.push({ from: f, to: t, label: clean(own(m, 'label'), 14) });
    }
    if (!marks.length && !jumps.length) return null;     /* nothing to point at */
    return { type: 'numberline', title: clean(own(s, 'title'), 70), min: lo, max: hi,
             step: step, denominator: den, marks: marks, jumps: jumps, example: own(s, 'example') === true };
  }

  /* A year from "1914", "c. 1914", "44 BCE"; BCE is negative. */
  var DATE_RE = /^\s*(?:c\.?\s*|circa\s+|~)?(\d{1,4})\s*(BCE|BC|CE|AD)?\s*[:–—-]\s*(.+)$/i;
  function yearText(y) { return y < 0 ? (-y) + ' BCE' : String(y); }

  function checkTimeline(s) {
    var src = own(s, 'items'), ev = [], i, it, m, y, lab;
    if (!Array.isArray(src)) return null;
    for (i = 0; i < src.length && ev.length < MAX_EVENTS; i++) {
      it = src[i]; y = NaN; lab = '';
      if (typeof it === 'string') {
        m = it.match(DATE_RE);
        if (!m) return null;
        y = +m[1] * (/^B/i.test(m[2] || '') ? -1 : 1); lab = m[3];
      } else if (it && typeof it === 'object') {
        y = toNum(own(it, 'year') != null ? own(it, 'year') : own(it, 'date'));
        lab = own(it, 'label') != null ? own(it, 'label') : own(it, 'text');
      } else return null;
      lab = clean(lab, 90);
      if (!isNum(y) || Math.abs(y) > 9999 || !lab) return null;
      ev.push({ year: y, label: lab });
    }
    if (ev.length < 3) return null;
    ev.sort(function (a, b) { return a.year - b.year; });
    if (ev[ev.length - 1].year === ev[0].year) return null;
    return { type: 'timeline', title: clean(own(s, 'title') || own(s, 'label'), 70), events: ev };
  }

  function check(spec) {
    if (!spec || typeof spec !== 'object') return null;
    var t = String(own(spec, 'type') || '');
    try {
      if (t === 'chart' || t === 'bars') return checkChart(spec);
      if (t === 'numberline') return checkNumberline(spec);
      if (t === 'timeline') return checkTimeline(spec);
    } catch (e) { return null; }
    return null;
  }

  /* ── chart ───────────────────────────────────────────────────────────────── */

  function axisLabelUnit(label, unit) {
    return label && unit && label.toLowerCase().indexOf(unit.toLowerCase()) < 0 ? label + ' (' + unit + ')' : label;
  }

  function drawChart(c) {
    var pts = c.points, n = pts.length, i, lo = Infinity, hi = -Infinity;
    for (i = 0; i < n; i++) { lo = Math.min(lo, pts[i].y); hi = Math.max(hi, pts[i].y); }
    /* Bars always start at zero (their length is the claim). A line may zoom
       when every value sits far above zero. */
    var zero = c.kind === 'bar' || lo <= 0 || lo < hi * 0.4;
    var vmin = zero ? Math.min(0, lo) : lo, step = niceStep(hi - vmin, 4);
    var ymin = Math.floor(vmin / step) * step, ymax = Math.ceil(hi / step) * step;
    var ticks = [], v;
    for (v = ymin; v <= ymax + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);

    var label = (c.title || 'Chart') + '. ' + n + ' values from ' + fmt(lo) + ' to ' + fmt(hi) + '.';
    var tb = titleBlock(c.title);
    var yAxisText = axisLabelUnit(c.yLabel, c.yUnit);
    var tickW = 0;
    for (i = 0; i < ticks.length; i++) tickW = Math.max(tickW, tw(fmt(ticks[i], true), 11, 500));

    /* Many or long category names read best as horizontal bars. */
    var longest = 0;
    if (c.kind === 'bar') for (i = 0; i < n; i++) longest = Math.max(longest, String(pts[i].x).length);
    if (c.kind === 'bar' && (n > 5 || longest > 11)) return drawHBars(c, ticks, ymin, ymax, tb, label, yAxisText);

    var plotL = Math.round(tickW + 22), plotR = W - 18;
    var plotT = tb.h + (yAxisText ? 30 : 16);
    var catH = c.kind === 'bar' ? 34 : 22;
    var plotH = 176, plotB = plotT + plotH;
    var h = plotB + catH + (c.xLabel ? 24 : 8) + (c.example ? 20 : 4);
    var svg = open('chart', h, label) + tb.svg;

    function Y(val) { return plotB - (val - ymin) / (ymax - ymin) * plotH; }
    for (i = 0; i < ticks.length; i++) {
      svg += '<line x1="' + plotL + '" x2="' + plotR + '" y1="' + r1(Y(ticks[i])) + '" y2="' + r1(Y(ticks[i])) +
        '" stroke="' + (i === 0 ? RULE : GRID) + '" stroke-width="' + (i === 0 ? 1.5 : 1) + '"/>';
      svg += T(plotL - 8, Y(ticks[i]) + 4, fmt(ticks[i], true), { anchor: 'end', size: 11, fill: MUTED });
    }
    if (yAxisText) svg += T(plotL, plotT - 14, yAxisText, { anchor: 'start', size: 11.5, weight: 600, fill: MUTED });

    var hl = c.highlight >= 0 ? c.highlight : -1;
    if (c.kind === 'bar') {
      var slot = (plotR - plotL) / n, bw = Math.min(46, slot * 0.62);
      for (i = 0; i < n; i++) {
        var cx = plotL + slot * (i + 0.5), top = Y(Math.max(pts[i].y, 0)), base = Y(Math.max(ymin, Math.min(0, pts[i].y)));
        var on = hl < 0 || i === hl;
        svg += '<rect x="' + r1(cx - bw / 2) + '" y="' + r1(top) + '" width="' + r1(bw) + '" height="' + r1(Math.max(2, base - top)) +
          '" rx="4" fill="' + (on ? (hl >= 0 ? FOCAL : BRAND) : TONE_S) + '"/>';
        svg += T(cx, top - 6, fmt(pts[i].y, true) + (c.yUnit && c.yUnit.length < 4 ? c.yUnit : ''), { size: 12, weight: 700, halo: true });
        var ls = wrap(pts[i].x, slot - 4, 11, 500, 2), k;
        for (k = 0; k < ls.length; k++) svg += T(cx, plotB + 15 + k * 13, ls[k], { size: 11, fill: INK });
      }
    } else {
      var x0 = pts[0].x, x1 = pts[n - 1].x;
      var xs = niceStep(x1 - x0, 5), xt = [], u;
      for (u = Math.ceil(x0 / xs) * xs; u <= x1 + xs * 1e-6; u += xs) xt.push(Math.round(u / xs) * xs);
      var padX = 10;
      var X = function (val) { return plotL + padX + (val - x0) / (x1 - x0) * (plotR - plotL - padX * 2); };
      for (i = 0; i < xt.length; i++) {
        svg += '<line x1="' + r1(X(xt[i])) + '" x2="' + r1(X(xt[i])) + '" y1="' + plotB + '" y2="' + (plotB + 4) + '" stroke="' + RULE + '" stroke-width="1.5"/>';
        svg += T(X(xt[i]), plotB + 17, fmt(xt[i]), { size: 11, fill: MUTED });
      }
      var d = '';
      for (i = 0; i < n; i++) d += (i ? ' L' : 'M') + r1(X(pts[i].x)) + ' ' + r1(Y(pts[i].y));
      svg += '<path d="' + d + ' L' + r1(X(x1)) + ' ' + r1(Y(ymin)) + ' L' + r1(X(x0)) + ' ' + r1(Y(ymin)) + ' Z" fill="' + BRAND + '" fill-opacity="0.10"/>';
      svg += '<path d="' + d + '" fill="none" stroke="' + BRAND + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
      var show = hl >= 0 ? hl : (function () { var b = 0, j; for (j = 1; j < n; j++) if (pts[j].y > pts[b].y) b = j; return b; })();
      for (i = 0; i < n; i++) {
        var big = i === show;
        svg += '<circle cx="' + r1(X(pts[i].x)) + '" cy="' + r1(Y(pts[i].y)) + '" r="' + (big ? 6.5 : 4) + '" fill="' +
          (big ? FOCAL : BRAND) + '" stroke="#ffffff" stroke-width="2"/>';
      }
      var sx = X(pts[show].x), sy = Y(pts[show].y);
      var txt = fmt(pts[show].y, true) + (c.yUnit ? ' ' + c.yUnit : '');
      if (hl >= 0 && c.xLabel) txt = clean(c.xUnit || c.xLabel, 10) + ' ' + fmt(pts[show].x) + ': ' + txt;
      var wTxt = tw(txt, 12, 700);
      /* Where the label goes is the one thing that is tested, not assumed:
         six places round the point, the first whose box is clear of the line
         and inside the plot wins. "Above" put it straight across a rising
         line. */
      var cands = [['end', -11, -12], ['start', 11, 18], ['start', 11, -12], ['end', -11, 18], ['end', -12, 2], ['start', 12, 2], ['middle', 0, -15], ['middle', 0, 24]];
      var pick = null, ci, sj, sk;
      for (ci = 0; ci < cands.length && !pick; ci++) {
        var an = cands[ci][0], bx = an === 'start' ? sx + cands[ci][1] : an === 'end' ? sx + cands[ci][1] - wTxt : sx - wTxt / 2;
        var bb = { x0: bx - 3, x1: bx + wTxt + 3, y0: sy + cands[ci][2] - 13, y1: sy + cands[ci][2] + 5 };
        if (bb.x0 < plotL + 2 || bb.x1 > plotR + 4 || bb.y0 < plotT - 20 || bb.y1 > plotB - 2) continue;
        var hit = false;
        for (sj = 1; sj < n && !hit; sj++) {
          for (sk = 0; sk <= 12 && !hit; sk++) {
            var qx = X(pts[sj - 1].x) + (X(pts[sj].x) - X(pts[sj - 1].x)) * sk / 12;
            var qy = Y(pts[sj - 1].y) + (Y(pts[sj].y) - Y(pts[sj - 1].y)) * sk / 12;
            if (qx > bb.x0 && qx < bb.x1 && qy > bb.y0 && qy < bb.y1) hit = true;
          }
        }
        if (!hit) pick = cands[ci];
      }
      pick = pick || cands[6];
      var lxp = pick[0] === 'middle' ? Math.max(plotL + wTxt / 2, Math.min(plotR - wTxt / 2, sx)) : sx + pick[1];
      svg += T(lxp, sy + pick[2], txt, { anchor: pick[0], size: 12, weight: 700, halo: true });
    }
    if (c.xLabel) svg += T((plotL + plotR) / 2, plotB + catH + 14, axisLabelUnit(c.xLabel, c.xUnit), { size: 11.5, weight: 600, fill: MUTED });
    svg += exampleNote(h - 8, c.example);
    return svg + '</svg>';
  }

  function drawHBars(c, ticks, ymin, ymax, tb, label, yAxisText) {
    var pts = c.points, n = pts.length, i, labW = 0;
    for (i = 0; i < n; i++) labW = Math.max(labW, tw(pts[i].x, 12, 500));
    labW = Math.min(132, Math.max(60, labW + 6));
    var plotL = 14 + labW + 8, plotR = W - 54, barH = 22, gap = 12;
    var plotT = tb.h + (yAxisText ? 24 : 10), plotB = plotT + n * (barH + gap) - gap + 6;
    var h = plotB + 26 + (c.example ? 20 : 4);
    var svg = open('chart', h, label) + tb.svg;
    function X(val) { return plotL + (val - ymin) / (ymax - ymin) * (plotR - plotL); }
    if (yAxisText) svg += T(plotL, plotT - 12, yAxisText, { anchor: 'start', size: 11.5, weight: 600, fill: MUTED });
    for (i = 0; i < ticks.length; i++) {
      svg += '<line x1="' + r1(X(ticks[i])) + '" x2="' + r1(X(ticks[i])) + '" y1="' + (plotT - 4) + '" y2="' + plotB +
        '" stroke="' + (ticks[i] === 0 || i === 0 ? RULE : GRID) + '" stroke-width="' + (i === 0 ? 1.5 : 1) + '"/>';
      svg += T(X(ticks[i]), plotB + 18, fmt(ticks[i], true), { size: 11, fill: MUTED });
    }
    var hl = c.highlight;
    for (i = 0; i < n; i++) {
      var y = plotT + i * (barH + gap), x0 = X(Math.min(0, Math.max(ymin, 0))), x1 = X(pts[i].y);
      var on = hl < 0 || i === hl;
      svg += '<rect x="' + r1(Math.min(x0, x1)) + '" y="' + r1(y) + '" width="' + r1(Math.max(3, Math.abs(x1 - x0))) + '" height="' + barH +
        '" rx="5" fill="' + (on ? (hl >= 0 ? FOCAL : BRAND) : TONE_S) + '"/>';
      svg += T(plotL - 8, y + barH / 2 + 4.5, wrap(pts[i].x, labW, 12, 500, 1)[0], { anchor: 'end', size: 12, fill: INK });
      svg += T(Math.max(x0, x1) + 7, y + barH / 2 + 4.5, fmt(pts[i].y, true) + (c.yUnit && c.yUnit.length < 4 ? c.yUnit : ''),
        { anchor: 'start', size: 12, weight: 700, fill: INK });
    }
    svg += exampleNote(h - 8, c.example);
    return svg + '</svg>';
  }

  /* ── number line ─────────────────────────────────────────────────────────── */

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  /* A stacked fraction (or a plain whole number) centred on x. */
  function fracText(x, y, val, den, o) {
    o = o || {};
    var whole = Math.round(val * (den || 1));
    if (!den || whole % den === 0) return T(x, y, fmt(val), o);
    var sign = whole < 0 ? '-' : '', a = Math.abs(whole), g = gcd(a, den), nn = a / g, dd = den / g;
    var size = o.size || 11, bw = Math.max(tw(String(nn), size, 600), tw(String(dd), size, 600)) + 4;
    return (sign ? T(x - bw / 2 - 5, y, '−', { size: size, fill: o.fill || MUTED }) : '') +
      T(x, y - size * 0.55, String(nn), { size: size, fill: o.fill || MUTED, weight: o.weight || 600 }) +
      '<line x1="' + r1(x - bw / 2) + '" x2="' + r1(x + bw / 2) + '" y1="' + r1(y - size * 0.42) + '" y2="' + r1(y - size * 0.42) +
      '" stroke="' + (o.fill || MUTED) + '" stroke-width="1.2"/>' +
      T(x, y + size * 0.62, String(dd), { size: size, fill: o.fill || MUTED, weight: o.weight || 600 });
  }

  function drawNumberline(s) {
    var lo = s.min, hi = s.max, den = s.denominator, i, tickVals = [], stepV;
    if (den) stepV = 1 / den; else stepV = s.step || niceStep(hi - lo, 8);
    var v, guard = 0;
    for (v = Math.ceil(lo / stepV - 1e-9) * stepV; v <= hi + stepV * 1e-6 && guard < 80; v += stepV, guard++) tickVals.push(v);
    var label = (s.title || 'Number line') + ' from ' + fmt(lo) + ' to ' + fmt(hi) + '.';
    var tb = titleBlock(s.title);
    var jumpRoom = s.jumps.length ? 62 : 0;
    var lineY = tb.h + 26 + jumpRoom, h = lineY + (den ? 52 : 44) + (s.example ? 20 : 4);
    var L = 28, R = W - 28;
    function X(val) { return L + (val - lo) / (hi - lo) * (R - L); }
    var svg = open('numberline', h, label) + tb.svg;
    svg += '<line x1="' + L + '" x2="' + R + '" y1="' + lineY + '" y2="' + lineY + '" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>';
    var every = 1;
    if (tickVals.length > 14) every = Math.ceil(tickVals.length / 12);
    for (i = 0; i < tickVals.length; i++) {
      var tv = tickVals[i], whole = Math.abs(tv - Math.round(tv)) < 1e-9, major = whole || !den;
      var tx = X(tv);
      svg += '<line x1="' + r1(tx) + '" x2="' + r1(tx) + '" y1="' + (lineY - (major ? 8 : 5)) + '" y2="' + (lineY + (major ? 8 : 5)) +
        '" stroke="' + INK + '" stroke-width="' + (major ? 2 : 1.4) + '"/>';
      if (i % every === 0 && (major || tickVals.length <= 14)) {
        if (den) svg += fracText(tx, lineY + 28, tv, den, { size: major ? 12 : 11, fill: major ? INK : MUTED });
        else svg += T(tx, lineY + 26, fmt(tv, true), { size: 11.5, fill: MUTED });
      }
    }
    for (i = 0; i < s.jumps.length; i++) {
      var j = s.jumps[i], a = X(j.from), b = X(j.to), peak = 22 + i * 14;
      var mid = (a + b) / 2, cy = lineY - 8 - 2 * peak, ex = b, ey = lineY - 9;
      svg += '<path d="M' + r1(a) + ' ' + (lineY - 9) + ' Q' + r1(mid) + ' ' + r1(cy) + ' ' + r1(ex) + ' ' + ey +
        '" fill="none" stroke="' + BRAND + '" stroke-width="2.4" stroke-linecap="round"/>';
      var dir = b >= a ? 1 : -1;
      svg += '<path d="M' + r1(ex - dir * 9) + ' ' + (ey - 7) + ' L' + r1(ex) + ' ' + ey + ' L' + r1(ex - dir * 9) + ' ' + (ey + 4) +
        '" fill="none" stroke="' + BRAND + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      if (j.label) svg += T(mid, lineY - 8 - peak - 6, j.label, { size: 12, weight: 700, fill: TONE_T, halo: true });
    }
    for (i = 0; i < s.marks.length; i++) {
      var m = s.marks[i], mx = X(m.at);
      svg += '<circle cx="' + r1(mx) + '" cy="' + lineY + '" r="7" fill="' + FOCAL + '" stroke="#ffffff" stroke-width="2.5"/>';
      if (m.label) svg += T(Math.max(L, Math.min(R, mx)), lineY - 17, m.label, { size: 12, weight: 700, halo: true });
    }
    svg += exampleNote(h - 8, s.example);
    return svg + '</svg>';
  }

  /* ── timeline, to scale ──────────────────────────────────────────────────── */

  function drawTimeline(t, opts) {
    var ev = t.events, n = ev.length, i;
    var subject = opts && opts.subject || '';
    /* Pictures only when the words name something for at least half the
       events and at least half of those differ - the kit's all-or-nothing. */
    var icons = [], named = 0, seen = {}, distinct = 0;
    for (i = 0; i < n; i++) {
      var nm = '';
      try { nm = window.SFIcons && window.SFIcons.match ? window.SFIcons.match(ev[i].label, subject) || '' : ''; } catch (e) { nm = ''; }
      icons.push(nm);
      if (nm) { named++; if (!seen[nm]) { seen[nm] = 1; distinct++; } }
    }
    var useIcons = named * 2 >= n && distinct * 2 >= named && window.SFIcons && window.SFIcons.markup;
    var span = ev[n - 1].year - ev[0].year;
    var railX = 62, textX = useIcons ? 140 : 106, textW = W - textX - 12;
    var blocks = [], bh, widest = 0, k0;
    for (i = 0; i < n; i++) {
      var lines = wrap(ev[i].label, textW, 12.5, 500, 3);
      bh = Math.max(useIcons ? 36 : 30, 18 + lines.length * 16.5 + 2);
      blocks.push({ lines: lines, h: bh });
      for (k0 = 0; k0 < lines.length; k0++) widest = Math.max(widest, tw(lines[k0], 12.5, 500));
    }
    /* A canvas as wide as its content, so a short timeline is drawn bigger on
       a phone rather than left-hand heavy with a blank right half. */
    var cw = Math.max(290, Math.min(W, Math.round(textX + widest + 18)));
    var tb = titleBlock(t.title, cw);
    var scaleH = Math.max(210, Math.min(430, n * 56)), top = tb.h + 8 + blocks[0].h / 2;
    var tyY = [], lyY = [], prevEnd = tb.h;   /* never above the title */
    for (i = 0; i < n; i++) {
      var ty = top + (ev[i].year - ev[0].year) / span * scaleH;
      tyY.push(ty);
      var want = ty - blocks[i].h / 2, ly = Math.max(want, prevEnd + 8);
      lyY.push(ly); prevEnd = ly + blocks[i].h;
    }
    var bottom = Math.max(prevEnd, tyY[n - 1] + 8);
    var h = bottom + 18;
    var label = (t.title || 'Timeline') + ': ' + yearText(ev[0].year) + ' to ' + yearText(ev[n - 1].year) + '.';
    var svg = open('timeline', h, label, cw) + tb.svg;
    svg += '<line x1="' + railX + '" x2="' + railX + '" y1="' + r1(tyY[0]) + '" y2="' + r1(tyY[n - 1]) +
      '" stroke="' + RULE + '" stroke-width="3" stroke-linecap="round"/>';
    /* The scale: round years down the left, so spacing reads as time. */
    var ss = niceStep(span, Math.max(2, Math.min(6, Math.floor(scaleH / 70)))), lastY = -1e9, yv;
    for (yv = Math.ceil(ev[0].year / ss) * ss; yv <= ev[n - 1].year; yv += ss) {
      var sy = top + (yv - ev[0].year) / span * scaleH;
      if (sy - lastY < 34) continue;
      var near = false;
      for (i = 0; i < n; i++) if (Math.abs(tyY[i] - sy) < 11) near = true;
      if (near) continue;
      lastY = sy;
      svg += '<line x1="' + (railX - 5) + '" x2="' + (railX + 5) + '" y1="' + r1(sy) + '" y2="' + r1(sy) + '" stroke="' + LINK + '" stroke-width="1.5"/>';
      svg += T(railX - 11, sy + 4, yearText(yv), { anchor: 'end', size: 11, weight: 500, fill: MUTED });
    }
    for (i = 0; i < n; i++) {
      var cy = lyY[i] + blocks[i].h / 2;
      if (Math.abs(cy - tyY[i]) > 2) {
        svg += '<path d="M' + (railX + 6) + ' ' + r1(tyY[i]) + ' L' + (railX + 20) + ' ' + r1(tyY[i]) + ' L' + (railX + 30) + ' ' + r1(cy) +
          (useIcons ? ' L' + (railX + 36) : ' L' + (textX - 8)) + ' ' + r1(cy) + '" fill="none" stroke="' + LINK + '" stroke-width="1.5"/>';
      } else {
        svg += '<line x1="' + (railX + 6) + '" x2="' + (useIcons ? railX + 36 : textX - 8) + '" y1="' + r1(cy) + '" y2="' + r1(cy) + '" stroke="' + LINK + '" stroke-width="1.5"/>';
      }
      svg += '<circle cx="' + railX + '" cy="' + r1(tyY[i]) + '" r="6" fill="' + (i === n - 1 ? FOCAL : BRAND) + '" stroke="#ffffff" stroke-width="2.5"/>';
      if (useIcons) {
        svg += '<circle cx="' + (railX + 56) + '" cy="' + r1(cy) + '" r="17" fill="' + TINT + '" stroke="' + TONE_S + '" stroke-width="1.3"/>';
        if (icons[i]) svg += window.SFIcons.markup(icons[i], railX + 56, cy, 22, TONE_T, '#3563e9', 0.28);
        else svg += '<circle cx="' + (railX + 56) + '" cy="' + r1(cy) + '" r="3.5" fill="' + TONE_S + '"/>';
      }
      var ty0 = lyY[i] + 13;
      svg += T(textX, ty0, yearText(ev[i].year), { anchor: 'start', size: 12.5, weight: 700, fill: TONE_T });
      var k;
      for (k = 0; k < blocks[i].lines.length; k++) {
        svg += T(textX, ty0 + 17 + k * 16.5, blocks[i].lines[k], { anchor: 'start', size: 12.5, weight: 500, fill: INK });
      }
    }
    return svg + '</svg>';
  }

  /* ── entry point ─────────────────────────────────────────────────────────── */

  function fromSpec(spec, opts) {
    var s = check(spec);
    if (!s) return null;
    try {
      if (s.type === 'chart') return drawChart(s);
      if (s.type === 'numberline') return drawNumberline(s);
      if (s.type === 'timeline') return drawTimeline(s, opts || {});
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[sf-render] could not draw', e);
    }
    return null;
  }

  window.SFRender = { check: check, fromSpec: fromSpec, types: { chart: 1, bars: 1, numberline: 1, timeline: 1 } };
})();

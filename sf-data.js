/* sf-data.js - a lesson's NUMBERS: the table, its chart, and the questions
   built from it (Oct 2026). Loaded by app.html (to check what the model
   returned) and lesson.html (to draw it and to build the questions).

   WHY THE CODE BUILDS THE QUESTIONS. The model writes one thing here: the
   numbers from the learner's notes, as a table. Everything else is worked out
   from that table - which row is highest, how much each step rose, whether a
   column really is Total / Pens - so the answer key of every data question is
   arithmetic on the learner's own figures, never a model's claim about them.

     SFData.allowed(subjectType)   true for the subjects that get data cards
     SFData.check(data)            the cleaned model, or null when it cannot
                                   be used honestly (the renderer is the
                                   security boundary: a stored plan may predate
                                   the validator, so lesson.html checks again)
     SFData.figure(m, W)           the chart <-> table figure, as HTML
     SFData.table(m, opts)         the table alone, as HTML
     SFData.barChart(spec, W, y0)  bars; y0 > 0 only for "Spot the bad graph"
     SFData.questions(m, ctx)      { read: q|null, second: q|null }

   THE RULES (agreed with the owner, Oct 2026)
   - The NOTES decide, never the subject. No numbers in the notes, no data
     cards. A table the model marks "example" is refused: nothing is
     invented to force a chart in.
   - Maths (invariant 1), history (timelines), English and language never
     get them - see allowed().
   - Every chart declines when the numbers cannot make an honest picture: a
     pie that does not add to 100, a line from two points, a scatter with
     no spread. The table is still shown.
   - Nothing the model wrote reaches the page except escaped, capped text
     and clamped numbers.

   ES5 on purpose (the pages are). No dependencies. */
(function () {
  'use strict';

  var FONT = "'DM Sans', system-ui, -apple-system, sans-serif";
  var BRAND = '#4a7cf6', FOCAL = '#3563e9', INK = '#1a1d2e', MUTED = '#5b6478';
  var RULE = '#cbd5e1', GRID = '#e6ebf3', SLATE = '#64748b';
  var TONES = [BRAND, SLATE, '#93aef5'];
  var DONUT = ['#2f5fe0', '#86a8fa', '#c9d8fd', '#9fb3d6', '#dbe5fb', '#5b7fe0'];

  var SUBJECTS = { science: 1, economics: 1, geography: 1, psychology: 1, cs: 1, general: 1 };
  var CHARTS = { line: 1, bars: 1, donut: 1, scatter: 1, none: 1 };
  var OPS = { divide: '÷', multiply: '×', add: '+', subtract: '−', percent: '÷' };

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function own(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function clean(v, max) {
    var s = String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
  }
  /* "3.5", "1,200", "−4", "45%" and "$6.00" are numbers; "3/4" is 0.75. */
  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var s = v.replace(/[,\s]/g, '').replace(/−/g, '-').replace(/^\$|^£|^€|%$/g, '');
    var f = s.match(/^(-?\d+)\/(\d+)$/);
    if (f) return +f[2] ? (+f[1]) / (+f[2]) : NaN;
    return /^-?\d*\.?\d+$/.test(s) ? +s : NaN;
  }
  function decimals(v) {
    var m = String(v).replace(/,/g, '').match(/\.(\d+)/);
    return m ? Math.min(3, m[1].length) : 0;
  }
  function hash(s) {
    var h = 5381, i;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  /* A number as the table shows it: the column's own decimals, thousands
     separated - except years, which never get a comma. */
  function show(v, dp, year) {
    var s = Number(v).toFixed(dp || 0);
    if (year) return s;
    var parts = s.split('.');
    if (Math.abs(v) >= 1000) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function tick(v, year) {
    if (year) return String(Math.round(v));
    var a = Math.abs(v);
    if (a >= 1000) return (Math.round(v / 100) / 10) + 'k';
    return String(Math.round(v * 100) / 100);
  }
  function textW(s, size, bold) { return String(s).length * size * (bold ? 0.57 : 0.53); }
  function nice(min, max, count, fromZero) {
    if (fromZero) min = Math.min(0, min);
    if (max === min) max = min + 1;
    var span = max - min, step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = count / span * step;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, ticks = [];
    for (var v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { min: lo, max: hi, ticks: ticks };
  }
  function colTitle(c) { return c.name + (c.unit ? ' (' + c.unit + ')' : ''); }
  /* A value with its unit the way people write it: $6.00, 45%, 3.1 mL/min. */
  function withUnit(v, c) {
    var n = show(v, c.dp), u = c.unit || '';
    if (/^[$£€¥]$/.test(u)) return (v < 0 ? '−' + u + n.replace(/^-/, '') : u + n);
    if (u === '%') return n + '%';
    return u ? n + ' ' + u : n;
  }
  /* A row as words: "Ice", or "24 pens" / "5,000 lux" when the rows are numbers. */
  function rowName(m, r) {
    if (!m.xNum) return r.label;
    var c = m.cols[0], n = show(r.x, c.dp, m.year);
    if (m.year) return n;
    if (c.unit) return withUnit(r.x, c);
    return n + ' ' + c.name.toLowerCase();
  }

  function allowed(subjectType) { return !!SUBJECTS[String(subjectType || '').toLowerCase()]; }

  /* ── CHECK ───────────────────────────────────────────────────────────── */
  /* The model's table, or null. Columns 2-5, rows 3-12, every row the same
     length, every column after the first all numbers, row names unique. */
  function check(d) {
    if (!d || typeof d !== 'object' || isArr(d)) return null;
    if (own(d, 'example') === true || own(d, 'source') === 'example') return null;
    var rawCols = own(d, 'cols'), rawRows = own(d, 'rows');
    if (!isArr(rawCols) || !isArr(rawRows)) return null;
    if (rawCols.length < 2 || rawCols.length > 5 || rawRows.length < 3 || rawRows.length > 12) return null;
    var cols = [], i, j;
    for (i = 0; i < rawCols.length; i++) {
      var c = rawCols[i], name = clean(c && typeof c === 'object' ? own(c, 'name') : c, 24);
      if (!name) return null;
      cols.push({ name: name, unit: clean(c && typeof c === 'object' ? own(c, 'unit') : '', 14), dp: 0 });
    }
    var rows = [], seen = {}, xNum = true;
    for (i = 0; i < rawRows.length; i++) {
      var r = rawRows[i];
      if (!isArr(r) || r.length !== cols.length) return null;
      var label = clean(r[0], 28);
      if (!label || seen[label.toLowerCase()]) return null;
      seen[label.toLowerCase()] = 1;
      var x = toNum(r[0]);
      if (!isFinite(x)) xNum = false;
      var v = [];
      for (j = 1; j < r.length; j++) {
        var n = toNum(r[j]);
        if (!isFinite(n) || Math.abs(n) > 1e12) return null;
        v.push(n);
        cols[j].dp = Math.max(cols[j].dp, decimals(r[j]));
      }
      rows.push({ label: label, x: x, v: v });
    }
    if (xNum) rows.forEach(function (r) { cols[0].dp = Math.max(cols[0].dp, decimals(r.label)); });
    /* A column that never changes says nothing a question could ask about. */
    for (j = 1; j < cols.length; j++) {
      var vals = rows.map(function (r) { return r.v[j - 1]; });
      if (Math.max.apply(null, vals) === Math.min.apply(null, vals) && cols.length === 2) return null;
    }
    var year = xNum && rows.every(function (r) { return r.x === Math.round(r.x) && r.x >= 1000 && r.x <= 2200; });
    var m = {
      title: clean(own(d, 'title'), 60) || colTitle(cols[1]),
      takeaway: clean(own(d, 'takeaway'), 150),
      notice: clean(own(d, 'notice'), 240),
      cols: cols, rows: rows, xNum: xNum, year: year, rule: null, chart: 'none',
      /* What the questions carry: the table as the model gave it, so the
         session re-checks it when it draws (stored questions are never
         trusted) and a missed one can come back on a later day. */
      src: JSON.parse(JSON.stringify({ title: own(d, 'title'), cols: rawCols, rows: rawRows, chart: own(d, 'chart'),
                                       notice: own(d, 'notice'), rule: own(d, 'rule') }))
    };
    m.rule = checkRule(own(d, 'rule'), m);
    var want = String(own(d, 'chart') || '').toLowerCase();
    m.chart = pickChart(CHARTS[want] ? want : 'line', m);
    return m;
  }

  /* A rule between columns ("Per pen = Total ÷ Pens") is kept only when it
     holds on EVERY row, within the rounding the table itself shows. */
  function ruleValue(rule, row) {
    function col(k) { return k === 0 ? row.x : row.v[k - 1]; }
    var a = col(rule.a), b = col(rule.b);
    if (!isFinite(a) || !isFinite(b)) return NaN;
    if (rule.op === 'divide') return b ? a / b : NaN;
    if (rule.op === 'percent') return b ? a / b * 100 : NaN;
    if (rule.op === 'multiply') return a * b;
    if (rule.op === 'add') return a + b;
    if (rule.op === 'subtract') return a - b;
    return NaN;
  }
  function checkRule(r, m) {
    if (!r || typeof r !== 'object') return null;
    var rule = { col: +own(r, 'col'), op: String(own(r, 'op') || ''), a: +own(r, 'a'), b: +own(r, 'b') };
    var n = m.cols.length;
    if (!OPS[rule.op]) return null;
    if (!(rule.col >= 1 && rule.col < n) || !(rule.a >= 0 && rule.a < n) || !(rule.b >= 0 && rule.b < n)) return null;
    if (rule.col === rule.a || rule.col === rule.b || rule.col !== Math.round(rule.col)) return null;
    if ((rule.a === 0 || rule.b === 0) && !m.xNum) return null;
    var dp = m.cols[rule.col].dp, ok = m.rows.every(function (row) {
      var want = row.v[rule.col - 1], got = ruleValue(rule, row);
      return isFinite(got) && Math.abs(got - want) <= Math.max(0.5 * Math.pow(10, -dp) + 1e-9, Math.abs(want) * 0.01);
    });
    if (!ok) return null;
    var A = m.cols[rule.a].name, B = m.cols[rule.b].name, C = m.cols[rule.col].name;
    rule.text = C + ' = ' + A + ' ' + OPS[rule.op] + ' ' + B + (rule.op === 'percent' ? ' × 100' : '');
    rule.dp = dp;
    return rule;
  }

  /* The chart asked for, or the next honest one, or none (table only). */
  function chartOk(kind, m) {
    var n = m.rows.length;
    if (kind === 'line') {
      if (!m.xNum) return false;
      var xs = m.rows.map(function (r) { return r.x; }).slice().sort(function (a, b) { return a - b; });
      for (var i = 1; i < xs.length; i++) if (xs[i] === xs[i - 1]) return false;
      return true;
    }
    if (kind === 'scatter') return m.xNum && n >= 5;
    if (kind === 'bars') return n <= 8 && m.rows.every(function (r) { return r.v[0] >= 0 && (m.cols.length < 3 || r.v[1] >= 0); });
    if (kind === 'donut') {
      if (n > 6 || m.cols.length !== 2) return false;
      var sum = 0;
      for (var k = 0; k < n; k++) { if (m.rows[k].v[0] < 0) return false; sum += m.rows[k].v[0]; }
      return Math.abs(sum - 100) <= 1;
    }
    return kind === 'none';
  }
  function pickChart(want, m) {
    var order = { line: ['line', 'bars'], scatter: ['scatter', 'line', 'bars'], donut: ['donut', 'bars'], bars: ['bars', 'line'], none: [] }[want];
    for (var i = 0; i < order.length; i++) if (chartOk(order[i], m)) return order[i];
    return 'none';
  }

  /* ── CHARTS ──────────────────────────────────────────────────────────── */
  /* Which columns go on the chart. Drawing "Total" ($24) and "Per pen" ($1)
     on one axis hid the whole lesson - the per-pen price falling - under a
     tall bar nobody asked about. So: the column a rule works out, when there
     is one (it is the point); otherwise the first column, joined only by
     columns in the same unit and on a similar scale. */
  function plotCols(m, max) {
    if (m.rule) return [m.rule.col];
    var out = [1], top = function (c) { return Math.max.apply(null, m.rows.map(function (r) { return Math.abs(r.v[c - 1]); })) || 1; };
    for (var c = 2; c < m.cols.length && out.length < max; c++) {
      var ratio = top(c) / top(1);
      if (m.cols[c].unit === m.cols[1].unit && ratio <= 4 && ratio >= 0.25) out.push(c);
    }
    return out;
  }
  function svgWrap(W, H, parts, label) {
    return '<svg class="sfd-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' +
      esc(label) + '" font-family="' + FONT + '" style="font-variant-numeric:tabular-nums">' + parts.join('') + '</svg>';
  }
  function yTitle(o, s) { o.push('<text x="2" y="12" font-size="11.5" font-weight="600" fill="' + MUTED + '">' + esc(s) + '</text>'); }

  function lineChart(m, W) {
    var rows = m.rows.slice().sort(function (a, b) { return a.x - b.x; });
    var pc = plotCols(m, 3), nS = pc.length, series = [], i, s;
    for (s = 0; s < nS; s++) (function (c, k) { series.push({ name: m.cols[c].name, tone: TONES[k], pts: rows.map(function (r) { return [r.x, r.v[c - 1]]; }) }); })(pc[s], s);
    var ys = [], xs = rows.map(function (r) { return r.x; });
    series.forEach(function (se) { se.pts.forEach(function (p) { ys.push(p[1]); }); });
    var yS = nice(Math.min.apply(null, ys), Math.max.apply(null, ys), 4, Math.min.apply(null, ys) >= 0);
    var xS = m.year ? { min: xs[0], max: xs[xs.length - 1], ticks: [xs[0], xs[xs.length - 1]] } : nice(Math.min.apply(null, xs), Math.max.apply(null, xs), W < 360 ? 3 : 4, false);
    if (!m.year && xS.ticks.length > 6) xS.ticks = [xS.min, xS.max];
    var endW = 0;
    if (nS > 1) series.forEach(function (se) { endW = Math.max(endW, textW(se.name, 12, true)); });
    var L = Math.max(30, textW(tick(yS.max), 11.5) + 12), R = 12 + (endW ? endW + 8 : 0), T = 26, B = 42;
    var H = Math.round(Math.max(190, Math.min(260, W * 0.62))), pw = W - L - R, ph = H - T - B;
    function X(v) { return L + (v - xS.min) / ((xS.max - xS.min) || 1) * pw; }
    function Y(v) { return T + ph - (v - yS.min) / ((yS.max - yS.min) || 1) * ph; }
    var o = [];
    yTitle(o, nS > 1 ? (m.cols[pc[0]].unit || '') : colTitle(m.cols[pc[0]]));
    yS.ticks.forEach(function (t) {
      o.push('<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="' + (t === 0 ? RULE : GRID) + '"/>');
      o.push('<text x="' + (L - 8) + '" y="' + (Y(t) + 4).toFixed(1) + '" font-size="11.5" fill="' + MUTED + '" text-anchor="end">' + tick(t) + '</text>');
    });
    xS.ticks.forEach(function (t, k) {
      var anchor = m.year ? (k === 0 ? 'start' : 'end') : 'middle';
      o.push('<text x="' + X(t).toFixed(1) + '" y="' + (T + ph + 17) + '" font-size="11.5" fill="' + MUTED + '" text-anchor="' + anchor + '">' + tick(t, m.year) + '</text>');
    });
    o.push('<text x="' + (L + pw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="11.5" font-weight="600" fill="' + MUTED + '" text-anchor="middle">' + esc(colTitle(m.cols[0])) + '</text>');
    var ends = [];
    series.forEach(function (se) {
      var d = '';
      se.pts.forEach(function (p, k) { d += (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); });
      o.push('<path class="sfd-line" pathLength="1" d="' + d + '" fill="none" stroke="' + se.tone + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>');
      se.pts.forEach(function (p, k) {
        o.push('<circle class="sfd-dot" style="animation-delay:' + (0.25 + k * 0.06).toFixed(2) + 's" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="3.6" fill="#fff" stroke="' + se.tone + '" stroke-width="2.2"/>');
      });
      if (nS > 1) { var lp = se.pts[se.pts.length - 1]; ends.push({ y: Y(lp[1]) + 4, x: X(lp[0]) + 8, name: se.name, tone: se.tone }); }
    });
    ends.sort(function (a, b) { return a.y - b.y; });
    for (i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach(function (e) { o.push('<text class="sfd-late" x="' + e.x.toFixed(1) + '" y="' + e.y.toFixed(1) + '" font-size="12" font-weight="700" fill="' + e.tone + '">' + esc(e.name) + '</text>'); });
    return svgWrap(W, H, o, m.title);
  }

  /* Bars, grouped for two series. spec: {title, yLabel, cats, series:[{name,values,tone}], values:bool}.
     y0 > 0 is ONLY for "Spot the bad graph": every honest bar starts at 0. */
  function barChart(spec, W, y0) {
    var cats = spec.cats, series = spec.series, vals = [];
    series.forEach(function (s) { vals = vals.concat(s.values); });
    var top = Math.max.apply(null, vals), yS;
    if (y0 != null && y0 >= 0) {
      /* The cut axis labels its own baseline: "starts at 95" must print 95.
         The same scale all the way down to 0, or the last frame of the fall
         jumped from a top of 106 to the honest chart's 150. Honest bars pass
         no y0 and take the branch below. */
      var span = top * 1.04 - y0, st = span > 40 ? 20 : span > 16 ? 5 : span > 6 ? 2 : 1, t;
      yS = { min: y0, max: top * 1.04, ticks: [Math.round(y0)] };
      for (t = Math.floor(y0 / st) * st; t <= yS.max; t += st) if (t > y0 + st * 0.55) yS.ticks.push(t);
    } else yS = nice(0, spec.values ? top * 1.15 : top, 4, true);   /* room for the value over the tallest bar */
    var legend = series.length > 1;
    var L = Math.max(30, textW(tick(yS.max), 11.5) + 12), R = 8, T = legend ? 40 : 26, B = spec.xLabel ? 46 : 30;
    var H = Math.round(Math.max(190, Math.min(250, W * 0.6))) + (spec.xLabel ? 16 : 0), pw = W - L - R, ph = H - T - B;
    function Y(v) { return T + ph - (Math.max(yS.min, Math.min(yS.max, v)) - yS.min) / ((yS.max - yS.min) || 1) * ph; }
    var o = [];
    yTitle(o, spec.yLabel);
    if (legend) {
      var lx = 2;
      series.forEach(function (s) {
        o.push('<rect x="' + lx + '" y="21" width="10" height="10" rx="3" fill="' + s.tone + '"/>');
        o.push('<text x="' + (lx + 15) + '" y="30" font-size="12" font-weight="600" fill="' + INK + '">' + esc(s.name) + '</text>');
        lx += 15 + textW(s.name, 12, true) + 16;
      });
    }
    yS.ticks.forEach(function (t) {
      o.push('<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="' + GRID + '"/>');
      o.push('<text x="' + (L - 8) + '" y="' + (Y(t) + 4).toFixed(1) + '" font-size="11.5" fill="' + MUTED + '" text-anchor="end">' + tick(t) + '</text>');
    });
    var gw = pw / cats.length, bw = Math.min(34, gw * 0.62 / series.length), gap = series.length > 1 ? 3 : 0;
    var catSize = gw < 46 ? 10.5 : 11.5;
    cats.forEach(function (c, ci) {
      var gx = L + gw * ci + gw / 2, total = series.length * bw + (series.length - 1) * gap;
      series.forEach(function (s, si) {
        var v = s.values[ci], x = gx - total / 2 + si * (bw + gap), y = Y(v), h = Math.max(0, T + ph - y);
        o.push('<rect class="sfd-bar" style="animation-delay:' + (0.05 + (ci * series.length + si) * 0.05).toFixed(2) + 's" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(5, bw / 3).toFixed(1) + '" fill="' + s.tone + '"/>');
        if (spec.values) o.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" font-size="12" font-weight="700" fill="' + INK + '" text-anchor="middle">' + esc(spec.fmt ? spec.fmt(v) : tick(v)) + '</text>');
      });
      o.push('<text x="' + gx.toFixed(1) + '" y="' + (T + ph + 18) + '" font-size="' + catSize + '" fill="' + MUTED + '" text-anchor="middle">' + esc(clean(c, gw < 46 ? 6 : 12)) + '</text>');
    });
    o.push('<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" stroke="' + RULE + '" stroke-width="1.2"/>');
    if (spec.xLabel) o.push('<text x="' + (L + pw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="11.5" font-weight="600" fill="' + MUTED + '" text-anchor="middle">' + esc(spec.xLabel) + '</text>');
    return svgWrap(W, H, o, spec.title);
  }
  function barsFromModel(m, W) {
    var pc = plotCols(m, 2), series = [], s;
    /* Numbered rows (pack sizes, years) go in their own order. */
    var rows = m.xNum ? m.rows.slice().sort(function (a, b) { return a.x - b.x; }) : m.rows;
    for (s = 0; s < pc.length; s++) (function (c, k) { series.push({ name: m.cols[c].name, tone: TONES[k], values: rows.map(function (r) { return r.v[c - 1]; }) }); })(pc[s], s);
    return barChart({ title: m.title, yLabel: pc.length > 1 ? (m.cols[pc[0]].unit || '') : colTitle(m.cols[pc[0]]),
      cats: rows.map(function (r) { return m.xNum ? show(r.x, m.cols[0].dp, m.year) + (m.cols[0].unit ? ' ' + m.cols[0].unit : '') : r.label; }),
      series: series, values: rows.length <= 6 && pc.length === 1, fmt: function (v) { return show(v, m.cols[pc[0]].dp); },
      xLabel: m.xNum ? colTitle(m.cols[0]) : '' }, W);
  }

  /* Donut: parts of one whole. Names in a list beside it, never on leader
     lines - at phone width a leader from the far side has to cross the ring. */
  function donut(m, W) {
    var parts = m.rows.map(function (r) { return { label: r.label, value: r.v[0] }; });
    var rowH = 46, H = Math.max(170, parts.length * rowH + 30);
    var r = Math.min(58, W * 0.17), sw = r * 0.5, cx = r + sw / 2 + 6, cy = H / 2;
    var C = 2 * Math.PI * r, acc = 0, o = [];
    parts.forEach(function (p, i) {
      var len = Math.max(1.5, p.value / 100 * C - 2), start = acc / 100 * C;
      o.push('<circle class="sfd-arc" style="animation-delay:' + (0.08 + i * 0.2).toFixed(2) + 's" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + DONUT[i] + '" stroke-width="' + sw.toFixed(1) +
        '" stroke-dasharray="' + len.toFixed(1) + ' ' + (C + 50).toFixed(1) + '" stroke-dashoffset="' + (-start).toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>');
      acc += p.value;
    });
    var lx = cx + r + sw / 2 + 18, top = cy - (parts.length * rowH) / 2 + 8, dp = m.cols[1].dp;
    parts.forEach(function (p, i) {
      var y = top + i * rowH;
      o.push('<rect x="' + lx.toFixed(1) + '" y="' + (y + 2) + '" width="10" height="10" rx="3" fill="' + DONUT[i] + '" stroke="#9db6f7" stroke-width="' + (i === 2 ? 1 : 0) + '"/>');
      o.push('<text x="' + (lx + 17).toFixed(1) + '" y="' + (y + 11) + '" font-size="12.5" font-weight="600" fill="' + INK + '">' + esc(clean(p.label, Math.max(10, Math.floor((W - lx - 20) / 7)))) + '</text>');
      o.push('<text x="' + (lx + 17).toFixed(1) + '" y="' + (y + 31) + '" font-size="17" font-weight="700" fill="' + (i === 0 ? FOCAL : INK) + '">' + show(p.value, dp) + '%</text>');
    });
    return svgWrap(W, H, o, m.title);
  }

  /* Scatter with a least-squares line: the slope is computed here and is the
     only claim the picture makes about the dots. */
  function scatter(m, W) {
    var pts = m.rows.map(function (r) { return [r.x, r.v[0]]; }), n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
    var den = n * sxx - sx * sx;
    if (!den) return lineChart(m, W);
    var sl = (n * sxy - sx * sy) / den, b = (sy - sl * sx) / n;
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var xpad = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) * 0.06 || 1, ypad = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) * 0.08 || 1;
    var xS = nice(Math.min.apply(null, xs) - xpad, Math.max.apply(null, xs) + xpad, 4, false);
    var yS = nice(Math.min.apply(null, ys) - ypad, Math.max.apply(null, ys) + ypad, 4, false);
    var L = Math.max(30, textW(tick(yS.max), 11.5) + 12), R = 12, T = 26, B = 42, H = Math.round(Math.max(200, Math.min(260, W * 0.64)));
    var pw = W - L - R, ph = H - T - B;
    function X(v) { return L + (v - xS.min) / (xS.max - xS.min) * pw; }
    function Y(v) { return T + ph - (v - yS.min) / (yS.max - yS.min) * ph; }
    var o = [];
    yTitle(o, colTitle(m.cols[1]));
    yS.ticks.forEach(function (t) {
      o.push('<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="' + GRID + '"/>');
      o.push('<text x="' + (L - 8) + '" y="' + (Y(t) + 4).toFixed(1) + '" font-size="11.5" fill="' + MUTED + '" text-anchor="end">' + tick(t) + '</text>');
    });
    xS.ticks.forEach(function (t) { o.push('<text x="' + X(t).toFixed(1) + '" y="' + (T + ph + 17) + '" font-size="11.5" fill="' + MUTED + '" text-anchor="middle">' + tick(t, m.year) + '</text>'); });
    o.push('<text x="' + (L + pw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="11.5" font-weight="600" fill="' + MUTED + '" text-anchor="middle">' + esc(colTitle(m.cols[0])) + '</text>');
    pts.forEach(function (p, k) {
      o.push('<circle class="sfd-dot" style="animation-delay:' + (0.05 + k * 0.05).toFixed(2) + 's" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="4.6" fill="' + BRAND + '" fill-opacity=".78" stroke="#fff" stroke-width="1.5"/>');
    });
    var x0 = xS.min, x1 = xS.max;
    o.push('<path class="sfd-line" pathLength="1" style="animation-delay:.5s" d="M' + X(x0).toFixed(1) + ' ' + Y(sl * x0 + b).toFixed(1) + ' L' + X(x1).toFixed(1) + ' ' + Y(sl * x1 + b).toFixed(1) + '" stroke="' + FOCAL + '" stroke-width="2.2" stroke-linecap="round" fill="none"/>');
    var up = sl >= 0, lbl = 'Trend: ' + (up ? '+' : '−') + (Math.round(Math.abs(sl) * 100) / 100) + ' per ' + (m.cols[0].unit || m.cols[0].name).replace(/s$/, '');
    o.push('<text class="sfd-late" x="' + (up ? L + 8 : L + pw - 8) + '" y="' + (T + 14) + '" font-size="12" font-weight="700" fill="' + FOCAL + '" text-anchor="' + (up ? 'start' : 'end') +
      '" stroke="#f7f9fe" stroke-width="4" paint-order="stroke" stroke-linejoin="round">' + esc(lbl) + '</text>');
    return svgWrap(W, H, o, m.title);
  }

  function chart(m, W) {
    W = Math.max(260, Math.min(560, Math.floor(W || 320)));
    if (m.chart === 'line') return lineChart(m, W);
    if (m.chart === 'bars') return barsFromModel(m, W);
    if (m.chart === 'donut') return donut(m, W);
    if (m.chart === 'scatter') return scatter(m, W);
    return '';
  }

  /* ── TABLE ───────────────────────────────────────────────────────────── */
  /* opts: {id, caption, add:{name,unit,cells:[html]}, cell:function(r,c)->html|null, given:{rowIdx:1}} */
  function table(m, opts) {
    opts = opts || {};
    var h = '<div class="sfd-tw"><table class="sfd-dt"' + (opts.id ? ' id="' + esc(opts.id) + '"' : '') + '>';
    if (opts.caption) h += '<caption>' + esc(opts.caption) + '</caption>';
    h += '<thead><tr>' + m.cols.map(function (c) {
      return '<th scope="col">' + esc(c.name) + (c.unit ? '<small>' + esc(c.unit) + '</small>' : '') + '</th>';
    }).join('') + (opts.add ? '<th scope="col" class="sfd-add">' + esc(opts.add.name) + (opts.add.unit ? '<small>' + esc(opts.add.unit) + '</small>' : '') + '</th>' : '') + '</tr></thead><tbody>';
    m.rows.forEach(function (r, ri) {
      h += '<tr' + (opts.given && opts.given[ri] ? ' class="sfd-given"' : '') + '><td data-r="' + ri + '" data-c="0">' + esc(m.xNum ? show(r.x, m.cols[0].dp, m.year) : r.label) +
        (opts.given && opts.given[ri] ? '<span class="sfd-tag">example</span>' : '') + '</td>';
      r.v.forEach(function (v, k) {
        var custom = opts.cell ? opts.cell(ri, k + 1) : null;
        h += '<td data-r="' + ri + '" data-c="' + (k + 1) + '">' + (custom != null ? custom : esc(show(v, m.cols[k + 1].dp))) + '</td>';
      });
      if (opts.add) h += '<td class="sfd-add" data-r="' + ri + '" data-c="add">' + (opts.add.cells[ri] || '') + '</td>';
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ── THE FIGURE: chart and table, one ground ──────────────────────────
     A drawing keeps a paper ground in dark mode (the design system), and the
     table it turns into keeps the same ground, so switching never flips the
     card from paper to night and back. */
  function figure(m, W) {
    var svg = m.chart !== 'none' ? chart(m, W - 22) : '';
    var seg = svg ? '<div class="sfd-seg" role="tablist" aria-label="Show as">' +
      '<button type="button" role="tab" aria-selected="true" data-v="chart" onclick="SFData.view(this)">Chart</button>' +
      '<button type="button" role="tab" aria-selected="false" data-v="table" onclick="SFData.view(this)">Table</button>' +
      '<span class="sfd-thumb"></span></div>' : '';
    return '<div class="sfd-fig art-paper" data-view="' + (svg ? 'chart' : 'table') + '">' +
      '<div class="sfd-top"><div class="sfd-title">' + esc(m.title) + '</div>' + seg + '</div>' +
      (svg ? '<div class="sfd-view sfd-chart">' + svg + '</div>' : '') +
      '<div class="sfd-view sfd-table">' + table(m) + '</div>' +
      '<div class="sfd-src"><span></span>From your notes</div></div>';
  }
  /* The Chart | Table switch. The thumb slides on the page's spring; the
     view under it cross-fades. Chart drawing replays when it comes back. */
  function view(btn) {
    var fig = btn && btn.closest ? btn.closest('.sfd-fig') : null;
    if (!fig) return;
    var v = btn.getAttribute('data-v');
    fig.setAttribute('data-view', v);
    var bs = fig.querySelectorAll('.sfd-seg button');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-selected', bs[i] === btn ? 'true' : 'false');
  }

  /* ── QUESTIONS, built from the numbers ─────────────────────────────────── */
  function pickRows(n, keep, max, seed) {
    var idx = [], i;
    for (i = 0; i < n; i++) if (i !== keep) idx.push(i);
    idx.sort(function (a, b) { return (hash(seed + a) % 997) - (hash(seed + b) % 997); });
    idx = idx.slice(0, max - 1);
    idx.push(keep);
    return idx.sort(function (a, b) { return a - b; });
  }

  /* READ THE TABLE. Two shapes, both answered by arithmetic on the table:
     - ordered numeric rows: between which two did it rise the least / most?
     - otherwise: which row has the highest / lowest value?
     A question whose answer is a tie is never asked. */
  function readQ(m, seed) {
    /* The column the lesson is about: the one a rule works out, when there
       is one ("per pen" is the point, not "total"); otherwise the first. */
    var y = m.rule ? m.rule.col - 1 : 0, col = m.cols[y + 1], rows = m.rows, i;
    var name = col.name.toLowerCase(), most = hash(seed) % 2 === 0;
    if (m.xNum && rows.length >= 3 && rows.length <= 5) {     /* four steps at most: four options */
      var sorted = rows.map(function (r, k) { return { r: r, k: k }; }).sort(function (a, b) { return a.r.x - b.r.x; });
      var inOrder = sorted.every(function (s, k) { return s.k === k; });
      var d = [];
      for (i = 1; i < sorted.length; i++) d.push(sorted[i].r.v[y] - sorted[i - 1].r.v[y]);
      var allUp = d.every(function (x) { return x > 0; }), allDown = d.every(function (x) { return x < 0; });
      if (inOrder && (allUp || allDown)) {
        var mag = d.map(Math.abs), target = most ? Math.max.apply(null, mag) : Math.min.apply(null, mag);
        if (mag.filter(function (x) { return Math.abs(x - target) < 1e-9; }).length === 1) {
          var key = mag.indexOf(target), verb = allUp ? 'rise' : 'fall', opts = [];
          for (i = 0; i < d.length; i++) opts.push(rowName(m, rows[i]) + ' → ' + rowName(m, rows[i + 1]));
          var steps = d.map(function (x) { return (x > 0 ? '+' : '−') + show(Math.abs(x), col.dp); });
          return { type: 'readtable', mode: 'delta', difficulty: 'Medium', data: m.src, col: y + 1,
            question: 'Between which two rows did ' + name + ' ' + verb + ' the ' + (most ? 'most' : 'least') + '?',
            options: opts, correctIndex: key, deltas: steps, lit: [key, key + 1],
            explanation: 'Look at each step: ' + steps.join(', ') + (col.unit ? ' ' + col.unit : '') + '. The ' + (most ? 'biggest' : 'smallest') +
              ' ' + verb + ' is ' + steps[key] + ', from ' + opts[key].replace(' → ', ' to ') + '.' + (m.notice ? ' ' + m.notice : '') };
        }
      }
    }
    var vals = rows.map(function (r) { return r.v[y]; }), hi = most;
    var t = hi ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    if (vals.filter(function (v) { return v === t; }).length !== 1) { hi = !hi; t = hi ? Math.max.apply(null, vals) : Math.min.apply(null, vals); }
    if (vals.filter(function (v) { return v === t; }).length !== 1) return null;
    var ans = vals.indexOf(t), pick = pickRows(rows.length, ans, 4, seed);
    return { type: 'readtable', mode: hi ? 'max' : 'min', difficulty: 'Easy', data: m.src, col: y + 1,
      question: 'Which has the ' + (hi ? 'highest' : 'lowest') + ' ' + name + '?',
      options: pick.map(function (k) { return rowName(m, rows[k]); }), correctIndex: pick.indexOf(ans), lit: [ans],
      explanation: rowName(m, rows[ans]) + ' has the ' + (hi ? 'highest' : 'lowest') + ' ' + name + ': ' + withUnit(t, col) + '.' + (m.notice ? ' ' + m.notice : '') };
  }

  /* COMPLETE THE TABLE: only when a rule holds on every row. The first row
     stays as the worked example; up to two of the others are blanked. */
  function fillQ(m, seed) {
    var r = m.rule;
    if (!r || m.rows.length < 3) return null;
    var blanks = [], i;
    for (i = 1; i < m.rows.length && blanks.length < 2; i++) blanks.push(i);
    var answers = blanks.map(function (k) { return m.rows[k].v[r.col - 1]; });
    return { type: 'filltable', difficulty: 'Medium', data: m.src, rule: r, blanks: blanks, answers: answers,
      question: 'Complete the table: ' + r.text,
      explanation: 'Use the rule ' + r.text + ': ' + blanks.map(function (k, j) { return withUnit(answers[j], m.cols[r.col]); }).join(' and ') + '.' };
  }

  /* SPOT THE BAD GRAPH: the day's own bars with ONE known distortion - the
     axis cut just under the smallest value, so close numbers look far apart.
     Only when the numbers really are close (the cut is what makes the lie). */
  function badQ(m, seed) {
    if (m.cols.length < 2 || m.rows.length < 3 || m.rows.length > 6) return null;
    var vals = m.rows.map(function (r) { return r.v[0]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (!(lo > 0) || hi === lo || (hi - lo) / hi > 0.3) return null;
    var span = hi - lo, st = span >= 20 ? 10 : span >= 8 ? 5 : span >= 3 ? 1 : 0.5;
    var y0 = Math.floor((lo - span * 0.15) / st) * st;
    if (!(y0 > 0)) return null;
    var pct = Math.round((hi - lo) / lo * 100);
    var opts = ['The vertical axis starts at ' + show(y0, st < 1 ? 1 : 0) + ', not at 0',
                'It uses bars instead of a line', 'It shows only ' + m.rows.length + ' ' + (m.xNum ? m.cols[0].name.toLowerCase() : 'items'),
                'Every bar is the same colour'];
    var at = hash(seed + 'bad') % 4, order = [1, 2, 3];
    order.splice(at, 0, 0);
    return { type: 'badgraph', difficulty: 'Medium', data: m.src, y0: y0,
      question: 'This chart makes the differences look huge. What makes it misleading?',
      options: order.map(function (k) { return opts[k]; }), correctIndex: at,
      explanation: 'The axis starts at ' + show(y0, st < 1 ? 1 : 0) + ', so a difference of about ' + pct + '% fills the whole chart. With the axis at zero the bars are close to the same height.' };
  }
  /* The bars the bad-graph card draws (and redraws as its axis falls). */
  function badBars(q, W, y0) {
    var m = check(q.data);
    if (!m) return '';
    return barChart({ title: m.title, yLabel: colTitle(m.cols[1]), values: true,
      fmt: function (v) { return show(v, m.cols[1].dp); },
      cats: m.rows.map(function (r) { return m.xNum ? show(r.x, m.cols[0].dp, m.year) : r.label; }),
      series: [{ name: m.cols[1].name, tone: BRAND, values: m.rows.map(function (r) { return r.v[0]; }) }] }, W, y0);
  }

  /* Up to two questions a day: Read the table first (looking up is the
     easiest data skill), then ONE of Complete the table (when a rule holds)
     or Spot the bad graph (on a data-minded day, at most every third day). */
  function questions(m, ctx) {
    ctx = ctx || {};
    var seed = String(ctx.title || m.title);
    var out = { read: null, second: null };
    try { out.read = readQ(m, seed); } catch (e) { out.read = null; }
    try { out.second = fillQ(m, seed); } catch (e2) { out.second = null; }
    if (!out.second) {
      var dataDay = /\b(data|graph|chart|statistic|survey|percent|advert|sales|price|cost|population)/i.test(String(ctx.title || '') + ' ' + m.title);
      var cadence = (+ctx.dayIndex || 0) % 3 === 2;
      if (dataDay || cadence) { try { out.second = badQ(m, seed); } catch (e3) { out.second = null; } }
    }
    return out;
  }

  /* A spring the page can wait on: critically damped, from the current
     value, ending on a timer as well as a frame (a hidden tab runs none). */
  function settle(from, to, ms, each, done) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !window.requestAnimationFrame) { each(to); if (done) done(); return; }
    var w = 7 / (ms / 1000), t0 = null, finished = false;
    function frame(t) {
      if (finished) return;
      if (t0 == null) t0 = t;
      var s = (t - t0) / 1000, k = (1 + w * s) * Math.exp(-w * s);
      if (s * 1000 >= ms) { finish(); return; }
      each(to + (from - to) * k);
      requestAnimationFrame(frame);
    }
    function finish() { if (finished) return; finished = true; each(to); if (done) done(); }
    requestAnimationFrame(frame);
    setTimeout(finish, ms + 400);
  }

  /* ── STYLES, once ────────────────────────────────────────────────────── */
  var CSS =
    '.sfd-fig{padding:.7rem .65rem .55rem;color:#1a1d2e;margin:.2rem 0}' +
    '.sfd-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.6rem;margin:0 .2rem .4rem}' +
    ".sfd-title{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:1.1rem;line-height:1.2;color:#1a1d2e;text-wrap:balance}" +
    '.sfd-src{font-size:.7rem;color:#6b7280;margin:.4rem .2rem 0;display:flex;align-items:center;gap:.35rem}' +
    '.sfd-src span{width:6px;height:6px;border-radius:50%;background:#9aabcc;flex:none}' +
    '.sfd-svg{display:block;width:100%;height:auto;overflow:visible}' +
    '.sfd-fig[data-view="chart"] .sfd-table,.sfd-fig[data-view="table"] .sfd-chart{display:none}' +
    '.sfd-view{animation:sfdFade .32s ease both}' +
    '@keyframes sfdFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
    '.sfd-seg{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:2px;border-radius:999px;background:rgba(26,29,46,.06);flex:none;isolation:isolate}' +
    ".sfd-seg button{position:relative;z-index:1;border:0;background:none;cursor:pointer;padding:.32rem .7rem;border-radius:999px;font:600 .72rem 'DM Sans',system-ui,sans-serif;color:#5b6478;min-width:3.6rem;transition:color .2s ease,transform var(--spring-fast-ms,340ms) var(--spring-fast,ease)}" +
    '.sfd-seg button:active{transform:scale(.94);transition-duration:80ms}' +
    '.sfd-seg button[aria-selected="true"]{color:#1a1d2e}' +
    '.sfd-seg button:focus-visible{outline:2px solid #4a7cf6;outline-offset:1px}' +
    '.sfd-thumb{position:absolute;z-index:0;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(26,29,46,.12),0 3px 8px -2px rgba(26,29,46,.14);transition:transform var(--spring-ms,560ms) var(--spring,cubic-bezier(.22,1,.36,1))}' +
    '.sfd-fig[data-view="table"] .sfd-thumb{transform:translateX(100%)}' +
    /* the table */
    '.sfd-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px;border:1px solid var(--border,#e8ecf4);background:var(--white,#fff)}' +
    '.sfd-fig .sfd-tw{border-color:#e3e9f7;background:#fff}' +
    '.sfd-dt{border-collapse:separate;border-spacing:0;width:100%;font-variant-numeric:tabular-nums lining-nums;font-size:.86rem;color:var(--ink,#1a1d2e)}' +
    '.sfd-fig .sfd-dt{color:#1a1d2e}' +
    '.sfd-dt caption{caption-side:top;text-align:left;font-size:.72rem;font-weight:600;color:var(--muted,#6b7280);padding:.6rem .7rem .45rem}' +
    '.sfd-dt th,.sfd-dt td{padding:.55rem .7rem;text-align:right;white-space:nowrap;border-bottom:1px solid var(--border,#e8ecf4);transition:background .3s ease,color .3s ease,opacity .3s ease}' +
    '.sfd-fig .sfd-dt th,.sfd-fig .sfd-dt td{border-bottom-color:#edf1f8}' +
    '.sfd-dt tr:last-child td{border-bottom:0}' +
    '.sfd-dt th:first-child,.sfd-dt td:first-child{text-align:left;position:sticky;left:0;background:inherit}' +
    '.sfd-dt thead th,.sfd-dt thead th:first-child{font-size:.68rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#6b7280);background:var(--soft,#f4f6fb);vertical-align:bottom}' +
    '.sfd-fig .sfd-dt thead th,.sfd-fig .sfd-dt thead th:first-child{background:#f4f7fd;color:#5b6478}' +
    '.sfd-dt thead th small{display:block;text-transform:none;letter-spacing:0;font-weight:500;font-size:.68rem;white-space:normal;margin-top:.05rem}' +
    '.sfd-dt tbody tr{background:var(--white,#fff)}' +
    '.sfd-fig .sfd-dt tbody tr{background:#fff}' +
    '.sfd-dt td:first-child{font-weight:600}' +
    '.sfd-given td{color:var(--muted,#6b7280)}' +
    '.sfd-tag{font-size:.6rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#6b7280);border:1px solid var(--border,#e8ecf4);border-radius:999px;padding:.05rem .4rem;margin-left:.35rem;vertical-align:1px}' +
    /* the evidence lights up after an answer */
    '.sfd-dt .sfd-add{display:none}' +
    '.sfd-dt.has-add .sfd-add{display:table-cell;animation:sfdFade .4s ease both}' +
    '.sfd-dt.is-lit tbody td{opacity:.42}' +
    '.sfd-dt.is-lit tbody td.lit{opacity:1;background:#eef3ff;color:#1d3a8a;font-weight:700}' +
    'body.dark .sfd-dt.is-lit tbody td.lit{background:rgba(74,124,246,.2);color:#cfe0ff}' +
    '.sfd-delta{font-weight:700;color:#2f5bd8}body.dark .sfd-delta{color:#a9c1ff}' +
    /* complete the table */
    '.sfd-rule{display:flex;align-items:center;gap:.5rem;background:var(--blue-tint,#eef3ff);color:var(--blue-ink,#2f5fe0);border-radius:12px;padding:.55rem .75rem;font-size:.84rem;font-weight:600;margin-bottom:.8rem}' +
    '.sfd-rule b{flex:none;font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:#4a7cf6;color:#fff;border-radius:6px;padding:.18rem .4rem}' +
    '.sfd-cell{display:inline-flex;flex-direction:column;align-items:flex-end;gap:.15rem}' +
    ".sfd-in{width:5.4rem;text-align:right;font:600 .9rem 'DM Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;color:var(--ink,#1a1d2e);padding:.42rem .5rem;border:1.5px solid var(--border,#e8ecf4);border-radius:10px;background:var(--soft,#f4f6fb);transition:border-color .18s ease,background .18s ease,box-shadow .18s ease}" +
    '.sfd-in:focus{outline:none;border-color:#4a7cf6;background:var(--white,#fff);box-shadow:0 0 0 3px rgba(74,124,246,.18)}' +
    'body.dark .sfd-in{background:#1e2336;border-color:#2a3150}' +
    '.sfd-in.sel-right,.sfd-in.sel-wrong{text-decoration-thickness:1.5px}.sfd-in.sel-wrong{text-decoration:line-through}' +
    '.sfd-fix{font-size:.74rem;font-weight:700;color:#065f46;animation:sfdFade .4s ease both}body.dark .sfd-fix{color:#6ee7b7}' +
    ".sfd-check{margin-top:.85rem;width:100%;min-height:46px;border:0;border-radius:999px;background:var(--ink,#1a1d2e);color:#fff;font:600 .9rem 'DM Sans',system-ui,sans-serif;cursor:pointer;transition:transform var(--spring-fast-ms,340ms) var(--spring-fast,ease),opacity .2s}" +
    'body.dark .sfd-check{background:#e9eeff;color:#141925}' +
    '.sfd-check:active:not(:disabled){transform:scale(.97);transition-duration:80ms}.sfd-check:disabled{opacity:.35;cursor:default}' +
    /* drawing on: once, every time a chart is shown - CSS only */
    '.sfd-svg .sfd-line{stroke-dasharray:1;stroke-dashoffset:1;animation:sfdTrace .9s .12s cubic-bezier(.33,0,.15,1) forwards}' +
    '.sfd-svg .sfd-dot{transform-box:fill-box;transform-origin:center;animation:sfdPop .42s cubic-bezier(.34,1.5,.64,1) backwards}' +
    '.sfd-svg .sfd-bar{transform-box:fill-box;transform-origin:50% 100%;animation:sfdGrow .62s cubic-bezier(.22,1,.36,1) backwards}' +
    '.sfd-svg .sfd-arc{animation:sfdFade .5s ease backwards}' +
    '.sfd-svg .sfd-late{animation:sfdFade .4s .85s ease backwards}' +
    '@keyframes sfdTrace{to{stroke-dashoffset:0}}' +
    '@keyframes sfdPop{from{opacity:0;transform:scale(.3)}}' +
    '@keyframes sfdGrow{from{transform:scaleY(0)}}' +
    '.sfd-still .sfd-svg *{animation:none!important;stroke-dashoffset:0!important}' +
    '@media (prefers-reduced-motion:reduce){.sfd-svg *,.sfd-view,.sfd-thumb{animation:none!important;transition:none!important}.sfd-svg .sfd-line{stroke-dashoffset:0}}';
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('sfd-style')) return;
    var s = document.createElement('style');
    s.id = 'sfd-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  if (typeof document !== 'undefined') {
    if (document.head) injectCss(); else document.addEventListener('DOMContentLoaded', injectCss);
  }

  var api = { allowed: allowed, check: check, figure: figure, table: table, chart: chart, view: view, withUnit: withUnit,
              barChart: barChart, badBars: badBars, questions: questions, show: show, settle: settle,
              esc: esc, toNum: toNum };
  if (typeof window !== 'undefined') window.SFData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

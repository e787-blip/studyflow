/* Shapes and graphs for maths questions, drawn by code from the question's own
   words. SFShapes.figure(text, {head, done, answer}) returns an <svg> string,
   or '' when the question has nothing to draw.
   Before answering (done false) a picture shows only what the question gives,
   with "?" for what is asked. Pictures that WOULD BE the answer (a graph of an
   inequality, two lines crossing, y read off a line) appear only when done. */
(function () {
  var INK = '#1a1d2e', BLUE = '#3563e9', TINT = '#e4ecfd', MID = '#9db6f3', GRID = '#e3e9f7', MUTE = '#5d6580';
  var W = 340;
  function r(n) { return Math.round(n * 10) / 10; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(n) { return String(Math.round(n * 1000) / 1000).replace('-', '−'); }
  function num(s) { return parseFloat(String(s).replace(/[−–]/g, '-')); }
  function T(x, y, s, o) {
    o = o || {};
    return '<text x="' + r(x) + '" y="' + r(y) + '" text-anchor="' + (o.a || 'middle') + '" font-family="DM Sans, sans-serif" font-size="' + (o.size || 13) + '" font-weight="' + (o.w || 600) + '" fill="' + (o.f || INK) + '" stroke="#f9fbff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">' + esc(s) + '</text>';
  }
  function Q(x, y, text, o) { o = o || {}; o.f = BLUE; o.w = 700; o.size = o.size || 15; return T(x, y, text, o); }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    return '<line x1="' + r(x1) + '" y1="' + r(y1) + '" x2="' + r(x2) + '" y2="' + r(y2) + '" stroke="' + (o.c || INK) + '" stroke-width="' + (o.w || 1.6) + '" stroke-linecap="round"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>';
  }
  function P(pts, o) {
    o = o || {};
    return '<polygon points="' + pts.map(function (p) { return r(p[0]) + ',' + r(p[1]); }).join(' ') + '" fill="' + (o.fill || 'none') + '" stroke="' + (o.c || INK) + '" stroke-width="' + (o.w || 1.6) + '" stroke-linejoin="round"/>';
  }
  function R(x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(w) + '" height="' + r(h) + '" rx="' + (o.rx || 0) + '" fill="' + (o.fill || 'none') + '" stroke="' + (o.c || INK) + '" stroke-width="' + (o.w == null ? 1.6 : o.w) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>';
  }
  function dot(x, y, rad, fill, c) { return '<circle cx="' + r(x) + '" cy="' + r(y) + '" r="' + rad + '" fill="' + fill + '"' + (c ? ' stroke="' + c + '" stroke-width="1.6"' : '') + '/>'; }
  function wrap(h, body, label) { return '<svg class="sf-shape" viewBox="0 0 ' + W + ' ' + h + '" width="100%" style="max-width:360px;display:block;margin:0 auto" role="img" aria-label="' + esc(label) + '">' + body + '</svg>'; }
  function arc(cx, cy, rad, from, to) {   // angles in degrees, anticlockwise from the right
    function at(a) { return [cx + rad * Math.cos(a * Math.PI / 180), cy - rad * Math.sin(a * Math.PI / 180)]; }
    var a = at(from), b = at(to);
    return '<path d="M' + r(a[0]) + ' ' + r(a[1]) + 'A' + rad + ' ' + rad + ' 0 ' + (to - from > 180 ? 1 : 0) + ' 0 ' + r(b[0]) + ' ' + r(b[1]) + '" fill="none" stroke="' + BLUE + '" stroke-width="1.6"/>';
  }
  function polar(cx, cy, rad, a) { return [cx + rad * Math.cos(a * Math.PI / 180), cy - rad * Math.sin(a * Math.PI / 180)]; }
  function fit(a, b, maxA, maxB) {   // two lengths to scale, but never thinner than a label needs
    var s = Math.min(maxA / a, maxB / b), x = a * s, y = b * s, off = false;
    if (x < 64) { x = 64; off = true; }
    if (y < 52) { y = 52; off = true; }
    return { x: x, y: y, off: off };
  }
  function scaleNote(off, y) { return off ? T(W - 8, y, 'not to scale', { a: 'end', size: 10.5, f: MUTE, w: 400 }) : ''; }
  function rightMark(x, y, dx, dy) { return '<path d="M' + r(x + dx) + ' ' + r(y) + 'v' + dy + 'h' + (-dx) + '" fill="none" stroke="' + INK + '" stroke-width="1.2"/>'; }

  /* ---- shapes ---- */
  function rectangle(l, w, unit, o) {
    var f = fit(l, w, 210, 140), x = (W - f.x) / 2 - 14, y = 18, b = '';
    b += R(x, y, f.x, f.y, { fill: TINT, w: o.outline ? 4 : 1.8, c: o.outline ? BLUE : INK });
    if (o.squares) {
      var i; for (i = 1; i < l; i++) b += L(x + f.x * i / l, y, x + f.x * i / l, y + f.y, { c: MID, w: 1 });
      for (i = 1; i < w; i++) b += L(x, y + f.y * i / w, x + f.x, y + f.y * i / w, { c: MID, w: 1 });
    }
    if (o.fence) b += R(x - 6, y - 6, f.x + 12, f.y + 12, { c: BLUE, dash: '2 7', w: 4 });
    b += T(x + f.x / 2, y + f.y + 23, l + ' ' + unit) + T(x + f.x + 13, y + f.y / 2 + 5, w + ' ' + unit, { a: 'start' });
    if (o.middle) b += Q(x + f.x / 2, y + f.y / 2 + 5, o.middle);
    var h = y + f.y + 40;
    return wrap(h, b + scaleNote(f.off, h - 4), 'Rectangle ' + l + ' by ' + w + ' ' + unit);
  }
  function triangleArea(base, high, o) {
    var f = fit(base, high, 220, 140), x = (W - f.x) / 2, y = 16, ax = x + f.x * 0.62, by = y + f.y;
    var b = P([[x, by], [x + f.x, by], [ax, y]], { fill: TINT }) + L(ax, y, ax, by, { dash: '5 4', c: BLUE }) + rightMark(ax, by - 10, 10, 10) +
      T(x + f.x / 2, by + 23, 'base ' + base + ' cm') + T(ax - 7, y + f.y * 0.68, high + ' cm', { a: 'end' });
    if (o.done) b += Q(x + f.x + 4, y + f.y * 0.3, o.done, { a: 'start' });
    var h = by + 40;
    return wrap(h, b + scaleNote(f.off, h - 4), 'Triangle with base ' + base + ' and height ' + high);
  }
  function circle(rad, kind, o) {
    var cx = W / 2, cy = 92, R0 = 76;
    var b = '<circle cx="' + cx + '" cy="' + cy + '" r="' + R0 + '" fill="' + (o.done && kind === 'area' ? MID : TINT) + '" stroke="' + (o.done && kind !== 'area' ? BLUE : INK) + '" stroke-width="' + (o.done && kind !== 'area' ? 4 : 1.8) + '"/>' +
      L(cx, cy, cx + R0, cy) + dot(cx, cy, 3.5, INK) + T(cx + R0 / 2, cy - 8, rad + ' cm');
    if (o.done) b += Q(cx, cy + 34, o.done);
    return wrap(184, b, 'Circle with radius ' + rad);
  }
  function rightTriangle(p, q, labels, o) {
    var f = fit(p, q, 200, 140), x = (W - f.x) / 2 + 12, y = 18, by = y + f.y;
    var b = P([[x, by], [x + f.x, by], [x, y]], { fill: TINT }) + rightMark(x, by - 12, 12, 12);
    var items = [[x + f.x / 2, by + 23, 'middle', labels[0]], [x - 10, y + f.y / 2 + 5, 'end', labels[1]], [x + f.x / 2 + 10, y + f.y / 2 - 6, 'start', labels[2]]];
    items.forEach(function (it) {
      var asked = it[3].asked, text = it[3].t;
      b += (asked ? Q : T)(it[0], it[1], text, { a: it[2] });
    });
    var h = by + 40;
    return wrap(h, b + scaleNote(f.off, h - 4), 'Right triangle');
  }
  function box(l, w, h, o) {
    var s = Math.min(190 / (l + w * 0.5), 140 / (h + w * 0.5));
    var fl = Math.max(54, l * s), fh = Math.max(46, h * s), d = Math.max(26, w * s * 0.5);
    var x = (W - fl - d) / 2, y = 16 + d, b = '';
    b += P([[x, y], [x + d, y - d], [x + fl + d, y - d], [x + fl, y]], { fill: '#f1f5fe' });
    b += P([[x + fl, y], [x + fl + d, y - d], [x + fl + d, y - d + fh], [x + fl, y + fh]], { fill: MID });
    b += R(x, y, fl, fh, { fill: TINT });
    b += T(x + fl / 2, y + fh + 21, l + ' cm') + T(x - 9, y + fh / 2 + 5, h + ' cm', { a: 'end' }) + T(x + fl + d / 2 + 9, y + fh - d / 2 + 15, w + ' cm', { a: 'start' });
    if (o.done) b += Q(x + fl / 2, y + fh / 2 + 5, o.done);
    return wrap(y + fh + 34, b, 'Box ' + l + ' by ' + w + ' by ' + h);
  }
  function triangleAngles(a, c, o) {
    var tA = Math.tan(a * Math.PI / 180), tB = Math.tan(c * Math.PI / 180);
    var base = 250, ax = base * tB / (tA + tB), high = ax * tA;
    if (a === 90) { ax = 0; high = base * tB; }
    var s = Math.min(1, 150 / high, 230 / Math.max(base, 1)), bw = base * s, hh = high * s, x = (W - bw) / 2, y = 28, by = y + hh, top = [x + ax * s, y];
    var third = 180 - a - c;
    var b = P([[x, by], [x + bw, by], top], { fill: TINT });
    b += arc(x, by, 22, 0, a) + arc(x + bw, by, 22, 180 - c, 180) + arc(top[0], top[1], 18, 180 + a, 360 - c);
    /* Outside the corners, so two wide angles on a short base never collide. */
    b += T(x - 8, by + 2, a + '°', { a: 'end' }) + T(x + bw + 8, by + 2, c + '°', { a: 'start' });
    b += Q(top[0] + 26, top[1] + 4, o.done ? third + '°' : '?', { a: 'start' });
    return wrap(by + 14, b, 'Triangle with two known angles');
  }
  function angleSplit(a, whole, o) {
    var cx = whole === 90 ? 110 : 170, cy = 140, len = 120, b = '';
    if (whole === 90) b += L(cx, cy, cx + len, cy) + L(cx, cy, cx, cy - len) + rightMark(cx, cy - 12, 12, 12);
    else b += L(cx - 140, cy, cx + 140, cy);
    var tip = polar(cx, cy, len, a);
    b += L(cx, cy, tip[0], tip[1], { c: INK, w: 2 }) + dot(cx, cy, 3.5, INK);
    b += arc(cx, cy, 30, 0, a) + arc(cx, cy, 44, a, whole);
    var p1 = polar(cx, cy, 62, Math.max(a / 2, 9)), p2 = polar(cx, cy, 70, Math.min(a + (whole - a) / 2, whole - 9));
    b += T(p1[0], p1[1] + 5, a + '°') + Q(p2[0], p2[1] + 5, o.done ? (whole - a) + '°' : '?');
    return wrap(160, b, (whole === 90 ? 'Right angle' : 'Straight line') + ' split into two angles');
  }
  function polygon(n, o) {
    var cx = W / 2, cy = 88, pts = [], i;
    for (i = 0; i < n; i++) pts.push(polar(cx, cy, 78, 90 + i * 360 / n));
    var b = P(pts, { fill: TINT, w: 2 });
    if (o.done) { for (i = 2; i < n - 1; i++) b += L(pts[0][0], pts[0][1], pts[i][0], pts[i][1], { c: BLUE, dash: '5 4' }); }
    pts.forEach(function (p) { b += dot(p[0], p[1], 3.5, INK); });
    b += T(cx, 188, o.done ? (n - 2) + ' triangles × 180°' : n + ' sides');
    return wrap(198, b, 'A shape with ' + n + ' sides');
  }

  /* ---- coordinate grid ----
     Labels are placed after looking at what is already there: a point's name
     takes the first free spot round it, and a tick number or axis letter that
     would sit under a name is left out. */
  function plane(xs, ys) {
    var x0 = Math.floor(Math.min.apply(null, xs.concat(0))) - 1, x1 = Math.ceil(Math.max.apply(null, xs.concat(0))) + 1;
    var y0 = Math.floor(Math.min.apply(null, ys.concat(0))) - 1, y1 = Math.ceil(Math.max.apply(null, ys.concat(0))) + 1;
    while (x1 - x0 < 8) { x0--; x1++; }
    while (y1 - y0 < 8) { y0--; y1++; }
    var u = Math.min(300 / (x1 - x0), 250 / (y1 - y0));
    var w = (x1 - x0) * u, h = (y1 - y0) * u, left = (W - w) / 2, top = 14, H = h + top + 28;
    var X = function (v) { return left + (v - x0) * u; }, Y = function (v) { return top + (y1 - v) * u; };
    var span = Math.max(x1 - x0, y1 - y0), step = span <= 14 ? 1 : span <= 28 ? 2 : 5;
    var every = step * Math.max(1, Math.ceil(24 / (step * u))), grid = '', names = '', taken = [], i;
    function boxOf(x, y, text, size, a) {
      var tw = String(text).length * size * 0.6, bx = a === 'start' ? x : a === 'end' ? x - tw : x - tw / 2;
      return { x: bx, y: y - size, w: tw, h: size * 1.35 };
    }
    function free(b) {
      return b.x >= 1 && b.x + b.w <= W - 1 && b.y >= 0 && b.y + b.h <= H && !taken.some(function (t) {
        return b.x < t.x + t.w + 1 && t.x < b.x + b.w + 1 && b.y < t.y + t.h && t.y < b.y + b.h;
      });
    }
    /* spots: [x, y, anchor] in order of preference */
    function place(text, spots, color, size) {
      var k = 0, b = null;
      for (; k < spots.length; k++) { b = boxOf(spots[k][0], spots[k][1], text, size, spots[k][2]); if (free(b)) break; }
      if (k === spots.length) { k = 0; b = boxOf(spots[0][0], spots[0][1], text, size, spots[0][2]); }
      taken.push(b);
      names += T(spots[k][0], spots[k][1], text, { a: spots[k][2], f: color, w: 700, size: size });
    }
    for (i = Math.ceil(x0 / step) * step; i <= x1; i += step) grid += L(X(i), top, X(i), top + h, { c: GRID, w: 1 });
    for (i = Math.ceil(y0 / step) * step; i <= y1; i += step) grid += L(left, Y(i), left + w, Y(i), { c: GRID, w: 1 });
    grid += L(left, Y(0), left + w, Y(0), { w: 1.3 }) + L(X(0), top, X(0), top + h, { w: 1.3 });
    /* A name across an axis reads wrong (a minus sign on the axis looks like =). */
    taken.push({ x: left, y: Y(0) - 1, w: w, h: 2 }, { x: X(0) - 1, y: top, w: 2, h: h });
    var g = {
      X: X, Y: Y, place: place,
      reserve: function (x, y) { taken.push({ x: X(x) - 6, y: Y(y) - 6, w: 12, h: 12 }); },
      line: function (A, B, C, color) {   // A x + B y = C, clipped to the grid
        var pts = [];
        function add(x, y) { if (x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]); }
        if (B) { add(x0, (C - A * x0) / B); add(x1, (C - A * x1) / B); }
        if (A) { add((C - B * y0) / A, y0); add((C - B * y1) / A, y1); }
        pts.sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
        if (pts.length < 2) return '';
        var a = pts[0], z = pts[pts.length - 1];
        return L(X(a[0]), Y(a[1]), X(z[0]), Y(z[1]), { c: color || BLUE, w: 2.6 });
      },
      point: function (x, y, text, o) {
        o = o || {};
        var px = X(x), py = Y(y);
        taken.push({ x: px - 6, y: py - 6, w: 12, h: 12 });
        if (text) {
          var up = [[px + 8, py - 9, 'start'], [px - 8, py - 9, 'end']], down = [[px + 8, py + 18, 'start'], [px - 8, py + 18, 'end']];
          var spots = (o.below ? down.concat(up) : up.concat(down)).concat([[px, py - 12, 'middle'], [px, py + 22, 'middle'], [px + 10, py + 4, 'start'], [px - 10, py + 4, 'end'], [px + 8, py - 24, 'start'], [px - 8, py - 24, 'end'], [px + 8, py + 32, 'start'], [px - 8, py + 32, 'end'], [px, py + 34, 'middle'], [px + 24, py + 18, 'start'], [px - 24, py + 18, 'end']]);
          place(text, spots, o.f || INK, 12);
        }
        return dot(px, py, 5.5, o.hollow ? '#fff' : (o.f || INK), o.f || INK);
      },
      svg: function (body, label) {
        var marks = '', i;
        function tick(x, y, text, size, a) {
          var b = boxOf(x, y, text, size, a);
          if (!free(b)) return;
          taken.push(b); marks += T(x, y, text, { a: a, size: size > 10 ? size : 10, f: MUTE, w: 400 });
        }
        tick(left + w - 6, Y(0) - 6, 'x', 11, 'middle'); tick(X(0) + 8, top + 8, 'y', 11, 'middle');
        for (i = Math.ceil(x0 / every) * every; i < x1; i += every) if (i) tick(X(i), Y(0) + 13, show(i), 10, 'middle');
        for (i = Math.ceil(y0 / every) * every; i < y1; i += every) if (i) tick(X(0) - 5, Y(i) + 3.5, show(i), 10, 'end');
        return wrap(H, grid + marks + body + names, label);
      }
    };
    return g;
  }
  function pt(x, y) { return '(' + show(x) + ', ' + show(y) + ')'; }
  function twoPoints(a, c, kind, done) {
    var g = plane([a[0], c[0]], [a[1], c[1]]), b = '';
    var firstLow = a[1] <= c[1];
    if (kind === 'slope') b += g.line(c[1] - a[1], a[0] - c[0], (c[1] - a[1]) * a[0] + (a[0] - c[0]) * a[1]);
    else b += L(g.X(a[0]), g.Y(a[1]), g.X(c[0]), g.Y(c[1]), { c: BLUE, w: 2.6 });
    g.reserve(a[0], a[1]); g.reserve(c[0], c[1]);
    if (done && kind !== 'midpoint') {
      b += L(g.X(a[0]), g.Y(a[1]), g.X(c[0]), g.Y(a[1]), { dash: '5 4' }) + L(g.X(c[0]), g.Y(a[1]), g.X(c[0]), g.Y(c[1]), { dash: '5 4' });
      var mx = (g.X(a[0]) + g.X(c[0])) / 2, ry = g.Y(a[1]), my = (g.Y(a[1]) + g.Y(c[1])) / 2, vx = g.X(c[0]), under = c[1] >= a[1];
      g.place((kind === 'slope' ? 'run ' : '') + show(Math.abs(c[0] - a[0])), [[mx, ry + (under ? 15 : -6), 'middle'], [mx, ry + (under ? -6 : 15), 'middle'], [mx - 30, ry + (under ? 15 : -6), 'middle'], [mx + 30, ry + (under ? 15 : -6), 'middle'], [mx, ry + (under ? 30 : -20), 'middle'], [mx, ry + (under ? 44 : -34), 'middle']], BLUE, 12);
      g.place((kind === 'slope' ? 'rise ' : '') + show(c[1] - a[1]), [[vx + 6, my + 4, 'start'], [vx - 6, my + 4, 'end'], [vx + 6, my + 22, 'start'], [vx - 6, my - 16, 'end']], BLUE, 12);
    }
    b += g.point(a[0], a[1], pt(a[0], a[1]), { below: firstLow }) + g.point(c[0], c[1], pt(c[0], c[1]), { below: !firstLow });
    if (done && kind === 'midpoint') b += g.point((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, pt((a[0] + c[0]) / 2, (a[1] + c[1]) / 2), { f: BLUE });
    if (done && kind === 'distance') {
      var hx = (g.X(a[0]) + g.X(c[0])) / 2, hy = (g.Y(a[1]) + g.Y(c[1])) / 2;
      g.place(show(Math.sqrt(Math.pow(c[0] - a[0], 2) + Math.pow(c[1] - a[1], 2))), [[hx - 8, hy - 8, 'end'], [hx + 8, hy + 16, 'start'], [hx - 8, hy - 24, 'end']], BLUE, 15);
    }
    return g.svg(b, 'Two points on a grid');
  }
  /* "2x + 3y = 12", "y = -x + 4" -> {a, b, c} for a x + b y = c */
  function linear(eq) {
    var t = String(eq).replace(/[−–]/g, '-').replace(/\s+/g, ''), sides = t.split('=');
    if (sides.length !== 2) return null;
    var out = { a: 0, b: 0, c: 0 };
    for (var s = 0; s < 2; s++) {
      var terms = sides[s].match(/[+-]?[^+-]+/g);
      if (!terms) return null;
      for (var i = 0; i < terms.length; i++) {
        var m = /^([+-]?)(\d*\.?\d*)([xy]?)$/.exec(terms[i]);
        if (!m || (!m[2] && !m[3])) return null;
        var v = (m[1] === '-' ? -1 : 1) * (m[2] ? parseFloat(m[2]) : 1);
        if (m[3] === 'x') out.a += s ? -v : v; else if (m[3] === 'y') out.b += s ? -v : v; else out.c += s ? v : -v;
      }
    }
    return out.a || out.b ? out : null;
  }
  function lineGraph(l, marks) {
    var m = -l.a / l.b, b0 = l.c / l.b, xs = [], ys = [];
    marks.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    xs.push(1); ys.push(b0, m + b0);
    var g = plane(xs, ys), b = g.line(l.a, l.b, l.c);
    marks.forEach(function (p) { b += g.point(p[0], p[1], pt(p[0], p[1]), { f: INK }); });
    return g.svg(b, 'Graph of the line');
  }
  function system(parts) {
    var p = linear(parts[0]), q = linear(parts[1]);
    if (!p || !q) return '';
    var det = p.a * q.b - q.a * p.b;
    if (!det) return '';
    var x = (p.c * q.b - q.c * p.b) / det, y = (p.a * q.c - q.a * p.c) / det;
    if (Math.abs(x) > 30 || Math.abs(y) > 30) return '';
    var g = plane([x - 2, x + 2], [y - 2, y + 2]);
    return g.svg(g.line(p.a, p.b, p.c, BLUE) + g.line(q.a, q.b, q.c, INK) + g.point(x, y, pt(x, y), { f: INK }), 'The two lines cross at ' + pt(x, y));
  }

  /* ---- number line ---- */
  function inequality(op, n) {
    var step = Math.abs(n) > 40 ? 5 : 1, lo = n - 4 * step, X = function (v) { return 28 + (v - lo) / (8 * step) * 284; };
    var more = op.indexOf('>') > -1 || op.indexOf('≥') > -1, closed = /[≤≥=]/.test(op), y = 44, i;
    var b = L(14, y, 326, y, { w: 1.4 });
    for (i = 0; i <= 8; i++) b += L(X(lo + i * step), y - 5, X(lo + i * step), y + 5, { w: 1.2 }) + T(X(lo + i * step), y + 23, show(lo + i * step), { size: 11.5, w: 400 });
    var end = more ? 322 : 18;
    b += L(X(n), y, end, y, { c: BLUE, w: 5 }) + P([[end + (more ? 10 : -10), y], [end - (more ? 2 : -2), y - 8], [end - (more ? 2 : -2), y + 8]], { fill: BLUE, c: BLUE });
    b += dot(X(n), y, 7.5, closed ? BLUE : '#fff', BLUE);
    b += T(X(n), 22, 'x ' + op + ' ' + show(n), { f: BLUE, w: 700 });
    return wrap(76, b, 'Number line showing x ' + op + ' ' + n);
  }

  /* ---- bars: fractions, percents, ratios ---- */
  function bar(x, y, w, parts, filled, o) {
    o = o || {};
    var b = R(x, y, w, 26, { fill: '#fff', w: 0 });
    if (filled > 0) b += R(x, y, w * Math.min(filled, parts) / parts, 26, { fill: o.fill || MID, w: 0 });
    for (var i = 1; i < parts; i++) b += L(x + w * i / parts, y, x + w * i / parts, y + 26, { w: parts > 24 ? 0.7 : 1.1 });
    return b + R(x, y, w, 26, {});
  }
  function fractionRows(rows) {
    var b = '', y = 10;
    rows.forEach(function (row) {
      var wholes = Math.max(1, Math.ceil(row.n / row.d - 1e-9)), w = (250 - (wholes - 1) * 6) / wholes, i;
      b += (row.asked ? Q : T)(62, y + 18, row.label, { a: 'end' });
      for (i = 0; i < wholes; i++) b += bar(72 + i * (w + 6), y, w, row.d, Math.max(0, Math.min(row.d, row.n - i * row.d)), { fill: row.asked ? BLUE : MID });
      y += 40;
    });
    return wrap(y, b, 'Fraction bars');
  }
  function fractions(text, done, answer) {
    var m = /^(\d+)\/(\d+)\s*([+−×÷-])\s*(\d+)\/(\d+)$/.exec(text), rows = [], a = /^(\d+)(?:\/(\d+))?$/.exec(String(answer || ''));
    var one = /^(\d+)\/(\d+)$/.exec(text);
    if (m) rows = [{ n: +m[1], d: +m[2], label: m[1] + '/' + m[2] }, { n: +m[4], d: +m[5], label: m[4] + '/' + m[5] }];
    else if (one) rows = [{ n: +one[1], d: +one[2], label: text }];
    else return '';
    if (done && a && +a[1] / +(a[2] || 1) <= 3) rows.push({ n: +a[1], d: +(a[2] || 1), label: answer, asked: true });
    if (rows.some(function (r0) { return r0.d > 72 || r0.n / r0.d > 3; })) return '';
    return fractionRows(rows);
  }
  function fractionOf(n, d, total, done) {
    var x = 20, y = 30, w = 300, b = bar(x, y, w, d, done ? n : 0);
    b += T(W / 2, 20, total + ' altogether') + T(W / 2, 76, d + ' equal parts, take ' + n);
    if (done) b += Q(x + w * n / d / 2, y + 19, show(total / d * n));
    return wrap(86, b, 'A bar of ' + total + ' in ' + d + ' equal parts');
  }
  function percent(shade, o) {
    var x = 20, y = 30, w = 300, b = R(x, y, w, 30, { fill: '#fff' }) + R(x, y, w * shade, 30, { fill: MID });
    var mid = Math.max(x + 22, x + w * shade / 2);
    b += (o.topAsked ? Q : T)(mid, 20, o.top);
    b += T(mid, y + 50, o.under);
    b += (o.endAsked ? Q : T)(x + w, y + 50, o.end, { a: 'end' });
    if (shade * w > 70 && o.start) b += T(x, y + 50, o.start, { a: 'start', w: 400, f: MUTE });
    return wrap(90, b, 'A bar with a part shaded');
  }
  function twoBars(a, c, labels) {
    var big = Math.max(a, c), b = '';
    [[a, labels[0]], [c, labels[1]]].forEach(function (row, i) {
      var y = 14 + i * 44;
      b += T(62, y + 18, row[1], { a: 'end', w: 400 }) + R(72, y, 220 * row[0] / big, 26, { fill: i ? MID : TINT }) + T(72 + 220 * row[0] / big + 7, y + 18, show(row[0]), { a: 'start' });
    });
    return wrap(100, b, 'Two bars to compare');
  }
  function share(total, a, c, done) {
    var x = 20, y = 30, w = 300, n = a + c, one = total / n, b = bar(x, y, w, n, a);
    b += R(x + w * a / n, y, w * c / n, 26, { fill: TINT });
    for (var i = a + 1; i < n; i++) b += L(x + w * i / n, y, x + w * i / n, y + 26, { w: 1.1 });
    b += T(W / 2, 20, total + ' altogether');
    var xa = Math.max(x, x + w * a / n / 2), xc = x + w * a / n + w * c / n / 2;
    b += T(a / n < 0.25 ? x : xa, y + 46, a + (a === 1 ? ' part' : ' parts') + (done ? ' = ' + show(a * one) : ''), { a: a / n < 0.25 ? 'start' : 'middle' });
    b += T(c / n < 0.25 ? x + w : xc, y + 46, c + (c === 1 ? ' part' : ' parts') + (done ? ' = ' + show(c * one) : ''), { a: c / n < 0.25 ? 'end' : 'middle' });
    return wrap(86, b, 'A bar split in the ratio ' + a + ' to ' + c);
  }
  function mapRoad(k, c, done) {
    var x = 20, w = 300, one = w / c, y = 52, b = R(8, 6, 324, 92, { fill: '#f1f5fe', c: GRID, rx: 12 });
    b += T(x, 30, 'Map scale: 1 cm = ' + k + ' km', { a: 'start' });
    b += L(x, y, x + w, y, { c: BLUE, w: 6 }) + dot(x, y, 6, '#fff', INK) + dot(x + w, y, 6, '#fff', INK);
    for (var i = 0; i <= c; i++) b += L(x + i * one, y + 11, x + i * one, y + 18);
    b += L(x, y + 14.5, x + w, y + 14.5, { w: 1.2 });
    b += (done ? Q : T)(W / 2, y + 38, c + ' cm on the map' + (done ? ' = ' + (k * c) + ' km' : ''), { size: 13 });
    return wrap(104, b, 'A road ' + c + ' centimetres long on a map');
  }
  var COUNTER = { red: '#d9534f', blue: '#4a7cf6', green: '#2e9e6b', yellow: '#f2c94c', black: '#1a1d2e', white: '#ffffff' };
  function counters(a, an, c, cn, what) {
    var all = [], i;
    for (i = 0; i < a; i++) all.push(an);
    for (i = 0; i < c; i++) all.push(cn);
    var per = Math.min(8, all.length), x0 = (W - (per - 1) * 36) / 2, b = '';
    all.forEach(function (name, k) { b += dot(x0 + (k % per) * 36, 22 + Math.floor(k / per) * 36, 13, COUNTER[name] || MID, INK); });
    var h = 22 + Math.floor((all.length - 1) / per) * 36 + 26;
    b += dot(96, h + 8, 6, COUNTER[an] || MID, INK) + T(108, h + 13, a + ' ' + an, { a: 'start' }) + dot(200, h + 8, 6, COUNTER[cn] || MID, INK) + T(212, h + 13, c + ' ' + cn, { a: 'start' });
    return wrap(h + 24, b, a + ' ' + an + ' and ' + c + ' ' + cn + ' ' + what);
  }
  function classDots(total, n, d, done) {
    var per = total > 40 ? 12 : 10, gap = 300 / per, b = '', chosen = total / d * n, i;
    for (i = 0; i < total; i++) b += dot(20 + gap / 2 + (i % per) * gap, 16 + Math.floor(i / per) * 22, 7.5, done && i < chosen ? BLUE : TINT, INK);
    var h = 16 + Math.floor((total - 1) / per) * 22 + 34;
    b += (done ? Q : T)(W / 2, h - 4, done ? chosen + ' of ' + total + ' students' : total + ' students');
    return wrap(h + 6, b, total + ' students');
  }
  function road(a, c, o) {
    var x = 20, w = 300, mid = x + w * Math.max(0.35, Math.min(0.65, o.split)), y = 46;
    var b = L(x, y, mid, y, { c: BLUE, w: 7 }) + L(mid, y, x + w, y, { c: MID, w: 7 }) + dot(x, y, 6, '#fff', INK) + dot(mid, y, 5, '#fff', INK) + dot(x + w, y, 6, '#fff', INK);
    b += T((x + mid) / 2, y - 16, a[0]) + T((x + mid) / 2, y + 26, a[1], { w: 400 }) + T((mid + x + w) / 2, y - 16, c[0]) + T((mid + x + w) / 2, y + 26, c[1], { w: 400 });
    if (o.done) b += Q(W / 2, y + 52, o.done);
    return wrap(o.done ? 108 : 82, b, 'A journey in two parts');
  }
  function ribbon(m, cm, done) {
    var x = 20, w = 300, n = m * 100 / cm, b = R(x, 34, w, 24, { fill: TINT, rx: 3 }), i;
    var shown = done ? n : 1;
    for (i = 1; i <= shown && i < n; i++) b += L(x + w * i / n, 30, x + w * i / n, 62, { c: BLUE, dash: '4 3' });
    b += T(W / 2, 20, 'ribbon: ' + m + ' m') + T(x, 80, 'each piece: ' + cm + ' cm', { a: 'start' });
    if (done) b += Q(x + w, 80, n + ' pieces', { a: 'end' });
    return wrap(90, b, 'A ribbon ' + m + ' metres long');
  }
  function park(p, done) {
    var s = 120, x = (W - s) / 2, y = 30, b = R(x, y, s, s, { fill: TINT, w: 2 });
    b += T(W / 2, 18, 'all the way round: ' + p + ' m') + Q(x + s + 12, y + s / 2 + 5, done ? show(p / 4) + ' m' : '? m', { a: 'start' });
    b += Q(W / 2, y + s / 2 + 5, done ? show(p / 4 * (p / 4)) + ' m²' : 'area ?');
    return wrap(y + s + 12, b, 'A square park');
  }

  /* ---- which drawing, if any ----
     The words may be the app's own or a model's. A drawing is shown only when
     the sum it stands for comes to the question's answer key: "Rectangle:
     length 9, width 4" with the answer 36 or 26 is drawn, the same words asking
     for the diagonal are not. No key, no drawing. */
  var N = '(\\d+(?:\\.\\d+)?)(?!\\.?\\d)';          // a whole number as written, never the front of one
  var S = '(-?\\d+(?:\\.\\d+)?)(?!\\.?\\d)';
  var UNIT = '(?:\\s*(cm|mm|km|m|in|ft)\\b)?';
  function re(src, flags) { return new RegExp(src.replace(/\{N\}/g, N).replace(/\{S\}/g, S).replace(/\{U\}/g, UNIT), flags); }
  /* The one number in an answer: "18 cm^2" -> 18, "5/6" -> 0.833, "49π" -> 49. */
  function value(ans) {
    var t = String(ans).replace(/[−–]/g, '-').replace(/\^\s*\d|[²³]/g, '').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/π|\bpi\b/gi, '');
    var all = t.match(/-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+)?/g);
    if (!all || all.length !== 1) return NaN;
    var p = all[0].split('/');
    return p.length === 2 ? p[0] / p[1] : parseFloat(p[0]);
  }
  function near(a, b, slack) { return Math.abs(a - b) <= (slack || 1e-6); }
  function pair(ans) {
    var m = /(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/.exec(String(ans).replace(/[−–]/g, '-'));
    return m ? [+m[1], +m[2]] : null;
  }

  function figure(text, o) {
    o = o || {};
    var raw = String(text || '').trim(), t = raw.replace(/[−–]/g, '-'), done = !!o.done, ans = String(o.answer == null ? '' : o.answer).trim(), head = String(o.head || '').replace(/[−–]/g, '-');
    if (!ans || t.length > 400) return '';
    var m, unit, a, b, c, want, got = value(ans), shown = ans.replace(/-/g, '−');
    function is(v, slack) { return near(got, v, slack); }
    function bare(v) { return shown.replace(/\s*(?:cm|mm|km|m|in|ft)(?:\^?[23]|[²³])?$/, ''); }

    if ((m = re('^Rectangle: length {N}{U}, width {N}{U}').exec(t))) {
      a = +m[1]; b = +m[3]; unit = m[4] || m[2] || 'cm';
      var per = /perimeter/i.test(head);
      if (!(a > 0 && b > 0) || !(per ? is(2 * (a + b)) : /area/i.test(head) && is(a * b))) return '';
      var whole = a === Math.floor(a) && b === Math.floor(b) && a <= 20 && b <= 20;
      return rectangle(a, b, unit, { outline: per && done, squares: !per && done && whole, middle: done ? (per ? show(2 * (a + b)) + ' ' + unit : show(a * b) + ' ' + unit + '²') : '' });
    }
    if ((m = re('^Triangle: base {N}{U}, height {N}{U}').exec(t))) {
      a = +m[1]; b = +m[3]; unit = m[2] || m[4] || 'cm';
      if (unit !== 'cm' || !(a > 0 && b > 0) || !is(a * b / 2)) return '';
      return triangleArea(a, b, { done: done ? show(a * b / 2) + ' cm²' : '' });
    }
    if ((m = re('^Circle: radius {N}{U}').exec(t))) {
      a = +m[1];
      var area = /area/i.test(head);
      if ((m[2] && m[2] !== 'cm') || !(a > 0) || !/π|pi/i.test(ans) || !(area ? is(a * a) : /circumference|perimeter|around/i.test(head) && is(2 * a))) return '';
      return circle(a, area ? 'area' : 'round', { done: done ? show(got) + 'π' + (area ? ' cm²' : ' cm') : '' });
    }
    if ((m = re('^Right triangle: legs {N}{U} and {N}{U}').exec(t))) {
      a = +m[1]; b = +m[3]; want = Math.sqrt(a * a + b * b);
      if (!(a > 0 && b > 0) || !is(want, 0.05)) return '';
      return rightTriangle(a, b, [{ t: m[1] }, { t: m[3] }, { t: done ? bare() : '?', asked: true }], {});
    }
    if ((m = re('^Right triangle: hypotenuse {N}{U}, (?:and )?one leg {N}{U}').exec(t))) {
      c = +m[1]; a = +m[3]; want = Math.sqrt(c * c - a * a);
      if (!(want > 0) || !is(want, 0.05)) return '';
      return rightTriangle(a, want, [{ t: m[3] }, { t: done ? bare() : '?', asked: true }, { t: m[1] }], {});
    }
    if ((m = re('^Box: length {N}{U}, width {N}{U}, height {N}{U}').exec(t))) {
      a = +m[1]; b = +m[3]; c = +m[5];
      if ((m[2] && m[2] !== 'cm') || !(a > 0 && b > 0 && c > 0) || !is(a * b * c)) return '';
      return box(a, b, c, { done: done ? show(a * b * c) + ' cm³' : '' });
    }
    if ((m = re('^A triangle has angles {N}° and {N}°').exec(t))) {
      a = +m[1]; b = +m[2];
      return a > 0 && b > 0 && a + b < 180 && is(180 - a - b) ? triangleAngles(a, b, { done: done }) : '';
    }
    if ((m = re('^An angle measures {N}°\\. (?:What is )?[Ii]ts (complement|supplement)').exec(t))) {
      a = +m[1]; c = m[2] === 'complement' ? 90 : 180;
      return a > 0 && a < c && is(c - a) ? angleSplit(a, c, { done: done }) : '';
    }
    if ((m = re('has {N} sides\\. What do its (?:interior )?angles add up to').exec(t))) {
      a = +m[1];
      return a >= 3 && a <= 12 && a === Math.floor(a) && is((a - 2) * 180) ? polygon(a, { done: done }) : '';
    }

    if ((m = re('^\\({S}, {S}\\) and \\({S}, {S}\\)$').exec(t))) {
      var p1 = [+m[1], +m[2]], p2 = [+m[3], +m[4]];
      if ((p1[0] === p2[0] && p1[1] === p2[1]) || [p1[0], p1[1], p2[0], p2[1]].some(function (v) { return Math.abs(v) > 60; })) return '';
      if (/midpoint/i.test(head)) {
        var mp = pair(ans);
        return mp && near(mp[0], (p1[0] + p2[0]) / 2) && near(mp[1], (p1[1] + p2[1]) / 2) ? twoPoints(p1, p2, 'midpoint', done) : '';
      }
      if (/distance|how far|length/i.test(head)) return is(Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)), 0.05) ? twoPoints(p1, p2, 'distance', done) : '';
      if (/slope|gradient/i.test(head)) return p1[0] !== p2[0] && is((p2[1] - p1[1]) / (p2[0] - p1[0]), 0.005) ? twoPoints(p1, p2, 'slope', done) : '';
      return '';
    }
    if (/slope|intercept|find [xy] when/i.test(head) && /^y\s*=/.test(t)) {
      var ln = linear(t);                       // reading the line off a grid IS the answer: after only
      if (!done || !ln || !ln.b) return '';
      var slope = -ln.a / ln.b, cut = ln.c / ln.b, marks, w;
      if ((w = /when x = (-?\d+(?:\.\d+)?)/i.exec(head))) { marks = [[+w[1], slope * w[1] + cut]]; if (!is(marks[0][1])) return ''; }
      else if ((w = /when y = (-?\d+(?:\.\d+)?)/i.exec(head))) { if (!slope) return ''; marks = [[(w[1] - cut) / slope, +w[1]]]; if (!is(marks[0][0])) return ''; }
      else if (/intercept/i.test(head)) { marks = [[0, cut]]; if (!is(cut)) return ''; }
      else { marks = [[0, cut]]; if (!is(slope)) return ''; }
      if (marks.some(function (p) { return Math.abs(p[0]) > 40 || Math.abs(p[1]) > 60; }) || Math.abs(cut) > 60) return '';
      return lineGraph(ln, marks);
    }
    if (/inequality/i.test(head)) {
      m = /^x\s*(<=|>=|≤|≥|<|>)\s*(-?\d+(?:\.\d+)?)$/.exec(ans.replace(/[−–]/g, '-'));
      return done && m && Math.abs(+m[2]) < 1000 ? inequality(m[1].replace('<=', '≤').replace('>=', '≥'), +m[2]) : '';
    }
    if (/solve the system|^system$/i.test(head)) {
      var parts = t.split(/\s*;\s*/);
      if (!done || parts.length !== 2) return '';
      var e1 = linear(parts[0]), e2 = linear(parts[1]), ax = /x\s*=\s*(-?\d+(?:\.\d+)?)/.exec(ans.replace(/[−–]/g, '-')), ay = /y\s*=\s*(-?\d+(?:\.\d+)?)/.exec(ans.replace(/[−–]/g, '-'));
      if (!e1 || !e2 || !ax || !ay || !near(e1.a * ax[1] + e1.b * ay[1], e1.c) || !near(e2.a * ax[1] + e2.b * ay[1], e2.c)) return '';
      return system(parts);
    }

    if ((m = /^(\d+)\/(\d+)\s*([+×÷-])\s*(\d+)\/(\d+)$/.exec(t)) || (m = /^(\d+)\/(\d+)$/.exec(t))) {
      if (!/fraction|simplify|add|subtract|multiply|divide|evaluate/i.test(head)) return '';
      var f1 = m[1] / m[2], f2 = m.length > 3 ? m[4] / m[5] : null;
      want = f2 === null ? f1 : m[3] === '+' ? f1 + f2 : m[3] === '-' ? f1 - f2 : m[3] === '×' ? f1 * f2 : f1 / f2;
      return is(want) ? fractions(raw.replace(/ - /g, ' − '), done, ans) : '';
    }
    if ((m = /^(\d+)\/(\d+) of (\d+)$/.exec(t))) {
      a = +m[1]; b = +m[2]; c = +m[3];
      return b > 0 && b <= 24 && a <= b && is(c * a / b) ? fractionOf(a, b, c, done) : '';
    }
    if ((m = re('^{N}% of {N}\\??$').exec(t))) {
      a = +m[1]; b = +m[2];
      return a > 0 && a <= 100 && is(b * a / 100) ? percent(a / 100, { top: done ? bare() : '?', topAsked: true, under: m[1] + '%', end: m[2], start: '0' }) : '';
    }
    if ((m = re('^What percent is {N} of {N}\\?$').exec(t))) {
      a = +m[1]; b = +m[2];
      return a > 0 && a <= b && is(a / b * 100, 0.05) ? percent(a / b, { top: m[1], under: done ? show(got) + '%' : '?%', end: m[2], start: '0' }) : '';
    }
    if ((m = re('^{N} is {N}% of what number\\?$').exec(t))) {
      a = +m[1]; b = +m[2];
      return b > 0 && b <= 100 && is(a * 100 / b) ? percent(b / 100, { top: m[1], under: m[2] + '%', end: done ? bare() : '?', endAsked: true, start: '0' }) : '';
    }
    if ((m = re('^(Increase|Decrease) {N} by {N}%$').exec(t))) {
      var up = m[1] === 'Increase', n0 = +m[2], p = +m[3], d0 = n0 * p / 100, now = up ? n0 + d0 : n0 - d0;
      if (!(n0 > 0) || !(p > 0) || p > (up ? 200 : 100) || !is(now)) return '';
      var big = up ? now : n0, x = 20, wd = 300, keep = wd * (up ? n0 : now) / big;
      var s = R(x, 30, keep, 30, { fill: MID }) + R(x + keep, 30, wd - keep, 30, { fill: up ? TINT : '#fff', dash: '5 4' });
      s += T(x + keep / 2, 20, String(n0)) + T(x + wd, 80, (up ? '+' : '−') + m[3] + '%', { a: 'end' }) + Q(x, 80, (up ? 'new total: ' : 'what is left: ') + (done ? bare() : '?'), { a: 'start', size: 13 });
      return wrap(90, s, m[1] + ' ' + n0 + ' by ' + p + ' percent');
    }
    if ((m = re('^From {N} to {N}$').exec(t))) {
      a = +m[1]; b = +m[2];
      return a > 0 && b > 0 && /percent/i.test(head) && is(Math.abs(b - a) / a * 100, 0.05) ? twoBars(a, b, ['before', 'after']) : '';
    }
    if ((m = /^Share (\d+) in the ratio (\d+) : (\d+)\.?$/.exec(t))) {
      c = +m[1]; a = +m[2]; b = +m[3];
      return a > 0 && b > 0 && a + b <= 30 && is(Math.max(a, b) * c / (a + b)) ? share(c, a, b, done) : '';
    }
    if ((m = /^Map scale: 1 cm = (\d+) km\. A road is (\d+) cm/.exec(t))) return +m[2] > 0 && +m[2] <= 20 && is(m[1] * m[2]) ? mapRoad(+m[1], +m[2], done) : '';
    if ((m = /^There are (\d+) (\w+) and (\d+) (\w+) (.+?)\. One is picked/.exec(t))) {
      a = +m[1]; b = +m[3];
      return a + b > 0 && a + b <= 40 && (is(a / (a + b)) || is(b / (a + b))) ? counters(a, m[2], b, m[4], m[5]) : '';
    }

    /* word problems: the picture of what is given is drawn for any question
       about it; one that writes a result on itself needs that result to be the answer. */
    if ((m = re('garden is {N} m long and {N} m wide').exec(t))) return +m[1] > 0 && +m[2] > 0 ? rectangle(+m[1], +m[2], 'm', { fence: /fenc/i.test(t) }) : '';
    if ((m = re('square park has a perimeter of {N} m\\b').exec(t))) return is(m[1] / 4 * (m[1] / 4)) ? park(+m[1], done) : '';
    if ((m = re('car drives at {N} km/h for {N} hours?\\. Then it drives {N} km more').exec(t))) {
      want = m[1] * m[2] + +m[3];
      return is(want) ? road([m[2] + ' hours', 'at ' + m[1] + ' km/h'], [m[3] + ' km', 'more'], { split: m[1] * m[2] / want, done: done ? 'altogether: ' + show(want) + ' km' : '' }) : '';
    }
    if ((m = re('travels {N} km at {N} km/h, then {N} km at {N} km/h').exec(t))) {
      want = m[1] / m[2] + m[3] / m[4];
      return is(want, 0.005) ? road([m[1] + ' km', 'at ' + m[2] + ' km/h'], [m[3] + ' km', 'at ' + m[4] + ' km/h'], { split: +m[1] / (+m[1] + +m[3]), done: done ? 'altogether: ' + show(want) + ' hours' : '' }) : '';
    }
    if ((m = re('ribbon is {N} m long\\. It is cut into pieces that are each {N} cm').exec(t))) {
      want = m[1] * 100 / m[2];
      return want >= 1 && want <= 60 && want === Math.floor(want) && is(want) ? ribbon(+m[1], +m[2], done) : '';
    }
    if ((m = /class of (\d+) students, (\d+)\/(\d+) of them/.exec(t))) {
      want = m[1] * m[2] / m[3];
      return +m[1] <= 96 && want === Math.floor(want) && is(want) ? classDots(+m[1], +m[2], +m[3], done) : '';
    }
    return '';
  }

  window.SFShapes = { figure: figure };
})();

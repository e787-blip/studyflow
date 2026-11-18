/* Paste into the browser console (or javascript_tool) on any page.
   Counts the measurable AI-design tells and prints a verdict.
   Rules are from pixelslop's catalogue and Impeccable's slop list; each
   one is a DEFAULT NOBODY CHOSE, so a hit is a question, not a verdict.
   Bands (pixelslop): 0-1 CLEAN, 2-3 MILD, 4-6 SLOPPY, 7+ TERMINAL. */
(function () {
  var all = [].slice.call(document.querySelectorAll('body *')).filter(function (e) {
    var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('script,style,svg');
  });
  var cs = function (e, p) { return getComputedStyle(e)[p]; };
  var heads = all.filter(function (e) { return /^H[1-4]$/.test(e.tagName); });
  var T = {};

  T.gradientText = all.filter(function (e) {
    var c = getComputedStyle(e); return (c.webkitBackgroundClip === 'text' || c.backgroundClip === 'text') && /gradient/.test(c.backgroundImage);
  }).length;

  var withEm = heads.filter(function (h) {
    return [].some.call(h.querySelectorAll('em,i'), function (x) { return cs(x, 'fontStyle') === 'italic'; });
  }).length;
  T.italicAccentHeadings = withEm;

  T.trackedCapsLabels = all.filter(function (e) {
    if (e.closest('button,a,nav,footer,.site-foot')) return false;
    var c = getComputedStyle(e), fs = parseFloat(c.fontSize), ls = parseFloat(c.letterSpacing) || 0;
    return c.textTransform === 'uppercase' && ls / fs >= 0.06 && fs <= 15 && e.children.length === 0 && e.textContent.trim().length > 2;
  }).length;

  T.heroMetrics = all.filter(function (e) {
    return e.children.length === 0 && /^(?=.*\d)[\d.,+%x\/]{1,14}$/.test(e.textContent.trim()) && parseFloat(cs(e, 'fontSize')) >= 24;
  }).length;

  T.backdropBlurs = all.filter(function (e) { var b = cs(e, 'backdropFilter'); return b && b !== 'none'; }).length;

  T.glowGradients = all.filter(function (e) {
    var r = e.getBoundingClientRect();
    return /radial-gradient/.test(cs(e, 'backgroundImage')) && r.width > 300 && r.height > 200;
  }).length;

  T.infiniteAnimations = all.filter(function (e) {
    return cs(e, 'animationIterationCount').split(',').indexOf('infinite') > -1 && cs(e, 'animationName') !== 'none';
  }).length;

  T.countUpStats = document.querySelectorAll('[data-count]').length;

  T.borderPlusWideShadow = all.filter(function (e) {
    var c = getComputedStyle(e); if (c.boxShadow === 'none' || !(parseFloat(c.borderTopWidth) >= 1)) return false;
    if (c.borderTopStyle === 'none') return false;
    var m = c.boxShadow.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/); return m && parseFloat(m[3]) >= 24;
  }).length;

  T.pillControls = all.filter(function (e) {
    return /^(A|BUTTON)$/.test(e.tagName) && parseFloat(cs(e, 'borderTopLeftRadius')) >= 100;
  }).length;

  T.iconAboveHeading = heads.filter(function (h) {
    var p = h.previousElementSibling; if (!p || p.getBoundingClientRect().width === 0) return false; return p.tagName === 'svg' || /ico|icon|tile/.test(p.className + '');
  }).length;

  T.dotGridTextures = all.filter(function (e) {
    return ['::before', '::after'].some(function (ps) {
      var pc = getComputedStyle(e, ps); if (pc.display === 'none') return false; var b = pc.backgroundImage; return /radial-gradient\(circle/.test(b) && /px/.test(getComputedStyle(e, ps).backgroundSize);
    });
  }).length;

  T.sameRevealEverywhere = document.querySelectorAll('[data-reveal]').length;

  // Thresholds: a count at or over the line is a tripped rule.
  var LINE = { gradientText: 1, italicAccentHeadings: 4, trackedCapsLabels: 5, heroMetrics: 2, backdropBlurs: 3,
    glowGradients: 2, infiniteAnimations: 2, countUpStats: 1, borderPlusWideShadow: 6, pillControls: 12,
    iconAboveHeading: 3, dotGridTextures: 2, sameRevealEverywhere: 14 };
  var tripped = Object.keys(LINE).filter(function (k) { return T[k] >= LINE[k]; });
  var n = tripped.length;
  return (window.__slop = JSON.stringify({ counts: T, tripped: tripped, tells: n, verdict: n <= 1 ? "CLEAN" : n <= 3 ? "MILD" : n <= 6 ? "SLOPPY" : "TERMINAL" }));
})();

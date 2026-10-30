/* sf-smooth.js - smooth wheel scrolling for the marketing pages.

   Loaded by index.html, about.html and pricing.html with a plain
   <script src="sf-smooth.js"></script> before the page's own script.

   WHAT IT DOES. A mouse wheel moves the page in 100px jumps, about one per
   notch, and the browser animates each jump on its own little curve. Between
   two notches the page stops, so a long scroll is a row of separate shoves:
   that is the "60Hz" feeling the premium sites do not have. Here every wheel
   delta moves a TARGET, and once per display frame the page moves a fixed
   share of the way there (exponential smoothing, the same thing Lenis does).
   The page never stops between notches and never jumps, so each frame is a
   small step on one continuous curve.

   It cannot show more frames than the screen has. What it removes is the
   stepping, which is what made 60Hz look like 60Hz. On a 120Hz display it
   runs at 120: the smoothing is frame-rate independent (dt-normalised), so
   the feel is identical on every refresh rate, only finer.

   A JS-driven scroll is only as smooth as the main thread: native scrolling
   keeps going on the compositor while the page is busy, this does not. So the
   page's own per-frame work is kept small, one-off costs (shader compiles,
   texture uploads) are paid up front, and a late frame is carried on from, not
   caught up (see DT cap below).

   WHAT IT DOES NOT TOUCH, deliberately:
   - Touch. A finger already scrolls with the system's own physics, which
     nothing written in a page can improve. On a touch-only device the
     engine never turns on, and scrollTo() falls back to the browser's.
   - The keyboard and the scrollbar. Both stay native; the engine just
     re-reads the position afterwards.
   - Anything inside its own scroller (a list, a code box, a horizontal row).
     A wheel over a box that can still scroll that way scrolls the box.
   - Pinch zoom (ctrlKey wheels) and sideways wheels.
   - prefers-reduced-motion: the engine is off, honoured live.

   It scrolls the real document, so position: sticky, IntersectionObserver,
   anchors and the scrollbar all keep working - unlike libraries that fake
   scrolling with a transform on a wrapper.

   API (window.SFSmooth):
     active               true while wheel smoothing is on
     scrollTo(t, opts)    t = a y, an element, '#id' or '#'. opts.offset,
                          opts.duration (s), opts.immediate. Native fallback
                          when inactive.
     glideTo(y)           move the target, keep the same smoothing (for snaps)
     on(fn)               fn(y, velocity px/ms, now) after every frame the
                          engine writes, in the SAME frame, so scroll-linked
                          animation is never a frame behind the page
     onSettle(fn)         fn(y) when a wheel-driven scroll comes to rest
     velocity()           px per ms, signed
*/
(function () {
  'use strict';
  if (window.SFSmooth) return;

  var LERP = 0.1;          /* share of the remaining distance per 60fps frame */
  var LINE = 40;           /* px per line for deltaMode 1 (Firefox's mouse wheel) */
  var root = document.scrollingElement || document.documentElement;

  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  /* A device that can hover with a fine pointer has a wheel or a trackpad. A
     touch laptop counts: its wheel is smoothed and its touch stays native. */
  var WHEEL = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

  var active = false;
  var current = 0, target = 0, written = -1, vel = 0;
  var raf = null, last = 0;
  var anim = null;           /* a timed scrollTo: { from, to, start, dur } */
  var fromWheel = false;     /* the running motion began with the wheel */
  var frameFns = [], settleFns = [];

  function maxY() { return Math.max(0, root.scrollHeight - window.innerHeight); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function nowY() { return window.pageYOffset || root.scrollTop || 0; }
  var dpr = window.devicePixelRatio || 1;
  function snap(v) { return Math.round(v * dpr) / dpr; }
  /* easeOutExpo, normalised so it reaches exactly 1: the plain form ends at
     0.999, a visible 5px hop at the end of a long anchor glide. */
  function easeOut(t) { return t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10)); }

  function sync() { current = target = nowY(); vel = 0; }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null; last = 0; anim = null; fromWheel = false;
    sync();
  }

  function emit(now) {
    for (var i = 0; i < frameFns.length; i++) {
      try { frameFns[i](current, vel, now); } catch (e) { /* one listener must not stop the scroll */ }
    }
  }

  function frame(now) {
    raf = null;
    /* A frame that arrives late (the page was busy, a tab woke up) is treated
       as at most two frames long. At the old 64ms cap, the first frame after
       a 130ms stall covered four frames of distance in one go: the page froze,
       then lurched. Capped here it simply carries on, a touch behind. */
    var dt = last ? Math.min(34, now - last) : 16.667;
    last = now;
    var prev = current, done = false;
    if (anim) {
      var t = clamp((now - anim.start) / anim.dur, 0, 1);
      current = anim.from + (anim.to - anim.from) * easeOut(t);
      target = current;
      if (t >= 1) { current = target = anim.to; anim = null; done = true; }
    } else {
      target = clamp(target, 0, maxY());
      current += (target - current) * (1 - Math.pow(1 - LERP, dt / 16.667));
      if (Math.abs(target - current) < 0.25) { current = target; done = true; }
    }
    vel = (current - prev) / dt;
    /* Written on a device pixel: a fractional offset is rounded by the
       browser for the scroller and by layout for position:sticky, not always
       the same way, and a pinned scene then shivers by a pixel as it moves. */
    written = snap(current);
    window.scrollTo(0, written);
    emit(now);
    if (!done) { raf = requestAnimationFrame(frame); return; }
    vel = 0; last = 0;
    if (fromWheel) {
      fromWheel = false;
      for (var i = 0; i < settleFns.length; i++) { try { settleFns[i](current); } catch (e) {} }
    }
  }
  function run() { if (raf === null) raf = requestAnimationFrame(frame); }

  /* Can this element, or one above it, still scroll this way on its own? */
  function nestedCanScroll(el, dy) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.nodeType === 1) {
        if (el.hasAttribute && el.hasAttribute('data-sf-native-scroll')) return true;
        if (el.scrollHeight > el.clientHeight + 1) {
          var oy = window.getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
            if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
          }
        }
      }
      el = el.parentNode;
    }
    return false;
  }
  function locked() {
    var h = window.getComputedStyle(document.documentElement).overflowY;
    var b = window.getComputedStyle(document.body).overflowY;
    return h === 'hidden' || b === 'hidden' || h === 'clip' || b === 'clip';
  }

  function onWheel(e) {
    if (!active || e.defaultPrevented || e.ctrlKey) return;
    var dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= LINE; dy *= LINE; }
    else if (e.deltaMode === 2) { dx *= window.innerHeight; dy *= window.innerHeight; }
    /* A trackpad swipe is never purely vertical: a stray sideways part of
       half the size is normal. Leaving those events to the browser handed
       some wheel events to native scrolling and others to us, and the page
       was moved by two systems at once (the engine saw the native move and
       dropped its glide). Only a clearly sideways gesture is left alone. */
    if (!dy || Math.abs(dx) > Math.abs(dy) * 3) return;
    if (nestedCanScroll(e.target, dy) || locked()) return;
    e.preventDefault();
    if (raf === null && !anim) sync();          /* something native moved it since */
    if (anim) { current = target = nowY(); anim = null; }   /* the wheel takes over a glide */
    target = clamp(target + dy, 0, maxY());
    fromWheel = true;
    run();
  }

  /* Native movement - keyboard, scrollbar, find-in-page, a script - is not
     ours: if the page is somewhere we did not put it, let go and re-read. */
  function onScroll() {
    if (!active) return;
    var y = nowY();
    if (raf === null) { current = target = y; return; }
    if (Math.abs(y - written) > 2) stop();
  }
  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End' || k === ' ') {
      if (raf !== null) stop();
    }
  }
  function onPointer(e) {
    /* a press on the scrollbar, or a finger on a touch laptop */
    if (raf === null) return;
    if (e.pointerType === 'touch' || e.clientX >= document.documentElement.clientWidth) stop();
  }

  function resolve(t, offset) {
    if (typeof t === 'number') return t;
    var el = t;
    if (typeof t === 'string') {
      if (t === '#' || t === '#top') return 0;
      try { el = document.querySelector(t); } catch (e) { el = null; }
      if (!el) { try { el = document.getElementById(decodeURIComponent(t.slice(1))); } catch (e2) { el = null; } }
    }
    if (!el || !el.getBoundingClientRect) return null;
    var cs = window.getComputedStyle(el), rs = window.getComputedStyle(document.documentElement);
    var margin = parseFloat(cs.scrollMarginTop) || 0;
    var pad = parseFloat(rs.scrollPaddingTop) || 0;
    return el.getBoundingClientRect().top + nowY() - margin - pad - (offset || 0);
  }

  function scrollTo(t, opts) {
    opts = opts || {};
    var y = resolve(t, opts.offset);
    if (y === null || isNaN(y)) return;
    y = clamp(y, 0, maxY());
    var reduced = RM && RM.matches;
    if (!active) {
      try { window.scrollTo({ top: y, behavior: (opts.immediate || reduced) ? 'auto' : 'smooth' }); }
      catch (e) { window.scrollTo(0, y); }
      return;
    }
    if (opts.immediate) { stop(); window.scrollTo(0, y); sync(); emit(performance.now()); return; }
    var from = nowY(), dist = Math.abs(y - from);
    if (dist < 1) return;
    /* Longer trips take longer, but never drag: 0.6s for a screen, 1.4s cap. */
    var dur = opts.duration ? opts.duration * 1000 : clamp(600 + dist * 0.12, 600, 1400);
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null; last = 0; fromWheel = false;
    current = from;
    anim = { from: from, to: y, start: performance.now(), dur: dur };
    run();
  }

  function glideTo(y) {
    if (!active) { scrollTo(y); return; }
    if (raf === null && !anim) sync();
    anim = null;
    target = clamp(y, 0, maxY());
    run();
  }

  /* In-page links glide too. Without this the CSS scroll-behavior would, but
     the engine has to switch that off: CSS smooth scrolling also animates
     every window.scrollTo() the engine makes, one frame at a time. */
  function onClick(e) {
    if (!active || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    var el = href === '#' ? null : document.getElementById(decodeURIComponent(href.slice(1)));
    if (href !== '#' && !el) return;
    e.preventDefault();
    scrollTo(href === '#' ? 0 : el);
    if (href !== '#' && history.pushState) { try { history.pushState(null, '', href); } catch (x) {} }
    /* Move focus as a native jump would, so Tab continues from there. */
    var f = href === '#' ? document.body : el;
    if (f !== document.body && !f.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(f.tagName)) f.setAttribute('tabindex', '-1');
    try { f.focus({ preventScroll: true }); } catch (x) {}
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) {
      document.documentElement.style.scrollBehavior = 'auto';
      document.documentElement.classList.add('sf-smooth');
      sync();
    } else {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null; anim = null; last = 0;
      document.documentElement.style.scrollBehavior = '';
      document.documentElement.classList.remove('sf-smooth');
    }
    api.active = on;
  }
  function decide() { setActive(!!(WHEEL && WHEEL.matches) && !(RM && RM.matches)); }

  var api = {
    active: false,
    scrollTo: scrollTo,
    glideTo: glideTo,
    stop: stop,
    on: function (fn) { frameFns.push(fn); },
    onSettle: function (fn) { settleFns.push(fn); },
    velocity: function () { return vel; },
    target: function () { return active && (raf !== null || anim) ? (anim ? anim.to : target) : nowY(); }
  };
  window.SFSmooth = api;

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('touchstart', function () { if (raf !== null) stop(); }, { passive: true });
  document.addEventListener('click', onClick);
  window.addEventListener('resize', function () { dpr = window.devicePixelRatio || 1; target = clamp(target, 0, maxY()); });
  [RM, WHEEL].forEach(function (mq) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', decide); else if (mq.addListener) mq.addListener(decide);
  });
  decide();
})();

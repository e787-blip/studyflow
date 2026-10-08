/* A small slice of Node + Playwright, inside a browser tab, so the morning
   suite's test files run unmodified on a machine with no Node.

   - Pages are same-origin iframes. The server injects one <script> at the top
     of every page's <head> that calls parent.__sfHook(window) BEFORE the
     page's own scripts run: that installs the fetch router (page.route /
     context.route), and reports uncaught errors and console calls.
   - CommonJS require() fetches modules with synchronous XHR from the server,
     which serves the repo at / . Absolute paths under the repo are mapped.
   - page.evaluate(fn, arg) compiles fn's source inside the iframe, so it sees
     the page's globals exactly as Playwright's would.
   Not implemented: screenshots (no-op), emulateMedia (no-op, logged),
   deviceScaleFactor, routes for non-fetch resources other than an abort
   (a script tag can be blocked server-side; nothing else). */
(function () {
  'use strict';
  /* The repo's path on disk, so absolute paths the tests build from
     __dirname map back to URLs. Asked of the server once, synchronously. */
  var REPO_FS = (function () {
    try { var x = new XMLHttpRequest(); x.open('GET', '/__repo', false); x.send(); return JSON.parse(x.responseText).repo; }
    catch (e) { return ''; }
  })();
  var STAGE = function () { return document.getElementById('stage'); };

  function toUrl(p) {
    p = String(p);
    if (p.indexOf(REPO_FS) === 0) p = p.slice(REPO_FS.length);
    if (/^https?:/.test(p)) return p;
    if (p.charAt(0) !== '/') p = '/' + p;
    return p;
  }
  function syncReq(method, url, body) {
    var x = new XMLHttpRequest();
    x.open(method, url, false);
    if (body != null) x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.send(body == null ? null : body);
    return x;
  }

  /* ── path / fs / vm ─────────────────────────────────────────────── */
  function normalise(p) {
    var abs = p.charAt(0) === '/', out = [];
    p.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); });
    return (abs ? '/' : '') + out.join('/');
  }
  var path = {
    sep: '/',
    join: function () { return normalise(Array.prototype.filter.call(arguments, function (a) { return a !== ''; }).join('/')); },
    resolve: function () {
      var r = '';
      for (var i = 0; i < arguments.length; i++) { var a = String(arguments[i]); r = a.charAt(0) === '/' ? a : (r + '/' + a); }
      return normalise(r.charAt(0) === '/' ? r : '/' + r);
    },
    dirname: function (p) { var d = String(p).replace(/\/[^\/]*\/?$/, ''); return d || '/'; },
    basename: function (p, ext) { var b = String(p).replace(/\/$/, '').split('/').pop(); return ext && b.slice(-ext.length) === ext ? b.slice(0, -ext.length) : b; },
    extname: function (p) { var m = /(\.[^.\/]*)$/.exec(String(p)); return m ? m[1] : ''; }
  };
  var fs = {
    readFileSync: function (p, enc) {
      var x = syncReq('GET', toUrl(p) + (toUrl(p).indexOf('?') < 0 ? '?nc=' + Date.now() : ''));
      if (x.status !== 200) { var e = new Error("ENOENT: no such file or directory, open '" + p + "'"); e.code = 'ENOENT'; throw e; }
      return x.responseText;
    },
    existsSync: function (p) { try { return syncReq('HEAD', toUrl(p)).status === 200; } catch (e) { return false; } },
    writeFileSync: function (p, data) { syncReq('POST', '/__write?name=' + encodeURIComponent(path.basename(String(p))), String(data)); },
    mkdirSync: function () {}
  };
  var vm = {
    createContext: function (c) { return c; },
    runInContext: function (code, ctx) { var k = Object.keys(ctx); return Function.apply(null, k.concat([code])).apply(null, k.map(function (n) { return ctx[n]; })); },
    runInNewContext: function (code) { return (0, eval)(code); }
  };

  /* ── Playwright ─────────────────────────────────────────────────── */
  function globRe(g) {
    if (g instanceof RegExp) return g;
    var s = '';
    for (var i = 0; i < g.length; i++) {
      var c = g.charAt(i);
      if (c === '*' && g.charAt(i + 1) === '*') { s += '.*'; i++; if (g.charAt(i + 1) === '/') { s += '/?'; i++; } }
      else if (c === '*') s += '[^/]*';
      else if (c === '?') s += '.';
      else s += c.replace(/[.+^${}()|[\]\\\/]/g, '\\$&');
    }
    return new RegExp('^' + s + '$');
  }
  function matches(pat, url) {
    if (typeof pat === 'function') { try { return !!pat(new URL(url)); } catch (e) { return false; } }
    return globRe(pat).test(url);
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var pages = [];
  window.__sfHook = function (win) {
    var page = null;
    for (var i = 0; i < pages.length; i++) if (pages[i].frame && pages[i].frame.contentWindow === win) page = pages[i];
    if (!page) return;
    page._hooked = true;
    win.addEventListener('error', function (e) {
      if (e && e.message) page._emit('pageerror', { message: e.message, stack: e.error && e.error.stack, toString: function () { return e.message; } });
    });
    win.addEventListener('unhandledrejection', function (e) {
      var m = e.reason && e.reason.message ? e.reason.message : String(e.reason);
      page._emit('pageerror', { message: m, toString: function () { return m; } });
    });
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (t) {
      var orig = win.console[t];
      win.console[t] = function () {
        var args = Array.prototype.slice.call(arguments);
        var text = args.map(function (a) { try { return typeof a === 'string' ? a : (a instanceof win.Error ? a.message : JSON.stringify(a)); } catch (e) { return String(a); } }).join(' ');
        page._emit('console', { type: function () { return t === 'warn' ? 'warning' : t; }, text: function () { return text; } });
        return orig.apply(win.console, arguments);
      };
    });
    /* emulateMedia: JS reads of prefers-reduced-motion / prefers-color-scheme
       answer from page._media (CSS @media rules cannot be emulated here). */
    var origMM = win.matchMedia ? win.matchMedia.bind(win) : null;
    if (origMM) win.matchMedia = function (q) {
      var m = page._media || {}, r = origMM(q), forced = null;
      if (m.reducedMotion && /prefers-reduced-motion/.test(q)) forced = /reduce/.test(q) ? m.reducedMotion === 'reduce' : m.reducedMotion !== 'reduce';
      if (m.colorScheme && /prefers-color-scheme/.test(q)) forced = q.indexOf(m.colorScheme) >= 0;
      if (forced === null) return r;
      return { matches: forced, media: q, onchange: null, addListener: function () {}, removeListener: function () {},
               addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
    };
    var origFetch = win.fetch;
    win.fetch = function (input, init) {
      init = init || {};
      var url = new URL(typeof input === 'string' ? input : input.url, win.location.href).href;
      var routes = page.routes.concat(page.ctx.routes);
      var hit = null;
      for (var i = routes.length - 1; i >= 0; i--) if (matches(routes[i].pattern, url)) { hit = routes[i]; break; }
      if (!hit) return origFetch.call(win, input, init);
      return new win.Promise(function (resolve, reject) {
        var settled = false;
        function done(fn, v) { if (!settled) { settled = true; fn(v); } }
        if (init.signal) {
          if (init.signal.aborted) return done(reject, new win.DOMException('The user aborted a request.', 'AbortError'));
          init.signal.addEventListener('abort', function () { done(reject, new win.DOMException('The user aborted a request.', 'AbortError')); });
        }
        var req = {
          url: function () { return url; },
          method: function () { return init.method || 'GET'; },
          postData: function () { return init.body == null ? null : String(init.body); },
          postDataJSON: function () { return JSON.parse(String(init.body)); },
          headers: function () { return init.headers || {}; }
        };
        var route = {
          request: function () { return req; },
          fulfill: function (o) {
            o = o || {};
            var body = o.json !== undefined ? JSON.stringify(o.json) : (o.body == null ? '' : o.body);
            var ct = o.contentType || (o.json !== undefined ? 'application/json' : 'text/plain');
            done(resolve, new win.Response(body, { status: o.status || 200, headers: { 'Content-Type': ct } }));
            return Promise.resolve();
          },
          abort: function () { done(reject, new win.TypeError('Failed to fetch')); return Promise.resolve(); },
          continue: function () { origFetch.call(win, input, init).then(function (r) { done(resolve, r); }, function (e) { done(reject, e); }); return Promise.resolve(); }
        };
        route.fallback = route.continue;
        Promise.resolve().then(function () { return hit.handler(route, req); }).catch(function (e) { done(reject, e); });
      });
    };
  };

  /* CSS plus the two Playwright extensions the suite uses: `css:has-text("x")`
     (case-insensitive substring of the text) and `text=x`. */
  function pwQuery(d, sel) {
    if (!d) return [];
    var nth = /^(.*?)\s*>>\s*nth=(-?\d+)\s*$/.exec(sel);
    if (nth) { var all = pwQuery(d, nth[1]), k = +nth[2]; var el = all[k < 0 ? all.length + k : k]; return el ? [el] : []; }
    var t = /^text=(.*)$/.exec(sel);
    if (t) { var want = t[1].replace(/^["']|["']$/g, '').toLowerCase();
      return Array.prototype.slice.call(d.querySelectorAll('body *')).filter(function (el) {
        return el.children.length === 0 && (el.textContent || '').toLowerCase().indexOf(want) >= 0; }); }
    var m = /^(.*?):(has-text|text-is)\((["'])([\s\S]*?)\3\)(.*)$/.exec(sel);
    if (!m) return Array.prototype.slice.call(d.querySelectorAll(sel));
    var kind = m[2], needle = m[4], rest = m[5];
    var norm = function (x) { return String(x || '').replace(/\s+/g, ' ').trim(); };
    var base = Array.prototype.slice.call(d.querySelectorAll(m[1] || '*')).filter(function (el) {
      return kind === 'text-is' ? norm(el.textContent) === norm(needle)
                                : norm(el.textContent).toLowerCase().indexOf(norm(needle).toLowerCase()) >= 0; });
    if (!rest) return base;
    var out = [];
    base.forEach(function (el) { Array.prototype.forEach.call(el.querySelectorAll(':scope ' + rest.trim()), function (x) { out.push(x); }); });
    return out;
  }
  function Locator(page, sel, idx) { this.page = page; this.sel = sel; this.idx = idx; }
  Locator.prototype._all = function () { return pwQuery(this.page._doc(), this.sel); };
  Locator.prototype._el = function () { var a = this._all(); return this.idx === 'last' ? a[a.length - 1] : a[this.idx || 0]; };
  Locator.prototype.count = async function () { return this._all().length; };
  Locator.prototype.first = function () { return new Locator(this.page, this.sel, 0); };
  Locator.prototype.last = function () { return new Locator(this.page, this.sel, 'last'); };
  Locator.prototype.nth = function (i) { return new Locator(this.page, this.sel, i); };
  Locator.prototype._wait = async function (ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 5000)) { var el = this._el(); if (el) return el; await sleep(50); }
    throw new Error('locator ' + this.sel + ': no element');
  };
  Locator.prototype.click = async function () { var el = await this._wait(); el.scrollIntoView({ block: 'center' }); el.click(); };
  Locator.prototype.innerText = async function () { return (await this._wait()).innerText; };
  Locator.prototype.textContent = async function () { return (await this._wait()).textContent; };
  Locator.prototype.getAttribute = async function (n) { return (await this._wait()).getAttribute(n); };
  Locator.prototype.isVisible = async function () { var el = this._el(); if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  Locator.prototype.scrollIntoViewIfNeeded = async function () { var el = await this._wait(); el.scrollIntoView({ block: 'center' }); };
  Locator.prototype.screenshot = async function () { return ''; };
  Locator.prototype.evaluate = async function (fn, arg) { var el = await this._wait(); var w = this.page.frame.contentWindow; return clone(await w.eval('(' + fn.toString() + ')')(el, clone(arg))); };

  function Page(ctx) {
    this.ctx = ctx; this.routes = []; this.listeners = {};
    var vp = ctx.opts.viewport || { width: 1280, height: 720 };
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;border:0;background:#fff;width:' + vp.width + 'px;height:' + vp.height + 'px;z-index:' + (10 + pages.length);
    STAGE().appendChild(f);
    this.frame = f;
    this.keyboard = { press: async (k) => { var d = this._doc(); var t = d.activeElement || d.body; var w = this.frame.contentWindow;
      ['keydown', 'keyup'].forEach(function (ty) { t.dispatchEvent(new w.KeyboardEvent(ty, { key: k, bubbles: true })); }); } };
    pages.push(this);
  }
  Page.prototype._doc = function () { try { return this.frame.contentDocument; } catch (e) { return null; } };
  Page.prototype._emit = function (ev, arg) { (this.listeners[ev] || []).forEach(function (cb) { try { cb(arg); } catch (e) {} }); };
  Page.prototype.on = function (ev, cb) { (this.listeners[ev] = this.listeners[ev] || []).push(cb); return this; };
  Page.prototype.context = function () { return this.ctx; };
  Page.prototype.goto = function (url) {
    var self = this;
    return new Promise(function (res) {
      var f = self.frame, fin = false;
      function done() { if (!fin) { fin = true; setTimeout(res, 30); } }
      f.onload = done;
      self._hooked = false;
      f.src = url;
      setTimeout(done, 45000);
    });
  };
  Page.prototype.reload = function () { return this.goto(this.frame.contentWindow.location.href); };
  /* Playwright keeps answering url() after the page is closed - tests read it
     after browser.close() - so the last address is remembered. */
  Page.prototype.url = function () { try { this._lastUrl = this.frame.contentWindow.location.href; } catch (e) {} return this._lastUrl || ''; };
  Page.prototype.route = async function (pattern, handler) {
    /* A route on a script or stylesheet can only mean "block it": a <script
       src> never reaches fetch. Probe the handler; if it aborts, the server
       refuses that path for this context. */
    if (typeof pattern === 'string' && /\.(js|css)$/.test(pattern)) {
      var aborted = false;
      try { handler({ abort: function () { aborted = true; return Promise.resolve(); }, fulfill: function () { return Promise.resolve(); },
        continue: function () { return Promise.resolve(); }, request: function () { return { url: function () { return pattern; } }; } }); } catch (e) {}
      if (aborted) { syncReq('POST', '/__block', JSON.stringify({ add: pattern.replace(/^\*\*/, '') })); this.ctx.blocked = true; }
      return;
    }
    this.routes.push({ pattern: pattern, handler: handler });
  };
  Page.prototype.unroute = async function (pattern) { this.routes = this.routes.filter(function (r) { return r.pattern !== pattern; }); };
  Page.prototype.evaluate = async function (fn, arg) {
    var w = this.frame.contentWindow;
    var r = typeof fn === 'function' ? w.eval('(' + fn.toString() + ')')(clone(arg)) : w.eval(String(fn));
    return clone(await r);
  };
  Page.prototype.evaluateHandle = Page.prototype.evaluate;
  Page.prototype.waitForTimeout = function (ms) { return sleep(ms); };
  Page.prototype.waitForFunction = async function (fn, arg, opts) {
    var t = (opts && opts.timeout) || 30000, t0 = Date.now(), w = this.frame.contentWindow;
    var f = typeof fn === 'function' ? w.eval('(' + fn.toString() + ')') : function () { return w.eval(String(fn)); };
    while (Date.now() - t0 < t) { try { if (await f(clone(arg))) return true; } catch (e) {} await sleep(50); }
    var e = new Error('page.waitForFunction: Timeout ' + t + 'ms exceeded.'); e.name = 'TimeoutError'; throw e;
  };
  Page.prototype.waitForSelector = async function (sel, opts) { return new Locator(this, sel, 0)._wait((opts && opts.timeout) || 30000); };
  Page.prototype.waitForLoadState = async function () { await sleep(50); };
  Page.prototype.locator = function (sel) { return new Locator(this, sel, 0); };
  Page.prototype.$ = async function (sel) { var d = this._doc(); return d && d.querySelector(sel); };
  Page.prototype.$$ = async function (sel) { var d = this._doc(); return d ? Array.prototype.slice.call(d.querySelectorAll(sel)) : []; };
  Page.prototype.click = async function (sel) { return new Locator(this, sel, 0).click(); };
  Page.prototype.fill = async function (sel, v) {
    var el = await new Locator(this, sel, 0)._wait(), w = this.frame.contentWindow;
    el.focus(); el.value = v;
    el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  Page.prototype.type = Page.prototype.fill;
  Page.prototype.addScriptTag = async function (o) {
    var d = this._doc(), s = d.createElement('script');
    if (o.content) s.textContent = o.content;
    else if (o.path) s.textContent = fs.readFileSync(o.path);
    else if (o.url) { s.src = o.url; await new Promise(function (r) { s.onload = s.onerror = r; d.head.appendChild(s); }); return; }
    d.head.appendChild(s);
  };
  Page.prototype.addStyleTag = async function (o) {
    var d = this._doc(), s = d.createElement('style');
    s.textContent = o.content || (o.path ? fs.readFileSync(o.path) : '');
    d.head.appendChild(s);
  };
  Page.prototype.screenshot = async function () { return ''; };
  Page.prototype.emulateMedia = async function (o) { this._media = Object.assign(this._media || {}, o || {}); };
  Page.prototype.setViewportSize = async function (vp) { this.frame.style.width = vp.width + 'px'; this.frame.style.height = vp.height + 'px'; };
  Page.prototype.viewportSize = function () { return { width: parseInt(this.frame.style.width, 10), height: parseInt(this.frame.style.height, 10) }; };
  Page.prototype.close = async function () { this.url(); if (this.frame && this.frame.parentNode) this.frame.parentNode.removeChild(this.frame); var i = pages.indexOf(this); if (i >= 0) pages.splice(i, 1); };

  function Context(browser, opts) {
    this.browser = browser; this.opts = opts || {}; this.routes = []; this.pages = [];
    try { sessionStorage.clear(); } catch (e) {}
    syncReq('POST', '/__block', JSON.stringify({ clear: true }));
  }
  Context.prototype.route = async function (pattern, handler) { this.routes.push({ pattern: pattern, handler: handler }); };
  Context.prototype.newPage = async function () { var p = new Page(this); this.pages.push(p); return p; };
  Context.prototype.addInitScript = async function () { console.log('   [shim] addInitScript is not supported - no-op'); };
  Context.prototype.close = async function () { for (var i = 0; i < this.pages.length; i++) await this.pages[i].close(); };
  function Browser() { this.contexts = []; }
  Browser.prototype.newContext = async function (o) { var c = new Context(this, o); this.contexts.push(c); return c; };
  Browser.prototype.newPage = async function (o) { var c = await this.newContext(o); return c.newPage(); };
  Browser.prototype.close = async function () { for (var i = 0; i < this.contexts.length; i++) await this.contexts[i].close(); };
  var playwright = { chromium: { launch: async function () { return new Browser(); } } };

  /* ── CommonJS ───────────────────────────────────────────────────── */
  function makeRequire(dir, run) {
    return function require(name) {
      if (name === 'fs') return fs;
      if (name === 'path') return path;
      if (name === 'vm') return vm;
      if (name === 'playwright' || /node_modules\/playwright$/.test(name)) return playwright;
      var file = name.charAt(0) === '/' ? name : path.resolve(dir, name);
      if (file.indexOf(REPO_FS) === 0) file = file.slice(REPO_FS.length) || '/';
      var cands = /\.(js|json)$/.test(file) ? [file] : [file + '.js', file + '.json', file + '/index.js'];
      for (var i = 0; i < cands.length; i++) {
        if (run.cache[cands[i]]) return run.cache[cands[i]].exports;
        var x = syncReq('GET', cands[i] + '?nc=' + Date.now());
        if (x.status !== 200) continue;
        var module = { exports: {} };
        run.cache[cands[i]] = module;
        if (/\.json$/.test(cands[i])) { module.exports = JSON.parse(x.responseText); return module.exports; }
        var fn = new Function('require', 'module', 'exports', '__dirname', '__filename', 'process', 'console', 'Buffer', '__src',
          'return eval(__src)');
        module.__completion = fn(makeRequire(path.dirname(cands[i]), run), module, module.exports, REPO_FS + path.dirname(cands[i]), REPO_FS + cands[i],
          run.process, run.console, undefined, x.responseText + '\n//# sourceURL=' + location.origin + cands[i]);
        return module.exports;
      }
      throw new Error("Cannot find module '" + name + "' from " + dir);
    };
  }

  window.__runs = {};
  /* runTest('/.claude/skills/morning-check/scripts/test_walk.js', ['arg'], {env}) -> run id.
     Poll window.__runs[id] for { lines, done, exitCode, ms }. */
  window.runTest = function (file, args, env) {
    var id = path.basename(file, '.js') + (args && args.length ? '_' + args.join('_') : '') + '_' + Date.now();
    var r = { file: file, lines: [], done: false, exitCode: 0, started: Date.now(), cache: {} };
    window.__runs[id] = r;
    function out() {
      var s = Array.prototype.map.call(arguments, function (a) { return typeof a === 'string' ? a : (a instanceof Error ? a.stack : JSON.stringify(a)); }).join(' ');
      r.lines.push(s);
    }
    r.console = { log: out, info: out, warn: out, error: out, debug: out };
    r.process = { argv: ['node', file].concat(args || []), env: Object.assign({ SF_BASE: location.origin + '/' }, env || {}),
                  exitCode: 0, platform: 'darwin', cwd: function () { return '/'; },
                  exit: function (c) { r.process.exitCode = c; var e = new Error('__exit'); e.__exit = true; throw e; } };
    var finish = function () { r.done = true; r.exitCode = r.process.exitCode || 0; r.ms = Date.now() - r.started; };
    try {
      var req = makeRequire(path.dirname(file), r);
      req(file);
      var mod = r.cache[file] || r.cache[file + '.js'];
      var p = mod && mod.__completion;
      if (p && typeof p.then === 'function') p.then(finish, function (e) { if (!(e && e.__exit)) { out('UNCAUGHT ' + (e && e.stack || e)); r.process.exitCode = 1; } finish(); });
      else finish();
    } catch (e) { if (!(e && e.__exit)) { out('UNCAUGHT ' + (e && e.stack || e)); r.process.exitCode = 1; } finish(); }
    return id;
  };
  window.runStatus = function (id) { var r = window.__runs[id]; return r ? { done: r.done, exitCode: r.exitCode, ms: r.ms || (Date.now() - r.started), n: r.lines.length, tail: r.lines.slice(-12) } : null; };
})();

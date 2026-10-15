/* ── The classroom and assignment suite (Oct 2026) ─────────────────────────
   Runs in the desktop app's browser pane, served by server.py:

     http://localhost:8765/__h/classroom.html   then   runClassroom()

   What it does, and why it is built this way: the dev Mac has no Node, and
   the cloud container cannot reach Firestore, so api/class.js and
   api/webhook.js are loaded HERE, as source, with a tiny CommonJS shim, and
   every call they make to Google is answered by an in-memory Firestore that
   speaks the same REST shapes (documents, lists with field masks, create
   with documentId, PATCH with updateMask or an updateTime precondition,
   DELETE). The server code under test is the real file, unmodified.

   Then the real pages are loaded in iframes. server.py injects a hook at the
   top of every page; through it each page's fetch() is pointed at that same
   in-browser api/class, and api/generate goes to server.py's mock. So a
   teacher builds an assignment in teacher-build.html, a student does it in
   lesson.html, and the teacher reads the result in teacher.html - one data
   store under all three, exactly the path production takes.

   Results: window.CR = { pass, fail, log } and classroomSummary(). */
(function () {
  'use strict';
  var CR = window.CR = { pass: 0, fail: 0, log: [], done: false };
  function log(s) { CR.log.push(s); var el = document.getElementById('log'); if (el) el.textContent = CR.log.slice(-400).join('\n'); }
  function ok(cond, name, extra) {
    if (cond) { CR.pass++; log('PASS ' + name); }
    else { CR.fail++; log('FAIL ' + name + (extra !== undefined ? ' :: ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : '')); }
    return !!cond;
  }
  window.classroomSummary = function () {
    return { done: CR.done, pass: CR.pass, fail: CR.fail, failures: CR.log.filter(function (l) { return /^FAIL|^ERROR/.test(l); }) };
  };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitFor(fn, ms, what) {
    var t0 = Date.now();
    return new Promise(function (res, rej) {
      (function tick() {
        var v; try { v = fn(); } catch (e) { v = null; }
        if (v) return res(v);
        if (Date.now() - t0 > (ms || 8000)) return rej(new Error('timeout: ' + (what || fn.toString().slice(0, 80))));
        setTimeout(tick, 60);
      })();
    });
  }

  /* ── An in-memory Firestore, over REST ───────────────────────────────── */
  var BASE = 'https://firestore.googleapis.com/v1/projects/studyflow-e59ef/databases/(default)/documents';
  var DB = {}, clock = 0, ADMIN = 'adm-token-' + Math.random().toString(36).slice(2);
  CR.DB = DB;
  function stamp() { clock++; return '2026-10-14T00:00:' + String(clock).padStart(6, '0') + 'Z'; }
  function docOut(path) { var d = DB[path]; return { name: 'projects/x/databases/(default)/documents/' + path, fields: JSON.parse(JSON.stringify(d.fields)), updateTime: d.updateTime }; }
  function reply(status, body) { return Promise.resolve(new Response(JSON.stringify(body), { status: status, headers: { 'Content-Type': 'application/json' } })); }
  var FS = CR.FS = { calls: [] };
  var USERS = CR.USERS = {};          // id token -> { localId, email, displayName }
  var STRIPE = CR.STRIPE = { email: '' };

  function googleFetch(url, opts) {
    opts = opts || {};
    var u = new URL(url), method = (opts.method || 'GET').toUpperCase();
    if (u.host === 'identitytoolkit.googleapis.com') {
      var tok = JSON.parse(opts.body || '{}').idToken;
      var usr = USERS[tok];
      return reply(usr ? 200 : 400, usr ? { users: [usr] } : { error: { message: 'INVALID_ID_TOKEN' } });
    }
    if (u.host === 'oauth2.googleapis.com') return reply(200, { access_token: ADMIN, expires_in: 3600 });
    if (u.host === 'api.stripe.com') return reply(200, { id: 'cus_1', email: STRIPE.email });
    if (u.host !== 'firestore.googleapis.com') return reply(599, { error: 'unexpected host ' + u.host });
    var auth = (opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '';
    FS.calls.push({ method: method, url: url, auth: auth });
    if (auth !== 'Bearer ' + ADMIN) return reply(403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } });
    var prefix = '/v1/projects/studyflow-e59ef/databases/(default)/documents/';
    var raw = u.pathname.indexOf(prefix) === 0 ? u.pathname.slice(prefix.length) : null;
    if (raw == null) return reply(400, { error: { status: 'INVALID_ARGUMENT' } });
    var path = raw.split('/').map(decodeURIComponent).join('/');
    var segs = path.split('/');
    var isDoc = segs.length % 2 === 0;
    var q = u.searchParams;
    if (method === 'GET' && isDoc) return DB[path] ? reply(200, docOut(path)) : reply(404, { error: { code: 404, status: 'NOT_FOUND' } });
    if (method === 'GET' && !isDoc) {
      var mask = q.getAll('mask.fieldPaths');
      var docs = Object.keys(DB).filter(function (p) { return p.indexOf(path + '/') === 0 && p.slice(path.length + 1).indexOf('/') === -1; })
        .sort().map(function (p) {
          var d = docOut(p);
          if (mask.length) { var f = {}; mask.forEach(function (k) { if (d.fields[k]) f[k] = d.fields[k]; }); d.fields = f; }
          return d;
        });
      return reply(200, docs.length ? { documents: docs } : {});
    }
    if (method === 'POST' && !isDoc) {
      var id = q.get('documentId'), p2 = path + '/' + id;
      if (DB[p2]) return reply(409, { error: { code: 409, status: 'ALREADY_EXISTS' } });
      DB[p2] = { fields: JSON.parse(opts.body).fields, updateTime: stamp() };
      return reply(200, docOut(p2));
    }
    if (method === 'PATCH' && isDoc) {
      var pre = q.get('currentDocument.updateTime');
      if (pre && (!DB[path] || DB[path].updateTime !== pre)) return reply(400, { error: { code: 400, status: 'FAILED_PRECONDITION' } });
      var body = JSON.parse(opts.body), fm = q.getAll('updateMask.fieldPaths');
      if (fm.length) {
        var cur = DB[path] ? DB[path].fields : {};
        fm.forEach(function (k) { if (body.fields[k] !== undefined) cur[k] = body.fields[k]; else delete cur[k]; });
        DB[path] = { fields: cur, updateTime: stamp() };
      } else DB[path] = { fields: body.fields, updateTime: stamp() };
      return reply(200, docOut(path));
    }
    if (method === 'DELETE' && isDoc) { delete DB[path]; return reply(200, {}); }
    return reply(400, { error: { status: 'INVALID_ARGUMENT', message: method + ' ' + path } });
  }
  function fsGet(path) {
    var d = DB[path]; if (!d) return null;
    var o = {};
    Object.keys(d.fields).forEach(function (k) {
      var v = d.fields[k];
      o[k] = v.stringValue !== undefined ? v.stringValue : v.integerValue !== undefined ? Number(v.integerValue) :
        v.doubleValue !== undefined ? v.doubleValue : v.booleanValue !== undefined ? v.booleanValue : null;
    });
    return o;
  }
  function fsPut(path, obj) {
    var f = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      f[k] = typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? { integerValue: v } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: JSON.stringify(v) };
    });
    DB[path] = { fields: f, updateTime: stamp() };
  }
  CR.fsGet = fsGet; CR.fsPut = fsPut;

  /* ── Loading the real server files ───────────────────────────────────── */
  var SRC = {};
  function loadSrc(p) { return fetch('/' + p + '?_=' + Date.now()).then(function (r) { return r.text(); }).then(function (t) { SRC[p] = t; }); }
  var hmacFor = {};   // text -> hex, precomputed with SubtleCrypto (the shim must be synchronous)
  var cryptoShim = {
    randomBytes: function (n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; },
    createSign: function () { return { update: function () { return this; }, sign: function () { return 'c2ln'; } }; },
    createHmac: function () {
      var txt = '';
      return { update: function (t) { txt += t; return this; }, digest: function () { return hmacFor[txt] || '00'; } };
    },
    timingSafeEqual: function (a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  };
  function toB64Url(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  var BufferShim = {
    from: function (v, enc) {
      if (enc === 'hex') { var a = []; for (var i = 0; i < v.length; i += 2) a.push(parseInt(v.substr(i, 2), 16)); return a; }
      return { toString: function (e) { return e === 'base64url' ? toB64Url(String(v)) : String(v); } };
    }
  };
  function makeModule(file, env) {
    var cache = {};
    function req(name) {
      if (name === 'crypto') return cryptoShim;
      var p = name.replace(/^\.\//, 'api/') + (/\.js$/.test(name) ? '' : '.js');
      if (cache[p]) return cache[p].exports;
      var module = { exports: {} }; cache[p] = module;
      var fn = new Function('require', 'module', 'exports', 'fetch', 'Buffer', 'process', 'console', SRC[p]);
      fn(req, module, module.exports, googleFetch, BufferShim, { env: env }, { log: function () {}, error: function () {}, warn: function () {} });
      return module.exports;
    }
    return req('./' + file.replace(/^api\//, ''));
  }
  var ENV = { FIREBASE_API_KEY: 'web-key', FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x.iam', private_key: '-----BEGIN-----\\nk\\n-----END-----' }),
              STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' };
  var classHandler = null;

  /* Calls the handler as Vercel would. */
  function call(handler, o) {
    return new Promise(function (resolve) {
      var res = {
        statusCode: 200, headers: {},
        setHeader: function (k, v) { this.headers[k] = v; },
        status: function (c) { this.statusCode = c; return this; },
        json: function (b) { resolve({ status: this.statusCode, body: b }); return this; },
        end: function () { resolve({ status: this.statusCode, body: null }); return this; }
      };
      var req = { method: o.method || 'GET', query: o.query || {}, headers: o.headers || {}, body: o.body };
      Promise.resolve(handler(req, res)).catch(function (e) { resolve({ status: 'THREW', body: String(e && e.stack || e) }); });
    });
  }
  function as(tok) { return { authorization: 'Bearer ' + tok }; }
  function GET(tok, query) { return call(classHandler, { method: 'GET', query: query, headers: as(tok) }); }
  function POST(tok, body) { return call(classHandler, { method: 'POST', body: body, headers: as(tok) }); }
  CR.GET = GET; CR.POST = POST;

  /* The page side: SFAuth.classFetch(url, opts) lands here. */
  function pageFetch(realFetch) {
    return function (url, opts) {
      var s = String(url);
      if (/(^|\/)api\/class(\?|$)/.test(s)) {
        opts = opts || {};
        var u = new URL(s, location.origin), query = {};
        u.searchParams.forEach(function (v, k) { query[k] = v; });
        var h = opts.headers || {};
        var auth = h.Authorization || h.authorization || '';
        var body = opts.body ? JSON.parse(opts.body) : undefined;
        return call(classHandler, { method: (opts.method || 'GET').toUpperCase(), query: query, headers: { authorization: auth }, body: body })
          .then(function (r) { return new Response(JSON.stringify(r.body), { status: r.status === 'THREW' ? 500 : r.status, headers: { 'Content-Type': 'application/json' } }); });
      }
      return realFetch(url, opts);
    };
  }
  /* server.py puts this call at the top of every page it serves. */
  window.__sfHook = function (win) {
    var real = win.fetch.bind(win);
    win.fetch = pageFetch(real);
    if (CR.onPage) { try { CR.onPage(win); } catch (e) { log('ERROR onPage ' + e); } }
  };

  /* ── Accounts ────────────────────────────────────────────────────────── */
  var FB_KEY = 'firebase:authUser:AIzaSyCY4FI-6L9tsAokNFl6o5bsmCt-JD0H8HI:[DEFAULT]';
  function person(tag, name) {
    var p = { tok: 'tok-' + tag, uid: 'uid' + tag.replace(/\W/g, '') + 'xxxxxxxxxxxxxxxxxxxx'.slice(0, 20), email: tag + '@school.test', name: name || tag };
    USERS[p.tok] = { localId: p.uid, email: p.email, displayName: p.name };
    return p;
  }
  function signInAs(p) {
    localStorage.setItem(FB_KEY, JSON.stringify({ uid: p.uid, email: p.email,
      stsTokenManager: { accessToken: p.tok, refreshToken: 'r', expirationTime: Date.now() + 3600e3 } }));
  }

  function frame(url) {
    var st = document.getElementById('stage');
    st.innerHTML = '';
    var f = document.createElement('iframe');
    f.style.cssText = 'width:420px;height:860px;border:1px solid #99a;background:#fff';
    st.appendChild(f);
    return new Promise(function (res) {
      f.onload = function () { res(f.contentWindow); };
      f.src = url;
    });
  }
  function mock(rules) {
    return fetch('/__mock', { method: 'POST', body: JSON.stringify({ rules: rules }) }).then(function () {});
  }

  /* ── Fixtures ────────────────────────────────────────────────────────── */
  var NOTES = 'Photosynthesis is how plants make their own food. In the chloroplasts, chlorophyll absorbs light energy. ' +
    'The plant takes in carbon dioxide through small pores called stomata and water through its roots. ' +
    'Using light energy it turns carbon dioxide and water into glucose and releases oxygen as a by-product. ' +
    'Plants do not get their food from the soil; the soil gives water and minerals. The light reactions happen in the thylakoid ' +
    'membranes and the Calvin cycle happens in the stroma. Glucose is used for energy and to build cellulose.';
  function goalsReply() {
    return { result: JSON.stringify({ subject: 'Photosynthesis', field: 'science', goals: [
      'Explain where a plant gets the materials it uses to make glucose',
      'Identify the inputs and outputs of photosynthesis',
      'Describe what happens in the chloroplast'] }) };
  }
  function assignmentReply() {
    var qs = [
      { goal: 'g2', type: 'mcq', question: 'Which gas do plants take in for photosynthesis?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen <img src=x onerror="window.__pwned=1">'], correctIndex: 1, hint: 'It enters through the stomata.', explanation: 'Carbon dioxide enters through the stomata; oxygen is what leaves.', difficulty: 'Easy' },
      { goal: 'g1', type: 'whosright', question: 'Where does a plant get the food it needs?', claims: [
        { says: 'From the soil, through its roots.', right: false, why: 'Soil gives water and minerals, not food.' },
        { says: 'It makes glucose itself from carbon dioxide and water, using light.', right: true, why: 'That is photosynthesis.' },
        { says: 'From the sunlight itself, which is food.', right: false, why: 'Light is energy, not the material.' }], hint: '', explanation: 'Plants make their own food.', difficulty: 'Medium' },
      { goal: 'g3', type: 'fill', question: 'The pigment that absorbs light in the chloroplast is called ________.', answer: 'chlorophyll', hint: 'It makes leaves green.', explanation: 'Chlorophyll absorbs the light energy.', difficulty: 'Easy' },
      { goal: 'g2', type: 'truefalse', question: 'Oxygen is released as a by-product of photosynthesis.', correct: 'True', hint: '', explanation: 'Oxygen leaves through the stomata.', difficulty: 'Easy' },
      { goal: 'g3', type: 'recall', question: 'Name the two things a plant takes in to make glucose.', items: ['carbon dioxide / CO2', 'water'], need: 2, hint: '', explanation: 'Carbon dioxide and water.', difficulty: 'Medium' },
      /* A fill with no blank: the plan builder's validator drops it, and so must this page. */
      { goal: 'g1', type: 'fill', question: 'Explain photosynthesis', answer: 'a long process that makes food', hint: '', explanation: '', difficulty: 'Hard' }
    ];
    return { result: JSON.stringify({ title: 'Photosynthesis', briefing: 'How plants make food.', content: 'Plants make glucose from carbon dioxide and water using light energy captured by chlorophyll. Oxygen is released.',
      steps: ['Light is absorbed by chlorophyll', 'Water is split and oxygen released', 'Carbon dioxide is fixed into glucose'],
      keyTerms: [{ term: 'Chlorophyll', definition: 'The green pigment that absorbs light' }, { term: 'Stomata', definition: 'Pores that let gases in and out' }],
      misconceptions: [{ believe: 'Plants eat soil', actually: 'Plants make their own food', why: 'Soil gives water and minerals' }], questions: qs }) };
  }
  function oneReply() {
    return { result: JSON.stringify({ questions: [{ goal: 'g3', type: 'mcq', question: 'Where do the light reactions happen?', options: ['Stroma', 'Thylakoid membranes', 'Nucleus', 'Cell wall'], correctIndex: 1, hint: '', explanation: 'In the thylakoid membranes.', difficulty: 'Medium' }] }) };
  }

  /* ── 1. THE API, ON ITS OWN ──────────────────────────────────────────── */
  function apiSuite() {
    var T = person('teacher', 'Ms Rivera'), OUT = person('outsider', 'Nosy'), S = [];
    for (var i = 1; i <= 31; i++) S.push(person('s' + i, 'Student ' + i));
    var code, aid, A;
    return POST(T.tok, { action: 'teacher-setup', name: 'Ms Rivera', school: 'Test' }).then(function (r) {
      ok(r.status === 200 && r.body.teacher && /^SF-/.test(r.body.teacher.classCode), 'teacher-setup makes a class', r);
      code = r.body.teacher.classCode; CR.code = code;
      /* Free cap: 5 */
      var chain = Promise.resolve();
      S.slice(0, 6).forEach(function (s, i) {
        chain = chain.then(function () { return POST(s.tok, { action: 'join', classCode: code, studentData: { name: s.name } }); })
          .then(function (r2) { if (i < 5) ok(r2.body.success, 'free class: student ' + (i + 1) + ' joins', r2); else ok(r2.body.error === 'class_full' && /max 5/.test(r2.body.message), 'free class: the 6th is turned away', r2); });
      });
      return chain;
    }).then(function () {
      /* The teacher pays (what api/webhook.js writes) - 30 now. */
      fsPut('users/teacher@school.test', { tier: 'classroom', email: 'teacher@school.test' });
      var chain = Promise.resolve();
      S.slice(5, 31).forEach(function (s, i) {
        chain = chain.then(function () { return POST(s.tok, { action: 'join', classCode: code, studentData: { name: s.name } }); })
          .then(function (r2) {
            if (i < 25) { if (!r2.body.success) ok(false, 'paid class: student ' + (i + 6) + ' joins', r2); }
            else ok(r2.body.error === 'class_full' && /max 30/.test(r2.body.message), 'paid class: the 31st is turned away', r2);
          });
      });
      return chain.then(function () {
        var cls = fsGet('classes/' + code);
        ok(JSON.parse(cls.students).length === 30, 'paid class holds exactly 30', JSON.parse(cls.students).length);
      });
    }).then(function () {
      /* Saving: only the teacher; strings neutralised; unknown types dropped; capped. */
      var qs = JSON.parse(assignmentReply().result).questions.slice(0, 5);
      qs.forEach(function (q, i) { q.aid = 'qa' + i; });
      qs.push({ type: 'script', question: 'x' });
      qs.push(JSON.parse('{"type":"mcq","aid":"qa0","question":"dup id","options":["a","b"],"correctIndex":0,"__proto__":{"polluted":1},"constructor":{"x":1}}'));
      var body = { action: 'save-assignment', classCode: code, assignment: { title: 'Photo <b>synthesis</b>', kind: 'homework', dueAt: '2026-10-16T08:00',
        minutes: 20, grade: '7th', subject: 'Photosynthesis', subjectType: 'science',
        goals: [{ id: 'g1', text: 'Explain <script>x</script> food' }, { id: 'g2', text: 'Inputs and outputs' }, { id: 'g3', text: 'Chloroplast' }],
        settings: { hints: false }, lesson: { title: 'P', content: 'Plants <i>make</i> food', evil: 'drop me' }, questions: qs } };
      return POST(S[0].tok, body).then(function (r) {
        ok(r.status === 403, 'a student cannot save an assignment', r.status);
        return POST(OUT.tok, body);
      }).then(function (r) {
        ok(r.status === 403, 'an outsider cannot save an assignment', r.status);
        return POST(T.tok, body);
      });
    }).then(function (r) {
      ok(r.status === 200 && /^[A-Z0-9]{12}$/.test(r.body.assignment.id), 'the teacher saves a draft', r);
      A = r.body.assignment; aid = A.id; CR.aid = aid;
      var blob = JSON.stringify(A);
      ok(blob.indexOf('<') === -1 && blob.indexOf('>') === -1, 'no angle bracket survives anywhere in the saved assignment', blob.match(/.{20}[<>].{20}/));
      ok(A.questions.length === 6, 'the unknown type is dropped, the rest kept (5 + duplicate)', A.questions.length);
      var ids = A.questions.map(function (q) { return q.aid; });
      ok(new Set(ids).size === ids.length, 'question ids are unique (a duplicate is re-minted)', ids);
      ok(!('evil' in A.lesson), 'lesson keeps only known keys');
      ok(A.status === 'draft' && A.settings.hints === false, 'draft, with the hints setting kept');
      ok(!JSON.stringify(A).includes('polluted'), 'no prototype pollution through a question');
      var many = []; for (var k = 0; k < 40; k++) many.push({ type: 'truefalse', question: 'Q' + k, correct: 'True' });
      return POST(T.tok, { action: 'save-assignment', classCode: code, assignment: { title: 'Long', questions: many } });
    }).then(function (r) {
      ok(r.body.assignment && r.body.assignment.questions.length === 30, 'an assignment is capped at 30 questions', r.body.assignment && r.body.assignment.questions.length);
      CR.longId = r.body.assignment.id;
      return GET(S[0].tok, { classCode: code, type: 'assignments' });
    }).then(function (r) {
      ok(r.status === 200 && r.body.assignments.length === 0, 'a student sees no drafts', r.body);
      return GET(S[0].tok, { classCode: code, type: 'assignment', id: aid });
    }).then(function (r) {
      ok(r.status === 404, 'a student cannot open a draft', r.status);
      return POST(T.tok, { action: 'save-assignment', classCode: code, assignment: { title: 'Empty', questions: [] } });
    }).then(function (r) {
      return POST(T.tok, { action: 'publish-assignment', classCode: code, id: r.body.assignment.id });
    }).then(function (r) {
      ok(r.status === 400 && r.body.error === 'no_questions', 'an assignment with no questions cannot be published', r);
      return POST(S[0].tok, { action: 'publish-assignment', classCode: code, id: aid });
    }).then(function (r) {
      ok(r.status === 403, 'a student cannot publish', r.status);
      return POST(T.tok, { action: 'publish-assignment', classCode: code, id: aid });
    }).then(function (r) {
      ok(r.body.assignment && r.body.assignment.status === 'published' && r.body.assignment.publishedAt, 'the teacher publishes', r.body);
      return GET(S[0].tok, { classCode: code, type: 'assignments' });
    }).then(function (r) {
      var row = (r.body.assignments || []).filter(function (a) { return a.id === aid; })[0];
      ok(row && row.myStatus === 'not_started' && !row.questions && row.title, 'a student sees it in the list, without its questions, not started', row);
      return GET(OUT.tok, { classCode: code, type: 'assignments' });
    }).then(function (r) {
      ok(r.status === 403, 'an outsider cannot list the class\'s assignments', r.status);
      return GET(S[0].tok, { classCode: code, type: 'assignment', id: aid });
    }).then(function (r) {
      ok(r.status === 200 && r.body.assignment.questions.length === 6, 'a student opens the published assignment whole', r.status);
      /* Submitting */
      return POST(OUT.tok, { action: 'submit', classCode: code, id: aid, answers: { qa0: { f: 1 } } });
    }).then(function (r) {
      ok(r.status === 403, 'an outsider cannot submit', r.status);
      return POST(S[0].tok, { action: 'submit', classCode: code, id: aid, status: 'in_progress',
        answers: Object.assign(JSON.parse('{"__proto__":{"f":1}}'), { qa0: { f: 0, a: 'Oxygen <b>', t: 12, r: 0 }, qa1: { f: 1, a: '', t: 30 }, nope: { f: 1 } }), timeSecs: 60 });
    }).then(function (r) {
      ok(r.status === 200 && r.body.status === 'in_progress', 'a student saves answers as they go', r);
      return POST(S[0].tok, { action: 'submit', classCode: code, id: aid, status: 'done',
        answers: { qa0: { f: 1, a: 'Carbon dioxide', r: 1, rc: true }, qa2: { f: 1, a: '' }, qa3: { f: 0, a: 'False' } }, timeSecs: 40 });
    }).then(function (r) {
      var sub = fsGet('classes/' + code + '/assignments/' + aid + '/submissions/' + S[0].uid);
      var ans = JSON.parse(sub.answers);
      ok(ans.qa0.f === 0 && ans.qa0.a === 'Oxygen ＜b＞', 'the FIRST try is kept when a later visit sends another', ans.qa0);
      ok(ans.qa0.r === 1 && ans.qa0.rc === true, 'returns and "recovered" are merged in', ans.qa0);
      ok(!ans.nope && Object.keys(ans).length === 4, 'answers to questions the assignment does not have are ignored', Object.keys(ans));
      ok(sub.status === 'done' && sub.finishedAt && sub.timeSecs === 60, 'done, with a finish time; time never goes down', sub);
      ok(sub.score === 50, 'the score is first tries over graded answers (2 of 4)', sub.score);
      return POST(S[0].tok, { action: 'submit', classCode: code, id: aid, status: 'in_progress', answers: {} });
    }).then(function () {
      ok(fsGet('classes/' + code + '/assignments/' + aid + '/submissions/' + S[0].uid).status === 'done', 'done stays done');
      return POST(S[1].tok, { action: 'submit', classCode: code, id: aid, status: 'in_progress', answers: { qa0: { f: 0, a: 'Oxygen' } } });
    }).then(function () {
      return GET(S[0].tok, { classCode: code, type: 'results', id: aid });
    }).then(function (r) {
      ok(r.status === 403, 'a student cannot read the class\'s results', r.status);
      return GET(T.tok, { classCode: code, type: 'results', id: aid });
    }).then(function (r) {
      var st = r.body.students || [];
      ok(st.length === 30, 'results list every student in the class', st.length);
      ok(st.filter(function (s) { return s.status === 'done'; }).length === 1 && st.filter(function (s) { return s.status === 'in_progress'; }).length === 1 &&
         st.filter(function (s) { return s.status === 'not_started'; }).length === 28, 'one done, one in progress, 28 not started');
      ok(!JSON.stringify(st).includes(S[0].uid), 'results never carry a student\'s uid');
      return GET(T.tok, { classCode: code, type: 'assignments' });
    }).then(function (r) {
      var row = r.body.assignments.filter(function (a) { return a.id === aid; })[0];
      ok(row && row.started === 2 && row.done === 1 && r.body.studentCount === 30, 'the teacher\'s list counts started and done', row);
      /* Editing after publishing: only the title and due date. */
      return POST(T.tok, { action: 'save-assignment', classCode: code, assignment: { id: aid, title: 'Photosynthesis (renamed)', dueAt: '2026-10-17', questions: [{ type: 'mcq', question: 'new', options: ['a', 'b'], correctIndex: 0 }] } });
    }).then(function (r) {
      var a = JSON.parse(fsGet('classes/' + code + '/assignments/' + aid).questions);
      ok(r.body.lockedQuestions && a.length === 6 && fsGet('classes/' + code + '/assignments/' + aid).title === 'Photosynthesis (renamed)' &&
         fsGet('classes/' + code + '/assignments/' + aid).dueAt === '2026-10-17', 'a published assignment keeps its questions; title and due date change', r.body);
      return POST(T.tok, { action: 'save-assignment', classCode: code, assignment: { id: 'ABCDEFGHJKLM', title: 'x', questions: [] } });
    }).then(function (r) {
      ok(r.status === 404, 'saving to an id that does not exist is refused', r.status);
      return GET(T.tok, { classCode: code, type: 'assignment', id: '../../users' });
    }).then(function (r) {
      ok(r.status === 400, 'an id outside the pattern never reaches a path', r.status);
      /* The first, single assignment still works. */
      return POST(T.tok, { action: 'assign', classCode: code, assignment: { topic: 'Unit 3', notes: 'some notes', date: '2026-11-01' } });
    }).then(function (r) {
      ok(r.body.success, 'the old "share notes" assignment still saves', r.body);
      return GET(S[2].tok, { classCode: code, type: 'assignment' });
    }).then(function (r) {
      ok(r.body.assignment && r.body.assignment.topic === 'Unit 3', 'and a student still reads it', r.body);
      return POST(T.tok, { action: 'delete-assignment', classCode: code, id: CR.longId });
    }).then(function () {
      return POST(S[0].tok, { action: 'delete-assignment', classCode: code, id: aid });
    }).then(function (r) {
      ok(r.status === 403, 'a student cannot delete', r.status);
      return POST(T.tok, { action: 'delete-assignment', classCode: code, id: aid });
    }).then(function (r) {
      var left = Object.keys(DB).filter(function (p) { return p.indexOf('assignments/' + aid) >= 0; });
      ok(r.body.success && left.length === 0, 'deleting removes the assignment and every submission', left);
      ok(FS.calls.every(function (c) { return c.auth === 'Bearer ' + ADMIN; }), 'every Firestore call went as the service account');
    });
  }

  /* ── 2. THE WEBHOOK WRITES THE TIER THE CLASS API READS ─────────────── */
  function webhookSuite() {
    var hook = makeModule('api/webhook.js', ENV);
    var ev = JSON.stringify({ type: 'customer.subscription.created', data: { object: { customer: 'cus_1', status: 'active',
      items: { data: [{ price: { id: 'price_1TTxArFFG0oviXd9Nl39k8ZM' } }] } } } });
    var t = Math.floor(Date.now() / 1000);
    STRIPE.email = 'New.Teacher@School.test';
    var before = FS.calls.length;
    return crypto.subtle.importKey('raw', new TextEncoder().encode(ENV.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(t + '.' + ev)); })
      .then(function (sig) {
        var hex = Array.prototype.map.call(new Uint8Array(sig), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        hmacFor[t + '.' + ev] = hex;
        var handlers = {};
        var req = { method: 'POST', headers: { 'stripe-signature': 't=' + t + ',v1=' + hex },
          on: function (n, f) { handlers[n] = f; if (n === 'end') setTimeout(function () { handlers.data && handlers.data(ev); handlers.end(); }, 0); } };
        return new Promise(function (resolve) {
          var res = { statusCode: 200, setHeader: function () {}, status: function (c) { this.statusCode = c; return this; },
            json: function (b) { resolve({ status: this.statusCode, body: b }); } };
          Promise.resolve(hook(req, res)).catch(function (e) { resolve({ status: 'THREW', body: String(e) }); });
        });
      }).then(function (r) {
        ok(r && r.status === 200, 'the webhook accepts a signed event', r);
        var u = fsGet('users/new.teacher@school.test');
        ok(u && u.tier === 'classroom', 'the paid tier lands in users/{email}, lower-cased', u);
        var mine = FS.calls.slice(before);
        ok(mine.length && mine.every(function (c) { return c.auth === 'Bearer ' + ADMIN; }), 'written as the service account, not with a fixed key', mine.map(function (c) { return c.auth.slice(0, 16); }));
      });
  }

  /* ── 3. THE TEACHER BUILDS ONE ───────────────────────────────────────── */
  var TEACH, CLASSCODE, BUILT;
  function builderSuite() {
    TEACH = person('builder', 'Mr Okafor');
    return POST(TEACH.tok, { action: 'teacher-setup', name: 'Mr Okafor' }).then(function (r) {
      CLASSCODE = r.body.teacher.classCode;
      var kids = [person('kid1', 'Ana'), person('kid2', 'Ben'), person('kid3', 'Cai')];
      CR.KIDS = kids;
      return Promise.all(kids.map(function (k) { return POST(k.tok, { action: 'join', classCode: CLASSCODE, studentData: { name: k.name } }); }));
    }).then(function () {
      localStorage.clear();
      signInAs(TEACH);
      localStorage.setItem('studyflow_teacher', JSON.stringify({ uid: TEACH.uid, email: TEACH.email, name: 'Mr Okafor', classCode: CLASSCODE }));
      return fetch('/__reset', { method: 'POST' });
    }).then(function () {
      return mock([
        { match: 'A teacher is assigning the notes below', body: goalsReply() },
        { match: 'FIXED set of questions', body: assignmentReply() },
        { match: 'ONE more question', body: oneReply() }
      ]);
    }).then(function () { return frame('/teacher-build.html'); }).then(function (w) {
      var d = w.document;
      function click(sel) { var el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('no ' + sel); el.click(); }
      function vis(step) { var el = d.querySelector('[data-step="' + step + '"]'); return el && el.classList.contains('active'); }
      ok(vis('material'), 'the builder opens on the material');
      click('#go-material');
      ok(vis('material'), 'Continue with nothing typed stays put');
      d.getElementById('a-title').value = 'Photosynthesis homework';
      d.getElementById('a-notes').value = NOTES;
      d.getElementById('a-notes').dispatchEvent(new w.Event('input'));
      click('#go-material');
      ok(vis('kind'), 'material -> what it is for');
      click('[data-kind="homework"]');
      return waitFor(function () { return vis('grade'); }, 3000, 'grade step').then(function () {
        click('#go-grade');
        ok(vis('grade'), 'a grade is required');
        click('[data-grade="7th"]'); click('#go-grade');
        return waitFor(function () { return vis('goals') && d.querySelectorAll('#goals-box textarea').length === 3; }, 6000, 'goals');
      }).then(function () {
        ok(JSON.parse(localStorage.getItem('studyflow_teacher')).grade === '7th', 'the grade is remembered for next time');
        var tas = d.querySelectorAll('#goals-box textarea');
        ok(/materials/.test(tas[0].value), 'goals are proposed from the notes');
        /* The teacher edits one, unticks one, adds one. */
        tas[1].value = 'Name what goes in and what comes out'; tas[1].dispatchEvent(new w.Event('input', { bubbles: true }));
        var cb = d.querySelectorAll('#goals-box input[type=checkbox]')[2]; cb.checked = false; cb.dispatchEvent(new w.Event('change', { bubbles: true }));
        click('#add-goal');
        var t4 = d.querySelectorAll('#goals-box textarea')[3]; t4.value = 'Use photosynthesis to explain why plants need light'; t4.dispatchEvent(new w.Event('input', { bubbles: true }));
        click('#go-goals');
        ok(vis('misc'), 'goals -> misconceptions');
        d.getElementById('a-misc').value = 'They think plants get their food from the soil.';
        click('#go-misc');
        ok(vis('length'), 'misconceptions -> length');
        click('[data-len="10"]');
        ok(d.querySelectorAll('#fmt-chips [aria-pressed="true"]').length >= 3, 'formats are suggested for the subject (science)');
        click('[data-hint="0"]');
        click('#go-length');
        ok(vis('review'), 'length -> review');
        var rev = d.getElementById('rev').textContent;
        ok(/7th/.test(rev) && /Name what goes in/.test(rev) && !/Describe what happens in the chloroplast/.test(rev), 'the review shows the edited goals, not the unticked one', rev.slice(0, 300));
        ok(/6 /.test(d.getElementById('rev').textContent.replace(/\s+/g, ' ')) || /multiple choice/.test(rev), 'the review states the mix');
        click('#go-build');
        return waitFor(function () { return vis('preview') && d.querySelectorAll('.qcard').length; }, 15000, 'preview');
      }).then(function () {
        return fetch('/__calls').then(function (r) { return r.json(); });
      }).then(function (calls) {
        var p = calls.filter(function (c) { return /FIXED set of questions/.test(c); })[0] || '';
        ok(p.length > 0 && p.length < 60000, 'the assignment prompt is under the 60 000 cap', p.length);
        ok(/7th grade/.test(p) && /g1: Explain where a plant gets/.test(p) && /g2: Name what goes in/.test(p) && /g3: Use photosynthesis/.test(p) && !/chloroplast\n/.test(p.split('LEARNING GOALS')[1].split('RULES')[0].replace(/Use photosynthesis[^\n]*/, '')), 'the prompt carries the grade and exactly the ticked goals, renumbered', p.slice(0, 600));
        ok(/plants get their food from the soil/.test(p), 'the prompt carries the teacher\'s misconception');
        ok(/"goal":"","type":"mcq"/.test(p) && /exactly 6/.test(p), 'the schema asks for 6 questions, each with a goal', (p.match(/QUESTIONS:[^\n]*/) || [''])[0]);
        ok(/\}\]\}$/.test(p.trim()), 'the prompt still ends with an intact JSON schema');
        var d = w.document;
        var cards = d.querySelectorAll('.qcard');
        ok(cards.length === 5, 'the ungradeable fill is left out: 5 of 6 shown', cards.length);
        ok(!w.__pwned && !d.querySelector('#qlist img'), 'model text is shown as text, never markup');
        ok(/Hydrogen/.test(d.getElementById('qlist').textContent), 'the hostile option is still visible as words');
        ok(/✓|ok/.test(d.querySelector('.qcard .ok') ? 'ok' : ''), 'the right answer is marked on each card');
        ok(/teacher-build\.html\?id=[A-Z0-9]{12}/.test(w.location.href), 'the draft is saved at once and the address names it', w.location.href);
        BUILT = (/id=([A-Z0-9]{12})/.exec(w.location.href) || [])[1];
        var saved = BUILT && fsGet('classes/' + CLASSCODE + '/assignments/' + BUILT);
        ok(saved && saved.status === 'draft' && JSON.parse(saved.questions).length === 5, 'the draft is on the server with 5 questions');
        ok(saved && JSON.parse(saved.settings).hints === false && saved.dueAt.length === 16, 'no-hints and the due date and time are saved', saved && saved.dueAt);
        ok(saved && JSON.parse(saved.questions).every(function (q) { return /^q[a-z0-9]+$/.test(q.aid); }), 'every question has an id');
        /* Edit the first question's stem and its right option. */
        var first = cards[0];
        first.querySelector('[data-act="edit"]').click();
        var stem = first.querySelector('[data-e="question"]');
        stem.value = 'Which gas does a plant take in through its stomata?';
        var radios = first.querySelectorAll('input[type=radio]');
        radios[1].checked = true;
        first.querySelector('[data-act="save-edit"]').click();
        ok(/through its stomata\?/.test(d.querySelector('.qcard .qstem').textContent), 'an edit is applied to the card');
        /* An edit that cannot be graded is refused with a reason. */
        var fillCard = Array.prototype.filter.call(d.querySelectorAll('.qcard'), function (c) { return /Fill the gap/.test(c.textContent); })[0];
        fillCard.querySelector('[data-act="edit"]').click();
        fillCard.querySelector('[data-e="question"]').value = 'Explain it';
        fillCard.querySelector('[data-act="save-edit"]').click();
        ok(/can’t be graded/.test(fillCard.textContent), 'an edit that breaks a gap-fill is refused, with why');
        fillCard.querySelector('[data-act="cancel-edit"]').click();
        /* Delete one, add one. */
        var del = d.querySelectorAll('.qcard')[3].querySelector('[data-act="del"]');
        del.click();
        ok(d.querySelectorAll('.qcard').length === 4, 'delete removes a question');
        d.getElementById('add-type').value = 'mcq';
        d.getElementById('add-q').click();
        return waitFor(function () { return d.querySelectorAll('.qcard').length === 5; }, 8000, 'added question').then(function () {
          ok(/light reactions/.test(d.getElementById('qlist').textContent), 'add writes a new question of the chosen format');
          return fetch('/__calls').then(function (r) { return r.json(); });
        }).then(function (calls) {
          var one = calls.filter(function (c) { return /ONE more question/.test(c); })[0] || '';
          ok(/must not repeat/.test(one) && /stomata/.test(one), 'the one-question prompt lists the questions to avoid');
          d.getElementById('publish').click();
          return waitFor(function () { try { return /teacher\.html/.test(w.location.href) && w.document.readyState === 'complete' ? w : null; } catch (e) { return null; } }, 8000, 'teacher.html after publish')
            .catch(function () { return null; });
        });
      });
    }).then(function () {
      var saved = fsGet('classes/' + CLASSCODE + '/assignments/' + BUILT);
      ok(saved && saved.status === 'published', 'Publish publishes it', saved && saved.status);
      var qs = saved ? JSON.parse(saved.questions) : [];
      ok(qs.length === 5 && /through its stomata/.test(qs[0].question) && qs[0].correctIndex === 1, 'the published questions are the edited ones', qs.map(function (q) { return q.question; }));
      CR.BUILT = BUILT; CR.CLASSCODE = CLASSCODE;
    });
  }

  /* ── 4. A STUDENT DOES IT ─────────────────────────────────────────────── */
  function lessonWin() { var f = document.querySelector('#stage iframe'); return f && f.contentWindow; }
  function studentSuite() {
    var kid = CR.KIDS[0], id = CR.BUILT, code = CR.CLASSCODE;
    var OWN = { id: 'own1', subject: 'My own plan', days: [{ title: 'Own day', content: 'x', questions: [{ type: 'mcq', question: 'mine', options: ['a', 'b'], correctIndex: 0 }] }] };
    localStorage.clear();
    signInAs(kid);
    var ns = 'sfu:' + kid.email + '|';
    localStorage.setItem('studyflow_user', JSON.stringify({ email: kid.email, name: kid.name, classCode: code }));
    localStorage.setItem(ns + 'studyflow_plan', JSON.stringify(OWN));
    localStorage.setItem(ns + 'studyflow_plans', JSON.stringify([OWN]));
    localStorage.setItem(ns + 'studyflow_current_day', '0');
    var ownBefore = localStorage.getItem(ns + 'studyflow_plan');
    return mock([{ match: '.', body: { result: '{"score":7,"feedback":"ok"}' } }]).then(function () { return frame('/dashboard.html'); }).then(function (w) {
      return waitFor(function () { return w.document.querySelector('#asg-card:not([hidden]) [data-asg]'); }, 8000, 'assignment row').then(function (btn) {
        ok(/Photosynthesis homework/.test(w.document.getElementById('asg-rows').textContent), 'the dashboard lists the assignment');
        ok(/Due /.test(w.document.getElementById('asg-rows').textContent) && /Start/.test(btn.textContent), 'with its due date and a Start button');
        btn.click();
        return waitFor(function () { var lw = lessonWin(); return lw && /lesson\.html\?assignment=/.test(lw.location.href) && lw.sessionCards && lw.sessionCards.length ? lw : null; }, 10000, 'lesson opened');
      });
    }).then(function (lw) {
      ok(localStorage.getItem(ns + 'studyflow_plan') === ownBefore, 'opening the assignment leaves the student\'s own plan untouched');
      var cards = lw.sessionCards.map(function (c) { return c.type + (c.isPretest ? '*pre' : ''); });
      CR.queue = cards;
      ok(cards[0] === 'welcome' && cards.indexOf('pretest-intro') === -1 && !cards.some(function (c) { return /\*pre/.test(c); }), 'no pre-test in an assignment', cards);
      var qCards = lw.sessionCards.filter(function (c) { return c.asgCore; });
      ok(qCards.length === 5, 'exactly the 5 published questions, once each', qCards.length);
      ok(!lw.sessionCards.some(function (c) { return c.type === 'labeldiagram' || c.type === 'match'; }), 'no synthetic cards (no labelling, no vocabulary match)');
      ok(lw.sessionCards[lw.sessionCards.length - 1].asgClosing, 'one closing explain card, last');
      ok(lw.document.body.classList.contains('asg-nohints'), 'the teacher\'s "no hints" reaches the page');
      return waitFor(function () {
        var s = fsGet('classes/' + code + '/assignments/' + id + '/submissions/' + kid.uid);
        return s && s.status === 'in_progress';
      }, 5000, 'in-progress submission').then(function () {
        ok(true, 'the teacher sees "in progress" from the first card');
        return walk(lw);
      });
    }).then(function (walked) {
      var lw = lessonWin();
      ok(walked.returns.length >= 2, 'a missed question came back', walked.returns);
      var mcqRet = walked.returns.filter(function (r) { return r.aid === walked.missAid; });
      ok(mcqRet.length === 2, 'missed twice, it came back twice and no more', mcqRet);
      if (mcqRet.length === 2) {
        ok(mcqRet[0].gap >= 2 && mcqRet[0].gap <= 4, 'first return about three cards later', mcqRet[0].gap);
        /* Further out - unless the run is nearly over, when it waits just
           before the closing explain card, which always stays last. */
        ok(mcqRet[1].gap > mcqRet[0].gap || mcqRet[1].beforeClosing, 'second return further out (or in the last stretch, before the closing card)', mcqRet[1]);
      }
      return waitFor(function () {
        var s = fsGet('classes/' + code + '/assignments/' + id + '/submissions/' + kid.uid);
        return s && s.status === 'done' ? s : null;
      }, 8000, 'done submission').then(function (s) {
        var ans = JSON.parse(s.answers);
        ok(ans[walked.missAid] && ans[walked.missAid].f === 0 && ans[walked.missAid].r === 2 && !ans[walked.missAid].rc, 'the always-missed question: first try wrong, two returns, not recovered', ans[walked.missAid]);
        ok(ans[walked.missAid] && ans[walked.missAid].a && !/—/.test(ans[walked.missAid].a), 'what the student answered is recorded as words', ans[walked.missAid] && ans[walked.missAid].a);
        var rec = walked.recAid && ans[walked.recAid];
        ok(rec && rec.f === 0 && rec.rc === true, 'missed then right on return = recovered', rec);
        ok(Object.keys(ans).length === 5, 'every question answered once is in the submission', Object.keys(ans).length);
        return waitFor(function () { return lw.document.getElementById('asg-handin') && lw.document.getElementById('asg-handin').getAttribute('data-ok') === '1'; }, 5000, 'handed in note');
      }).then(function () {
        ok(/Handed in/.test(lw.document.getElementById('results-wrap').textContent), 'the results say "Handed in"');
        ok(localStorage.getItem(ns + 'studyflow_plan') === ownBefore, 'after the whole session the student\'s own plan is byte-identical');
        ok(!!localStorage.getItem(ns + 'studyflow_asg_' + id + '__studyflow_plan'), 'the assignment kept its own copy, in its own namespace');
      });
    }).then(function () {
      /* Coming back to a finished assignment. */
      return frame('/lesson.html?assignment=' + id).then(function (lw) {
        return waitFor(function () { return /Assignment handed in/.test(lw.document.body.textContent); }, 6000, 'already done');
      }).then(function () { ok(true, 'reopening a finished assignment says it is handed in'); });
    }).then(function () {
      return frame('/dashboard.html').then(function (w) {
        return waitFor(function () { return /Handed in/.test((w.document.getElementById('asg-rows') || {}).textContent || ''); }, 8000, 'handed-in row');
      }).then(function () { ok(true, 'the dashboard shows it handed in, with the score'); });
    });
  }

  /* Answers every question card: the first core question WRONG every time
     it appears, the second wrong first and right on its return, the rest
     right. Records where each return landed. */
  function walk(lw) {
    var seen = {}, returns = [], firstAt = {}, steps = 0, missAid = null, recAid = null, coreOrder = [];
    lw.sessionCards.forEach(function (c) { if (c.asgCore) coreOrder.push(c.q.aid); });
    var mcqs = lw.sessionCards.filter(function (c) { return c.asgCore && (c.q.type === 'mcq' || c.q.type === 'truefalse'); });
    missAid = mcqs[0] && mcqs[0].q.aid;
    recAid = mcqs[1] && mcqs[1].q.aid;
    function answer() {
      var card = lw.currentCard, d = lw.document;
      if (!card || !card.q || !card.q.aid) return false;
      var aid = card.q.aid, wantWrong = aid === missAid || (aid === recAid && !card.asgReturn);
      if (card.asgReturn) {
        /* "The run is nearly over": nothing after this card is a first try
           at a question - only other returns and the closing card. */
        var tailOnly = lw.sessionCards.slice(lw.cardIndex).every(function (c) { return c.asgReturn || c.asgClosing || !c.q; });
        returns.push({ aid: aid, at: lw.cardIndex - 1, gap: lw.cardIndex - 1 - (seen[aid] != null ? seen[aid] : -99),
                       beforeClosing: tailOnly });
      }
      seen[aid] = lw.cardIndex - 1;
      if (firstAt[aid] == null) firstAt[aid] = lw.cardIndex - 1;
      var t = card.q.type;
      if (t === 'mcq' || t === 'truefalse') {
        var btns = d.querySelectorAll('#session-card .q-option, #session-card .tf-btn');
        var right = -1;
        Array.prototype.forEach.call(btns, function (b, i) {
          var m = /answer(?:MCQ|TF)\(this,\s*'?([^,']+)'?,\s*'?([^,']+)'?/.exec(b.getAttribute('onclick') || '');
          if (m && m[1] === m[2]) right = i;
        });
        var pick = wantWrong ? (right === 0 ? 1 : 0) : right;
        if (btns[pick]) btns[pick].click();
        return true;
      }
      if (t === 'fill') {
        var inp = d.querySelector('#session-card input[type=text], #session-card input:not([type])');
        if (inp) { inp.value = wantWrong ? 'mitochondria' : card.q.answer; }
        var b = d.querySelector('#fill-check, #btn-check, [onclick*="answerFill"]');
        if (b) b.click(); else if (lw.answerFillBtn) lw.answerFillBtn();
        return true;
      }
      if (t === 'whosright') {
        var st = lw._whoState, idx = -1;
        (st.claims || []).forEach(function (c, i) { if (c.right) idx = i; });
        lw.whoPick(wantWrong ? (idx === 0 ? 1 : 0) : idx);
        return true;
      }
      if (t === 'recall') {
        var slots = d.querySelectorAll('#session-card .rc-in');
        (card.q.items || []).forEach(function (it, i) { if (slots[i]) slots[i].value = String(it).split(' / ')[0]; });
        lw.rcInput();
        lw.checkRecall();
        return true;
      }
      return false;
    }
    return new Promise(function (resolve) {
      (function step() {
        steps++;
        if (steps > 120) { ok(false, 'the session finished within 120 steps', lw.cardIndex + ' / ' + lw.sessionCards.length); return resolve({ returns: returns, missAid: missAid, recAid: recAid }); }
        if (!lw.sessionActive) return resolve({ returns: returns, missAid: missAid, recAid: recAid });
        var c = lw.currentCard || {};
        if (c.type === 'done') { lw.endSession(); return resolve({ returns: returns, missAid: missAid, recAid: recAid }); }
        try { if (!lw.currentAnswered) answer(); } catch (e) { log('ERROR answering ' + (c.q && c.q.type) + ': ' + e); }
        setTimeout(function () { try { lw.showNextCard(); } catch (e) { log('ERROR next ' + e); } setTimeout(step, 80); }, 120);
      })();
    });
  }

  /* ── 4b. RETURNS ON A LONGER ASSIGNMENT ────────────────────────────────
     Ten true/false questions: room for a miss to come back about three
     cards later and then about six. */
  function returnsSuite() {
    var code = CR.CLASSCODE, kid = CR.KIDS[1], id;
    var qs = [];
    for (var i = 0; i < 10; i++) qs.push({ type: 'truefalse', question: 'Statement number ' + (i + 1) + ' about plants is true.', correct: i % 2 ? 'False' : 'True', explanation: 'Because.' });
    return POST(TEACH.tok, { action: 'save-assignment', classCode: code, assignment: { title: 'Ten statements', kind: 'check', minutes: 10, questions: qs, lesson: {} } })
      .then(function (r) { id = r.body.assignment.id; return POST(TEACH.tok, { action: 'publish-assignment', classCode: code, id: id }); })
      .then(function () {
        localStorage.clear();
        signInAs(kid);
        localStorage.setItem('studyflow_user', JSON.stringify({ email: kid.email, name: kid.name, classCode: code }));
        return frame('/dashboard.html');
      }).then(function (w) {
        return waitFor(function () { return w.document.querySelector('[data-asg="' + id + '"]'); }, 8000, 'row').then(function (b) {
          b.click();
          return waitFor(function () { var lw = lessonWin(); return lw && /assignment=/.test(lw.location.href) && lw.sessionCards && lw.sessionCards.length ? lw : null; }, 10000, 'lesson');
        });
      }).then(function (lw) {
        ok(!lw.sessionCards.some(function (c) { return c.type === 'lesson' || c.type === 'flashcards'; }), 'a quick check with no lesson goes straight to the questions');
        return walk(lw);
      }).then(function (walked) {
        var r = walked.returns.filter(function (x) { return x.aid === walked.missAid; });
        ok(r.length === 2, 'a question missed every time comes back exactly twice', r);
        ok(r[0] && r[0].gap === 4, 'first return: three cards in between', r[0]);
        ok(r[1] && r[1].gap === 7, 'second return: six cards in between', r[1]);
        var rc = walked.returns.filter(function (x) { return x.aid === walked.recAid; });
        ok(rc.length === 1, 'a question fixed on its return does not come back again', rc);
      });
  }

  /* ── 5. THE TEACHER READS THE RESULT ─────────────────────────────────── */
  function resultsSuite() {
    var code = CR.CLASSCODE, id = CR.BUILT;
    /* Two more students: one done with a shared wrong answer, one not started. */
    var built = JSON.parse(fsGet('classes/' + code + '/assignments/' + id).questions);
    var first = built.filter(function (q) { return q.type === 'mcq' || q.type === 'truefalse'; })[0];
    var ans = {}; ans[first.aid] = { f: 0, a: CR.firstWrongText || 'Oxygen' };
    return POST(CR.KIDS[1].tok, { action: 'submit', classCode: code, id: id, status: 'done', answers: ans }).then(function () {
      localStorage.clear();
      signInAs(TEACH);
      localStorage.setItem('studyflow_teacher', JSON.stringify({ uid: TEACH.uid, email: TEACH.email, name: 'Mr Okafor', classCode: code }));
      return frame('/teacher.html?published=' + id + '#assignments');
    }).then(function (w) {
      return waitFor(function () { var b = w.document.getElementById('asg-results'); return b && !b.hidden && /Question by question/.test(b.textContent) ? b : null; }, 8000, 'results view').then(function (box) {
        var t = box.textContent.replace(/\s+/g, ' ');
        CR.resultsText = t;
        ok(/2 \/ 3/.test(t), 'two of three done', t.slice(0, 300));
        ok(/Not started: Cai/.test(t), 'the student who has not started is named');
        ok(/By goal/.test(t) && /Weakest goal/.test(t), 'results are grouped by goal, with the weakest named');
        ok(/2 of 2 who missed it answered/.test(t), 'the most common wrong answer is counted', t.match(/\d of \d who missed it answered[^”]*”/));
        ok(/0 of 2 right first time/.test(t) && /Missed/.test(t), 'per question: right first time, and each student\'s answer');
        ok(!w.document.querySelector('#asg-results img, #asg-results script'), 'no student text renders as markup');
      });
    });
  }

  window.runClassroom = function (only) {
    CR.pass = 0; CR.fail = 0; CR.log = []; CR.done = false;
    var suites = [['api', apiSuite], ['webhook', webhookSuite], ['builder', builderSuite], ['student', studentSuite], ['returns', returnsSuite], ['results', resultsSuite]];
    var chain = Promise.all(['api/_firestore.js', 'api/class.js', 'api/webhook.js'].map(loadSrc)).then(function () {
      classHandler = makeModule('api/class.js', ENV);
    });
    suites.forEach(function (s) {
      if (only && only.indexOf(s[0]) < 0) return;
      chain = chain.then(function () { log('── ' + s[0]); return s[1](); })
        .catch(function (e) { CR.fail++; log('ERROR in ' + s[0] + ': ' + (e && e.stack || e)); });
    });
    return chain.then(function () { CR.done = true; log('DONE ' + CR.pass + ' passed, ' + CR.fail + ' failed'); return window.classroomSummary(); });
  };
})();

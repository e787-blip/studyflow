/* sf-auth.js — the signed-in Firebase user, for pages that do not load Firebase.

   login.html and teacher-login.html sign in with the Firebase SDK. The other
   pages (app, dashboard, lesson, teacher) never loaded it, and until now they
   did not need to: api/class trusted whatever the page sent. It now checks a
   Firebase ID token on every call (see api/class.js), so those pages need one.

   Loading the whole SDK on a 1 MB lesson page to read a token is a lot. The
   SDK already keeps the session where any page on this origin can read it -
   localStorage or sessionStorage when "Keep me signed in" chose one,
   IndexedDB otherwise - and an expired ID token is swapped for a fresh one
   with the stored refresh token over the same REST endpoint the SDK uses.
   This file does exactly that and nothing more. It never writes to the SDK's
   storage: a sign-out in login.html still signs this page out too.

   SFAuth.idToken(email)     -> Promise<token|null>. With `email`, null unless
                                the session belongs to that account (a teacher
                                signed in on a student's browser is not them).
   SFAuth.classFetch(url, opts, email)
                             -> fetch() with the token attached. Signed out, it
                                resolves to a 401-shaped response instead of
                                calling the server, so callers keep one path.
   SFAuth.apiFetch(url, opts) -> fetch() to api/generate, api/chat,
                                api/extract or api/checkout with the token of
                                whoever is signed in here, when there is one.
                                Signed out it still calls, and the server
                                answers 401 (sign_in_required) - the pages
                                show "Sign in again" on that status.
   SFAuth.refreshTier(opts)  -> Promise<tier|null>. Asks api/account what the
                                signed-in account has paid for and writes it
                                into studyflow_user.tier, firing `sf-tier` on
                                window when it changed. Runs by itself once per
                                page load. Any failure (offline, signed out,
                                another account's session) leaves the stored
                                tier as it was.

   Oct 2026: the plan used to live ONLY in studyflow_user.tier, which the
   pages wrote themselves - dashboard.html?upgraded=vip was VIP for free, and
   a paying learner was Free on a new device. That copy is now a cache of
   what the server says, and the server enforces what matters itself. */
(function () {
  var API_KEY = 'AIzaSyCY4FI-6L9tsAokNFl6o5bsmCt-JD0H8HI';
  var STORE_KEY = 'firebase:authUser:' + API_KEY + ':[DEFAULT]';
  var fresh = null; // { uid, token, exp } — a token this page refreshed

  function parse(raw) {
    try {
      var u = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return u && u.uid && u.stsTokenManager ? u : null;
    } catch (e) { return null; }
  }

  function fromWebStorage() {
    var u = null;
    try { u = parse(window.sessionStorage.getItem(STORE_KEY)); } catch (e) {}
    if (!u) { try { u = parse(window.localStorage.getItem(STORE_KEY)); } catch (e) {} }
    return u;
  }

  function fromIndexedDB() {
    return new Promise(function (resolve) {
      try {
        if (!window.indexedDB) return resolve(null);
        var req = window.indexedDB.open('firebaseLocalStorageDb');
        /* The database does not exist yet: abort, so this read does not
           create an empty one for the SDK to trip over later. */
        req.onupgradeneeded = function () { try { req.transaction.abort(); } catch (e) {} };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
        req.onsuccess = function () {
          var db = req.result;
          try {
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) { db.close(); return resolve(null); }
            var get = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').get(STORE_KEY);
            get.onsuccess = function () { db.close(); resolve(get.result ? parse(get.result.value) : null); };
            get.onerror = function () { db.close(); resolve(null); };
          } catch (e) { try { db.close(); } catch (e2) {} resolve(null); }
        };
      } catch (e) { resolve(null); }
    });
  }

  function user() {
    var u = fromWebStorage();
    return u ? Promise.resolve(u) : fromIndexedDB();
  }

  function same(a, b) { return String(a || '').toLowerCase().trim() === String(b || '').toLowerCase().trim(); }

  function idToken(email) {
    return user().then(function (u) {
      if (!u) return null;
      if (email && !same(u.email, email)) return null;
      var now = Date.now();
      if (fresh && fresh.uid === u.uid && fresh.exp - 60000 > now) return fresh.token;
      var st = u.stsTokenManager || {};
      if (st.accessToken && Number(st.expirationTime) - 60000 > now) return st.accessToken;
      if (!st.refreshToken) return null;
      return fetch('https://securetoken.googleapis.com/v1/token?key=' + API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(st.refreshToken)
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.id_token) return null;
          fresh = { uid: u.uid, token: d.id_token, exp: now + (Number(d.expires_in) || 3600) * 1000 };
          return d.id_token;
        })
        .catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function signedOut() {
    var body = { error: 'sign_in_required', message: 'Sign in again to use your class.' };
    return { ok: false, status: 401, json: function () { return Promise.resolve(body); } };
  }

  function classFetch(url, opts, email) {
    opts = opts || {};
    return idToken(email).then(function (token) {
      if (!token) return signedOut();
      var headers = {};
      var h = opts.headers || {};
      for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) headers[k] = h[k];
      headers.Authorization = 'Bearer ' + token;
      var o = {};
      for (var j in opts) if (Object.prototype.hasOwnProperty.call(opts, j)) o[j] = opts[j];
      o.headers = headers;
      return fetch(url, o);
    });
  }

  function withToken(opts, token) {
    var o = {}, headers = {};
    opts = opts || {};
    for (var j in opts) if (Object.prototype.hasOwnProperty.call(opts, j)) o[j] = opts[j];
    var h = opts.headers || {};
    for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) headers[k] = h[k];
    if (token) headers.Authorization = 'Bearer ' + token;
    o.headers = headers;
    return o;
  }

  function apiFetch(url, opts) {
    return idToken().then(function (token) { return fetch(url, withToken(opts, token)); });
  }

  function storedUser() {
    try { return JSON.parse(window.localStorage.getItem('studyflow_user') || 'null'); } catch (e) { return null; }
  }

  var TIERS = { free: 1, pro: 1, vip: 1, classroom: 1, school: 1 };

  function refreshTier(opts) {
    opts = opts || {};
    var u = storedUser();
    if (!u || !u.email) return Promise.resolve(null);
    /* Only this account's own session: a teacher signed in on a student's
       laptop must not hand the student the teacher's plan. */
    return idToken(u.email).then(function (token) {
      if (!token) return null;
      return fetch('/api/account' + (opts.fresh ? '?fresh=1' : ''), {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store'
      }).then(function (r) { return r.ok ? r.json() : null; });
    }).then(function (d) {
      var tier = d && typeof d.tier === 'string' ? d.tier.toLowerCase() : '';
      if (!TIERS[tier]) return null;
      var now = storedUser();
      if (!now || !same(now.email, u.email)) return null;   // signed out or switched meanwhile
      if (now.tier !== tier) {
        var was = now.tier || 'free';
        now.tier = tier;
        try { window.localStorage.setItem('studyflow_user', JSON.stringify(now)); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('sf-tier', { detail: { tier: tier, was: was } })); } catch (e) {}
      }
      return tier;
    }).catch(function () { return null; });
  }

  window.SFAuth = { user: user, idToken: idToken, classFetch: classFetch, apiFetch: apiFetch, refreshTier: refreshTier };

  /* Once per page load, after the page's own script has read the stored
     tier: a change arrives as `sf-tier`. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { refreshTier(); });
  else refreshTier();
})();

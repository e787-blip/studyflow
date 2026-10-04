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
                                calling the server, so callers keep one path. */
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

  window.SFAuth = { user: user, idToken: idToken, classFetch: classFetch };
})();

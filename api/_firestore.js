'use strict';
/* ── Firestore, as the service account — shared by api/class.js and
   api/webhook.js ──────────────────────────────────────────────────────────
   The leading underscore keeps Vercel from serving this file as an endpoint;
   it is only ever require()d.

   Moved out of class.js (Oct 2026) because the Stripe webhook needs the same
   thing and did not have it: it wrote the paid tier with
   `Authorization: Bearer ${FIREBASE_SERVICE_KEY}`, a fixed key, where
   Firestore wants a short-lived OAuth token. With firestore.rules denying all
   client access, that write could not land, so a teacher's paid Classroom
   plan was never recorded anywhere the server could read it.

   FIREBASE_SERVICE_ACCOUNT is the whole JSON key file, pasted into Vercel. */

const crypto = require('crypto');

const FIREBASE_PROJECT = 'studyflow-e59ef';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const FETCH_TIMEOUT_MS = 8000;

/* Fields stored as a JSON string and handed back parsed. Everything else that
   is a string comes back a string. */
const JSON_FIELDS = { students: [], questions: [], lesson: null, goals: [], settings: null, answers: null };

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function serviceAccount() {
  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '');
    if (!sa.client_email || !sa.private_key) return null;
    // Pasted into an env var, the key's newlines often arrive as "\n".
    return { client_email: sa.client_email, private_key: String(sa.private_key).replace(/\\n/g, '\n') };
  } catch { return null; }
}

let adminTok = null; // { token, exp }

async function adminToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (adminTok && adminTok.exp - 120 > now) return adminTok.token;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
          '&assertion=' + encodeURIComponent(unsigned + '.' + sig)
  });
  const data = await r.json().catch(() => ({}));
  if (!data.access_token) throw new Error('Service account token refused: ' + JSON.stringify(data).slice(0, 200));
  adminTok = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return adminTok.token;
}

function makeDb(sa) {
  async function call(url, opts = {}) {
    const token = await adminToken(sa);
    const r = await fetchWithTimeout(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }
  return {
    // → { data, updateTime } or null when the document does not exist
    async get(path) {
      const { status, data } = await call(`${FIRESTORE_BASE}/${path}`);
      if (status === 404) return null;
      if (data.error) throw new Error(`get ${path}: ${JSON.stringify(data.error)}`);
      return { data: parseFirestore(data), updateTime: data.updateTime };
    },
    // → true, or false when a document with that id already exists
    async create(collection, id, obj) {
      const { status, data } = await call(
        `${FIRESTORE_BASE}/${collection}?documentId=${encodeURIComponent(id)}`,
        { method: 'POST', body: JSON.stringify(toFirestore(obj)) }
      );
      if (status === 409) return false;
      if (data.error) throw new Error(`create ${collection}/${id}: ${JSON.stringify(data.error)}`);
      return true;
    },
    /* Replaces the document's fields. With `updateTime`, the write only lands
       if nobody wrote in between; false means try again. The roster is one
       JSON string, so two students syncing at once used to drop one of the
       two updates, and two joins at once could both pass the size cap. */
    async put(path, obj, updateTime) {
      const pre = updateTime ? `?currentDocument.updateTime=${encodeURIComponent(updateTime)}` : '';
      const { status, data } = await call(`${FIRESTORE_BASE}/${path}${pre}`,
        { method: 'PATCH', body: JSON.stringify(toFirestore(obj)) });
      if (updateTime && (status === 400 || status === 409) &&
          /FAILED_PRECONDITION|ABORTED/.test(JSON.stringify(data.error || ''))) return false;
      if (data.error) throw new Error(`put ${path}: ${JSON.stringify(data.error)}`);
      return true;
    },
    /* Writes only the named fields and leaves the rest of the document alone
       (creating it if it is missing). */
    async patch(path, obj) {
      const mask = Object.keys(obj).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
      const { data } = await call(`${FIRESTORE_BASE}/${path}?${mask}`,
        { method: 'PATCH', body: JSON.stringify(toFirestore(obj)) });
      if (data.error) throw new Error(`patch ${path}: ${JSON.stringify(data.error)}`);
      return true;
    },
    async remove(path) {
      const { status, data } = await call(`${FIRESTORE_BASE}/${path}`, { method: 'DELETE' });
      if (status === 404) return true;
      if (data.error) throw new Error(`remove ${path}: ${JSON.stringify(data.error)}`);
      return true;
    },
    /* Every document in a collection, as [{ id, data, updateTime }]. `fields`
       limits what comes back, so a list of assignments does not carry every
       assignment's questions. */
    async list(collection, fields) {
      const mask = (fields || []).map(f => '&mask.fieldPaths=' + encodeURIComponent(f)).join('');
      const out = [];
      let pageToken = '';
      for (let page = 0; page < 10; page++) {
        const { status, data } = await call(`${FIRESTORE_BASE}/${collection}?pageSize=300${mask}` +
          (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
        if (status === 404) return out;
        if (data.error) throw new Error(`list ${collection}: ${JSON.stringify(data.error)}`);
        (data.documents || []).forEach(d => out.push({
          id: String(d.name || '').split('/').pop(), data: parseFirestore(d), updateTime: d.updateTime
        }));
        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
      }
      return out;
    }
  };
}

function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string')       fields[key] = { stringValue: val };
    /* A fraction sent as integerValue is refused by Firestore. */
    else if (typeof val === 'number')  fields[key] = Number.isInteger(val) ? { integerValue: val } : { doubleValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (val === null || val === undefined) fields[key] = { nullValue: null };
    else fields[key] = { stringValue: JSON.stringify(val) };
  }
  return { fields };
}

function parseFirestore(doc) {
  if (!doc?.fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    if (val.stringValue !== undefined) {
      // Only attempt JSON parse for known structured fields
      if (Object.prototype.hasOwnProperty.call(JSON_FIELDS, key)) {
        try { obj[key] = JSON.parse(val.stringValue); } catch { obj[key] = JSON_FIELDS[key]; }
      } else {
        obj[key] = val.stringValue;
      }
    } else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.doubleValue !== undefined) obj[key] = Number(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else obj[key] = null;
  }
  return obj;
}

module.exports = { FIRESTORE_BASE, fetchWithTimeout, serviceAccount, adminToken, makeDb, toFirestore, parseFirestore };

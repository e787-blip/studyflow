'use strict';
/* ── The classroom API ─────────────────────────────────────────────────────
   Every request carries the caller's Firebase ID token
   (`Authorization: Bearer <token>`) and is checked here before Firestore is
   touched:

     teacher of the class   read the roster, set the assignment
     student in the class   read the assignment, update their OWN record
     any signed-in user     join a class, set themselves up as a teacher

   This used to check nothing. A 4-character class code was the only key, so
   anyone could read every student's name and email, overwrite the
   assignment, or write a student record carrying markup that teacher.html
   then rendered as live HTML.

   Firestore is reached with a SERVICE ACCOUNT (env FIREBASE_SERVICE_ACCOUNT,
   the JSON key file), not the public web API key. That is what lets the
   database's own rules deny all client access (see firestore.rules): with the
   web key, the rules had to be open, and the checks below could be skipped by
   calling Firestore directly. Without the service account the classroom
   answers 503 rather than falling back to the open path. */

const crypto = require('crypto');

const FIREBASE_PROJECT = 'studyflow-e59ef';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const MAX_STUDENTS = 5;
const FETCH_TIMEOUT_MS = 8000;

/* Old classes were minted with 4 characters (1.7M codes, cheap to walk);
   new ones get 6 from a 32-character alphabet (~1.07 billion). Letters only
   ever reach a Firestore path through this pattern, which is also what stops
   path traversal. */
const CLASS_CODE_RE = /^SF-(?:[A-Z0-9]{4}|[A-Z0-9]{6})$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

const LIMITS = { name: 60, school: 100, subject: 80, topic: 120, notes: 50000 };

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function safeError(err, generic = 'Internal server error') {
  console.error('[class.js]', err);         // full detail server-side only
  return generic;                            // generic message to client
}

class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

// ── Who is asking ─────────────────────────────────────────────────────────

/* accounts:lookup rejects an expired or forged token, so a token that comes
   back with a user is a real, current sign-in. Cached briefly: a teacher's
   dashboard makes three calls on load. */
const userCache = new Map();
const USER_CACHE_MS = 5 * 60 * 1000;

async function verifyUser(req, apiKey) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
  if (!m || m[1].length > 4096) return null;
  const token = m[1];
  const hit = userCache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;

  const r = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
  );
  const data = await r.json().catch(() => ({}));
  const u = data.users && data.users[0];
  if (!u || !u.localId || !u.email || u.disabled) return null;

  const user = { uid: u.localId, email: String(u.email).toLowerCase().trim(), name: u.displayName || '' };
  if (userCache.size > 500) userCache.clear();
  userCache.set(token, { user, until: Date.now() + USER_CACHE_MS });
  return user;
}

// ── Firestore, as the service account ─────────────────────────────────────

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
    }
  };
}

/* Read, change, write, retrying when someone else wrote in between.
   `change` returns the new fields, or throws an HttpError to stop. */
async function updateClass(db, code, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await db.get(`classes/${code}`);
    if (!doc) throw new HttpError(404, 'no_such_class', 'No class with that code.');
    const cls = doc.data;
    cls.students = parseStudents(cls.students);
    const result = change(cls);
    if (await db.put(`classes/${code}`, { ...cls, students: JSON.stringify(cls.students) }, doc.updateTime)) return result;
  }
  throw new HttpError(503, 'busy', 'The class is busy. Try again.');
}

// ── Cleaning what clients send ────────────────────────────────────────────

function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanInt(v, min, max) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

/* The only fields a student can write about themselves. Anything else in the
   payload (email, uid, someone else's name) is ignored: the record is keyed
   by the verified token, never by what the body claims. */
function cleanStats(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  if ('name' in d) { const n = cleanText(d.name, LIMITS.name); if (n) out.name = n; }
  if ('subject' in d) out.subject = cleanText(d.subject, LIMITS.subject);
  if ('lastActive' in d) out.lastActive = cleanText(d.lastActive, 40) || null;
  if ('streak' in d) out.streak = cleanInt(d.streak, 0, 3650) || 0;
  if ('avgScore' in d) out.avgScore = d.avgScore === null ? null : cleanInt(d.avgScore, 0, 100);
  if ('questionsAnswered' in d) out.questionsAnswered = cleanInt(d.questionsAnswered, 0, 1e6) || 0;
  if ('timeStudied' in d) out.timeStudied = cleanInt(d.timeStudied, 0, 1e8) || 0;
  return out;
}

function findStudent(cls, user) {
  return cls.students.findIndex(s => (s.uid && s.uid === user.uid) ||
    (!s.uid && String(s.email || '').toLowerCase() === user.email));
}

function newCode() {
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]; // 256 % 32 = 0: unbiased
  return 'SF-' + s;
}

// What a teacher sees of a student: no uid.
function publicStudent(s) {
  const { uid, ...rest } = s;
  return rest;
}

// ── Handler ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.FIREBASE_API_KEY;
  const sa = serviceAccount();
  if (!API_KEY || !sa)
    return res.status(503).json({ error: 'classroom_not_configured', message: 'Classrooms are not set up on the server yet.' });
  const db = makeDb(sa);

  try {
    const user = await verifyUser(req, API_KEY);
    if (!user) return res.status(401).json({ error: 'sign_in_required', message: 'Sign in again to use your class.' });

    const q = req.query || {};

    // ── GET: the signed-in teacher's profile ──────────────────────────────
    if (req.method === 'GET' && q.type === 'teacher') {
      const t = await db.get(`teachers/${user.uid}`);
      return res.status(200).json({ teacher: t ? t.data : null });
    }

    if (req.method === 'GET') {
      const code = String(q.classCode || '');
      if (!CLASS_CODE_RE.test(code)) return res.status(400).json({ error: 'Invalid class code format' });
      const doc = await db.get(`classes/${code}`);
      if (!doc) return res.status(404).json({ error: 'no_such_class' });
      const cls = doc.data;
      cls.students = parseStudents(cls.students);
      const isTeacher = !!cls.teacherUid && cls.teacherUid === user.uid;

      // ── GET assignment: the teacher, or a student in the class ─────────
      if (q.type === 'assignment') {
        if (!isTeacher && findStudent(cls, user) < 0) return res.status(403).json({ error: 'not_in_class' });
        const a = await db.get(`assignments/${code}`);
        return res.status(200).json({ assignment: a ? a.data : null });
      }

      // ── GET roster: the teacher only ───────────────────────────────────
      if (!isTeacher) return res.status(403).json({ error: 'not_your_class' });
      return res.status(200).json({
        classCode: code,
        teacherName: cls.teacherName || '',
        createdAt: cls.createdAt || null,
        students: cls.students.map(publicStudent)
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};
    const action = body.action;

    // ── teacher-setup: make (or return) this account's classroom ─────────
    if (action === 'teacher-setup') {
      const existing = await db.get(`teachers/${user.uid}`);
      if (existing) return res.status(200).json({ teacher: existing.data });

      const name = cleanText(body.name, LIMITS.name) || user.name;
      const school = cleanText(body.school, LIMITS.school);
      if (!name || name.length < 2) return res.status(400).json({ error: 'missing_name', message: 'Please enter your name.' });
      const now = new Date().toISOString();

      /* A class made before teacher accounts were real has no owner. The
         teacher who still holds its code in this browser can claim it once,
         and keep its students. Once owned, nobody else can. */
      let code = null;
      const claim = String(body.claimCode || '');
      if (CLASS_CODE_RE.test(claim)) {
        const doc = await db.get(`classes/${claim}`);
        if (doc && !doc.data.teacherUid) {
          const ok = await db.put(`classes/${claim}`, {
            ...doc.data,
            students: JSON.stringify(parseStudents(doc.data.students)),
            teacherUid: user.uid,
            teacherName: name
          }, doc.updateTime);
          if (ok) code = claim;
        } else if (!doc) {
          if (await db.create('classes', claim, { classCode: claim, teacherUid: user.uid, teacherName: name, students: '[]', createdAt: now })) code = claim;
        }
      }
      for (let i = 0; !code && i < 6; i++) {
        const c = newCode();
        if (await db.create('classes', c, { classCode: c, teacherUid: user.uid, teacherName: name, students: '[]', createdAt: now })) code = c;
      }
      if (!code) throw new Error('Could not mint a class code');

      const teacher = { name, school, email: user.email, classCode: code, createdAt: now };
      if (!(await db.create('teachers', user.uid, teacher))) {
        // Two setups raced; the first one's classroom is the account's.
        const t = await db.get(`teachers/${user.uid}`);
        return res.status(200).json({ teacher: t ? t.data : teacher });
      }
      return res.status(200).json({ teacher });
    }

    const code = String(body.classCode || '');
    if (!CLASS_CODE_RE.test(code)) return res.status(400).json({ error: 'Invalid class code format' });

    // ── join: add the signed-in student to the class ──────────────────────
    if (action === 'join') {
      const name = cleanText(body.studentData && body.studentData.name, LIMITS.name) || user.name || user.email.split('@')[0];
      const result = await updateClass(db, code, (cls) => {
        if (cls.teacherUid && cls.teacherUid === user.uid)
          throw new HttpError(400, 'own_class', 'That is your own class code.');
        const idx = findStudent(cls, user);
        if (idx >= 0) {
          cls.students[idx] = { ...cls.students[idx], uid: user.uid, email: user.email, name };
        } else {
          if (cls.students.length >= MAX_STUDENTS)
            throw new HttpError(200, 'class_full', `This class is full (max ${MAX_STUDENTS} students).`);
          cls.students.push({
            uid: user.uid, email: user.email, name, joinedAt: new Date().toISOString(),
            streak: 0, avgScore: null, lastActive: null, questionsAnswered: 0, timeStudied: 0, subject: ''
          });
        }
        return { success: true, studentCount: cls.students.length };
      });
      return res.status(200).json(result);
    }

    // ── sync: a student updates their own record ──────────────────────────
    if (action === 'sync') {
      const stats = cleanStats(body.studentData);
      await updateClass(db, code, (cls) => {
        const idx = findStudent(cls, user);
        if (idx < 0) throw new HttpError(403, 'not_in_class', 'You are not in this class.');
        cls.students[idx] = { ...cls.students[idx], ...stats, uid: user.uid, email: user.email };
      });
      return res.status(200).json({ success: true });
    }

    // ── assign: the teacher sets the class's lesson ───────────────────────
    if (action === 'assign') {
      const a = body.assignment;
      if (!a || typeof a !== 'object') return res.status(400).json({ error: 'Missing assignment payload' });
      const doc = await db.get(`classes/${code}`);
      if (!doc) return res.status(404).json({ error: 'no_such_class' });
      if (!doc.data.teacherUid || doc.data.teacherUid !== user.uid) return res.status(403).json({ error: 'not_your_class' });

      const topic = cleanText(a.topic, LIMITS.topic);
      const notes = typeof a.notes === 'string' ? a.notes.slice(0, LIMITS.notes) : '';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date || '')) ? a.date : '';
      if (!topic || !notes.trim()) return res.status(400).json({ error: 'missing_fields', message: 'A topic and notes are needed.' });
      const assignment = {
        topic, notes, date,
        assignedAt: new Date().toISOString(),
        classCode: code,
        teacherName: doc.data.teacherName || ''
      };
      await db.put(`assignments/${code}`, assignment);
      return res.status(200).json({ success: true, assignment });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ success: false, error: err.code, message: err.message });
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'Upstream timeout' });
    return res.status(500).json({ error: safeError(err) });
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseStudents(raw) {
  if (Array.isArray(raw)) return raw;
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string')       fields[key] = { stringValue: val };
    else if (typeof val === 'number')  fields[key] = { integerValue: val };
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
      // Only attempt JSON parse for known array fields
      if (key === 'students') {
        try { obj[key] = JSON.parse(val.stringValue); } catch { obj[key] = []; }
      } else {
        obj[key] = val.stringValue;
      }
    } else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else obj[key] = null;
  }
  return obj;
}


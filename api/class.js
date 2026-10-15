'use strict';
/* ── The classroom API ─────────────────────────────────────────────────────
   Every request carries the caller's Firebase ID token
   (`Authorization: Bearer <token>`) and is checked here before Firestore is
   touched:

     teacher of the class   read the roster, set the assignment; save,
                            publish and delete assignments; read every
                            student's answers to them
     student in the class   read the assignment and the PUBLISHED
                            assignments, update their OWN record, submit
                            their OWN answers
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
const { fetchWithTimeout, serviceAccount, makeDb } = require('./_firestore');

/* Free classes hold 5 students; a paid Classroom plan holds 30 (the landing
   page's Schools section sells it as "up to 30 students"). A School plan is
   sold as unlimited, but the roster is one Firestore document, so it is
   capped where that document stays small. The teacher's tier is read from
   users/{email}, which api/webhook.js writes when Stripe confirms payment. */
const MAX_STUDENTS = 5;
const CAP_BY_TIER = { classroom: 30, school: 200 };

/* Old classes were minted with 4 characters (1.7M codes, cheap to walk);
   new ones get 6 from a 32-character alphabet (~1.07 billion). Letters only
   ever reach a Firestore path through this pattern, which is also what stops
   path traversal. */
const CLASS_CODE_RE = /^SF-(?:[A-Z0-9]{4}|[A-Z0-9]{6})$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
/* Assignment ids are minted here (12 of the same alphabet) and, like class
   codes, only reach a Firestore path through this pattern. */
const ASSIGNMENT_ID_RE = /^[A-Z0-9]{12}$/;

const LIMITS = { name: 60, school: 100, subject: 80, topic: 120, notes: 50000 };

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

/* How many students this class may hold: 5, or the paid plan's number when
   the class's teacher has one. Any failure reading the plan is the free cap -
   a student turned away can be let in once the plan is fixed, but a class
   let past its cap cannot be un-joined. */
async function classCap(db, code) {
  try {
    const cls = await db.get(`classes/${code}`);
    const uid = cls && cls.data.teacherUid;
    if (!uid) return MAX_STUDENTS;
    const t = await db.get(`teachers/${uid}`);
    const email = t && String(t.data.email || '').toLowerCase();
    if (!email) return MAX_STUDENTS;
    const u = await db.get(`users/${encodeURIComponent(email)}`);
    const tier = u && String(u.data.tier || '').toLowerCase();
    return CAP_BY_TIER[tier] || MAX_STUDENTS;
  } catch (e) {
    console.error('[class.js] classCap', e);
    return MAX_STUDENTS;
  }
}

// ── Assignments ────────────────────────────────────────────────────────────
/* A teacher builds an assignment in teacher-build.html: a short lesson and a
   FIXED set of questions, each with a stable id (`aid`), that every student
   in the class answers. Stored at classes/{code}/assignments/{id}; each
   student's answers at .../assignments/{id}/submissions/{uid}.

   The questions are written by a model and then EDITED BY A TEACHER, and
   lesson.html puts several question fields into innerHTML as they are (the
   option text, the hint). A model's output only ever reached the student who
   asked for it; a teacher's reaches the whole class. So every string is
   neutralised here, on the server, whatever the builder already did: angle
   brackets become their full-width look-alikes, which read the same in
   "x < 5" and can never open a tag. */

const ASSIGNMENT_KINDS = { homework: 1, check: 1, review: 1, preunit: 1 };
const SUBJECT_TYPES = { math: 1, science: 1, psychology: 1, geography: 1, economics: 1, cs: 1,
                        history: 1, english: 1, language: 1, general: 1 };
/* Every type lesson.html can render. A name outside this list would be
   queued and silently skipped, so it is refused at the door instead. */
const QUESTION_TYPES = { mcq: 1, truefalse: 1, fill: 1, write: 1, classify: 1, sequence: 1, sentence: 1,
                         passage: 1, errorspot: 1, scenario: 1, wordproblem: 1, bigequation: 1, twopart: 1,
                         corroborate: 1, highlight: 1, tracetable: 1, matchpairs: 1, estimate: 1,
                         dictation: 1, recall: 1, selfcheck: 1, conceptmap: 1, whosright: 1, readchart: 1 };
const LESSON_KEYS = ['title', 'microTopic', 'briefing', 'content', 'steps', 'keyTerms', 'concepts',
                     'misconceptions', 'workedExample'];
const MAX_QUESTIONS = 30;
const AID_RE = /^[a-z0-9]{1,12}$/;
const BAD_KEYS = { __proto__: 1, constructor: 1, prototype: 1 };

function neutral(s, max) {
  return String(s).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/</g, '＜').replace(/>/g, '＞').slice(0, max);
}

/* A model-shaped value, kept to plain data: strings neutralised and capped,
   finite numbers, booleans, arrays and objects of bounded size and depth. */
function cleanDeep(v, depth) {
  if (typeof v === 'string') return neutral(v, 3000);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v === null) return v;
  if (depth > 6) return null;
  if (Array.isArray(v)) return v.slice(0, 40).map(x => cleanDeep(x, depth + 1));
  if (typeof v === 'object') {
    const out = {};
    Object.keys(v).slice(0, 40).forEach(k => {
      if (BAD_KEYS[k] || !/^[A-Za-z0-9_]{1,24}$/.test(k)) return;
      const c = cleanDeep(v[k], depth + 1);
      if (c !== undefined) out[k] = c;
    });
    return out;
  }
  return undefined;
}

function newId(n) {
  const bytes = crypto.randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}

/* Due dates are the teacher's own wall-clock time, kept as typed: the
   student's dashboard compares them on the student's own clock, which in a
   class is the same time zone. */
function cleanDue(v) {
  const s = String(v || '');
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s) ? s : '';
}

// → { fields } for the assignment document, or throws HttpError
function cleanAssignment(a) {
  if (!a || typeof a !== 'object') throw new HttpError(400, 'missing_fields', 'Missing assignment.');
  /* The title and subject reach lesson.html as the day's title and the
     plan's subject, which several cards print as they are. */
  const title = neutral(cleanText(a.title, LIMITS.topic), LIMITS.topic);
  if (!title) throw new HttpError(400, 'missing_fields', 'Give the assignment a title.');

  const goals = (Array.isArray(a.goals) ? a.goals : []).slice(0, 6).map((g, i) => {
    const text = neutral(cleanText(g && typeof g === 'object' ? g.text : g, 160), 160);
    const id = g && typeof g === 'object' && /^g[0-9]{1,2}$/.test(String(g.id || '')) ? g.id : 'g' + (i + 1);
    return text ? { id, text } : null;
  }).filter(Boolean);
  const goalIds = {};
  goals.forEach(g => { goalIds[g.id] = 1; });

  const lessonIn = a.lesson && typeof a.lesson === 'object' ? a.lesson : {};
  const lesson = {};
  LESSON_KEYS.forEach(k => { if (lessonIn[k] !== undefined) lesson[k] = cleanDeep(lessonIn[k], 1); });

  const seen = {};
  const questions = (Array.isArray(a.questions) ? a.questions : []).slice(0, MAX_QUESTIONS).map(q0 => {
    if (!q0 || typeof q0 !== 'object' || !QUESTION_TYPES[q0.type]) return null;
    const q = cleanDeep(q0, 1);
    let aid = String(q0.aid || '');
    if (!AID_RE.test(aid) || seen[aid]) aid = 'q' + newId(6).toLowerCase();
    seen[aid] = 1;
    q.aid = aid;
    if (q.goal && !goalIds[q.goal]) delete q.goal;
    return q;
  }).filter(Boolean);

  const settingsIn = a.settings && typeof a.settings === 'object' ? a.settings : {};
  const settings = { hints: settingsIn.hints !== false, showAnswers: settingsIn.showAnswers !== false };

  const fields = {
    title,
    kind: ASSIGNMENT_KINDS[a.kind] ? a.kind : 'homework',
    dueAt: cleanDue(a.dueAt),
    minutes: cleanInt(a.minutes, 5, 90) || 20,
    grade: neutral(cleanText(a.grade, 30), 30),
    subject: neutral(cleanText(a.subject, LIMITS.subject), LIMITS.subject),
    subjectType: SUBJECT_TYPES[a.subjectType] ? a.subjectType : 'general',
    goals, settings, lesson, questions
  };
  if (JSON.stringify(questions).length > 250000 || JSON.stringify(lesson).length > 60000)
    throw new HttpError(413, 'too_big', 'This assignment is too long to save. Remove a few questions.');
  return fields;
}

// What a list shows of an assignment: no lesson, no questions.
const SUMMARY_FIELDS = ['title', 'kind', 'dueAt', 'minutes', 'status', 'createdAt', 'publishedAt',
                        'subject', 'questionCount'];

/* A student's answers, merged into what was saved before. The FIRST try at a
   question is kept as it first arrived: a learner who closes the tab and
   comes back is asked again, and that second go must not overwrite the
   result the teacher's numbers are built from. Returns and "recovered"
   (missed, then right when it came back) only ever grow. */
function mergeAnswers(prev, incoming, validAids) {
  const out = prev && typeof prev === 'object' ? { ...prev } : {};
  if (!incoming || typeof incoming !== 'object') return out;
  Object.keys(incoming).slice(0, MAX_QUESTIONS * 2).forEach(aid => {
    if (!validAids[aid] || BAD_KEYS[aid]) return;
    const v = incoming[aid];
    if (!v || typeof v !== 'object') return;
    const old = out[aid] || {};
    const next = { ...old };
    if (old.f === undefined && (v.f === 0 || v.f === 1)) {
      next.f = v.f;
      next.a = neutral(cleanText(v.a, 160), 160);
      next.t = cleanInt(v.t, 0, 3600) || 0;
    }
    next.r = Math.max(cleanInt(old.r, 0, 5) || 0, cleanInt(v.r, 0, 5) || 0);
    next.rc = !!old.rc || v.rc === true;
    out[aid] = next;
  });
  return out;
}

// Score from first tries only, over the questions that are graded at all.
function scoreOf(answers) {
  let n = 0, k = 0, rc = 0;
  Object.keys(answers || {}).forEach(aid => {
    const a = answers[aid];
    if (a.f === 0 || a.f === 1) { n++; k += a.f; }
    if (a.rc) rc++;
  });
  return { answered: n, firstRight: k, recovered: rc, score: n ? Math.round(100 * k / n) : null };
}

async function loadClass(db, code) {
  const doc = await db.get(`classes/${code}`);
  if (!doc) throw new HttpError(404, 'no_such_class', 'No class with that code.');
  const cls = doc.data;
  cls.students = parseStudents(cls.students);
  return cls;
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

      const inClass = isTeacher || findStudent(cls, user) >= 0;

      // ── GET assignments: the class's list ──────────────────────────────
      /* The teacher sees drafts too, and how many have started and finished
         each one; a student sees what is published, with their own status. */
      if (q.type === 'assignments') {
        if (!inClass) return res.status(403).json({ error: 'not_in_class' });
        let list = await db.list(`classes/${code}/assignments`, SUMMARY_FIELDS);
        if (!isTeacher) list = list.filter(d => d.data.status === 'published');
        list.sort((a, b) => String(b.data.publishedAt || b.data.createdAt || '')
          .localeCompare(String(a.data.publishedAt || a.data.createdAt || '')));
        list = list.slice(0, 40);
        const rows = await Promise.all(list.map(async d => {
          const row = { id: d.id, ...d.data };
          if (isTeacher) {
            const subs = await db.list(`classes/${code}/assignments/${d.id}/submissions`, ['status']);
            row.started = subs.length;
            row.done = subs.filter(s => s.data.status === 'done').length;
          } else {
            const mine = await db.get(`classes/${code}/assignments/${d.id}/submissions/${user.uid}`);
            row.myStatus = mine ? mine.data.status : 'not_started';
            if (mine) row.myScore = mine.data.score;
          }
          return row;
        }));
        return res.status(200).json({ assignments: rows, studentCount: cls.students.length });
      }

      // ── GET one assignment, whole: lesson and questions ─────────────────
      if (q.type === 'assignment' && q.id) {
        if (!ASSIGNMENT_ID_RE.test(String(q.id))) return res.status(400).json({ error: 'bad_id' });
        if (!inClass) return res.status(403).json({ error: 'not_in_class' });
        const a = await db.get(`classes/${code}/assignments/${q.id}`);
        if (!a || (!isTeacher && a.data.status !== 'published')) return res.status(404).json({ error: 'no_such_assignment' });
        return res.status(200).json({ assignment: { id: String(q.id), classCode: code, ...a.data } });
      }

      // ── GET results: every student's answers to one assignment ─────────
      if (q.type === 'results') {
        if (!isTeacher) return res.status(403).json({ error: 'not_your_class' });
        if (!ASSIGNMENT_ID_RE.test(String(q.id || ''))) return res.status(400).json({ error: 'bad_id' });
        const a = await db.get(`classes/${code}/assignments/${q.id}`);
        if (!a) return res.status(404).json({ error: 'no_such_assignment' });
        const subs = await db.list(`classes/${code}/assignments/${q.id}/submissions`);
        const byUid = {};
        subs.forEach(s => { byUid[s.id] = s.data; });
        /* One row per student IN THE CLASS NOW, so "not started" has names.
           A submission from someone who has since left is still counted. */
        const rows = cls.students.map(s => {
          const sub = (s.uid && byUid[s.uid]) || null;
          if (s.uid) delete byUid[s.uid];
          return { name: s.name || s.email, email: s.email, status: sub ? sub.status : 'not_started',
                   startedAt: sub ? sub.startedAt : null, finishedAt: sub ? sub.finishedAt : null,
                   score: sub ? sub.score : null, timeSecs: sub ? sub.timeSecs : 0,
                   answers: sub ? sub.answers || {} : {} };
        });
        Object.keys(byUid).forEach(uid => {
          const sub = byUid[uid];
          rows.push({ name: sub.name || sub.email, email: sub.email, status: sub.status, left: true,
                      startedAt: sub.startedAt, finishedAt: sub.finishedAt, score: sub.score,
                      timeSecs: sub.timeSecs, answers: sub.answers || {} });
        });
        return res.status(200).json({ assignment: { id: String(q.id), ...a.data }, students: rows });
      }

      // ── GET assignment: the teacher, or a student in the class ─────────
      /* The first, single assignment ("Assign lesson": a topic, a date and
         notes, from which each student builds their own plan). Kept for
         classes that still have one; new work is the list above. */
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
      const cap = await classCap(db, code);
      const result = await updateClass(db, code, (cls) => {
        if (cls.teacherUid && cls.teacherUid === user.uid)
          throw new HttpError(400, 'own_class', 'That is your own class code.');
        const idx = findStudent(cls, user);
        if (idx >= 0) {
          cls.students[idx] = { ...cls.students[idx], uid: user.uid, email: user.email, name };
        } else {
          if (cls.students.length >= cap)
            throw new HttpError(200, 'class_full', `This class is full (max ${cap} students).`);
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

    // ── save-assignment: the teacher creates or edits one ─────────────────
    /* A draft can be changed freely. Once published, students may already
       have answered it, and their answers are keyed on each question's id -
       so only the title and the due date can change after that. */
    if (action === 'save-assignment') {
      const cls = await loadClass(db, code);
      if (!cls.teacherUid || cls.teacherUid !== user.uid) return res.status(403).json({ error: 'not_your_class' });
      const fields = cleanAssignment(body.assignment);
      const now = new Date().toISOString();
      const id = String((body.assignment && body.assignment.id) || '');
      if (id) {
        if (!ASSIGNMENT_ID_RE.test(id)) return res.status(400).json({ error: 'bad_id' });
        const path = `classes/${code}/assignments/${id}`;
        const prev = await db.get(path);
        if (!prev) return res.status(404).json({ error: 'no_such_assignment' });
        if (prev.data.status === 'published') {
          await db.patch(path, { title: fields.title, dueAt: fields.dueAt, updatedAt: now });
          const after = await db.get(path);
          return res.status(200).json({ assignment: { id, ...after.data }, lockedQuestions: true });
        }
        const doc = { ...prev.data, ...fields, questionCount: fields.questions.length, updatedAt: now };
        await db.put(path, doc);
        return res.status(200).json({ assignment: { id, ...doc } });
      }
      const doc = { ...fields, status: 'draft', createdAt: now, updatedAt: now, publishedAt: '',
                    questionCount: fields.questions.length, teacherName: cls.teacherName || '' };
      for (let i = 0; i < 5; i++) {
        const nid = newId(12);
        if (await db.create(`classes/${code}/assignments`, nid, doc))
          return res.status(200).json({ assignment: { id: nid, ...doc } });
      }
      throw new Error('Could not mint an assignment id');
    }

    // ── publish-assignment: students can see it from now on ───────────────
    if (action === 'publish-assignment') {
      const cls = await loadClass(db, code);
      if (!cls.teacherUid || cls.teacherUid !== user.uid) return res.status(403).json({ error: 'not_your_class' });
      const id = String(body.id || '');
      if (!ASSIGNMENT_ID_RE.test(id)) return res.status(400).json({ error: 'bad_id' });
      const path = `classes/${code}/assignments/${id}`;
      const a = await db.get(path);
      if (!a) return res.status(404).json({ error: 'no_such_assignment' });
      if (!Array.isArray(a.data.questions) || !a.data.questions.length)
        return res.status(400).json({ error: 'no_questions', message: 'Add at least one question first.' });
      if (a.data.status !== 'published')
        await db.patch(path, { status: 'published', publishedAt: new Date().toISOString() });
      const after = await db.get(path);
      return res.status(200).json({ assignment: { id, ...after.data } });
    }

    // ── delete-assignment: the assignment and every answer to it ──────────
    if (action === 'delete-assignment') {
      const cls = await loadClass(db, code);
      if (!cls.teacherUid || cls.teacherUid !== user.uid) return res.status(403).json({ error: 'not_your_class' });
      const id = String(body.id || '');
      if (!ASSIGNMENT_ID_RE.test(id)) return res.status(400).json({ error: 'bad_id' });
      const subs = await db.list(`classes/${code}/assignments/${id}/submissions`, ['status']);
      await Promise.all(subs.map(s => db.remove(`classes/${code}/assignments/${id}/submissions/${s.id}`)));
      await db.remove(`classes/${code}/assignments/${id}`);
      return res.status(200).json({ success: true });
    }

    // ── submit: a student saves their own answers to an assignment ───────
    /* Sent as they go (so a closed tab loses nothing) and once more at the
       end with status "done". Only the student's own document, only the
       questions the assignment actually has, only clamped fields. */
    if (action === 'submit') {
      const cls = await loadClass(db, code);
      const idx = findStudent(cls, user);
      if (idx < 0) return res.status(403).json({ error: 'not_in_class', message: 'You are not in this class.' });
      const id = String(body.id || '');
      if (!ASSIGNMENT_ID_RE.test(id)) return res.status(400).json({ error: 'bad_id' });
      const a = await db.get(`classes/${code}/assignments/${id}`);
      if (!a || a.data.status !== 'published') return res.status(404).json({ error: 'no_such_assignment' });
      const validAids = {};
      (a.data.questions || []).forEach(qq => { if (qq && qq.aid) validAids[qq.aid] = 1; });

      const path = `classes/${code}/assignments/${id}/submissions/${user.uid}`;
      const prev = await db.get(path);
      const p = prev ? prev.data : {};
      const now = new Date().toISOString();
      const answers = mergeAnswers(p.answers, body.answers, validAids);
      const done = p.status === 'done' || body.status === 'done';
      const sc = scoreOf(answers);
      const doc = {
        uid: user.uid, email: user.email, name: cls.students[idx].name || user.name || user.email,
        status: done ? 'done' : 'in_progress',
        startedAt: p.startedAt || now,
        finishedAt: p.finishedAt || (done ? now : ''),
        updatedAt: now,
        timeSecs: Math.max(cleanInt(p.timeSecs, 0, 1e6) || 0, cleanInt(body.timeSecs, 0, 1e6) || 0),
        answers, score: sc.score, answered: sc.answered, recovered: sc.recovered
      };
      await db.put(path, doc);
      return res.status(200).json({ success: true, status: doc.status, score: doc.score });
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

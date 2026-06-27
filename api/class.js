'use strict';
const FIREBASE_PROJECT = 'studyflow-e59ef';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const MAX_STUDENTS = 5;
const FETCH_TIMEOUT_MS = 8000;

// Validated class code pattern: SF-XXXX (letters/digits only — prevents path traversal)
const CLASS_CODE_RE = /^SF-[A-Z0-9]{4}$/;

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function safeError(err, generic = 'Internal server error') {
  console.error('[class.js]', err);         // full detail server-side only
  return generic;                            // generic message to client
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.FIREBASE_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  const queryClassCode = req.query.classCode;

  try {
    // ── GET assignment ──────────────────────────────────────────────────────
    if (req.method === 'GET' && queryClassCode && req.query.type === 'assignment') {
      if (!CLASS_CODE_RE.test(queryClassCode))
        return res.status(400).json({ error: 'Invalid class code format' });

      const r = await fetchWithTimeout(
        `${FIRESTORE_BASE}/assignments/${queryClassCode}?key=${API_KEY}`
      );
      const data = await r.json();
      if (data.error) return res.status(200).json({ assignment: null });
      return res.status(200).json({ assignment: parseFirestore(data) });
    }

    // ── GET class data ──────────────────────────────────────────────────────
    if (req.method === 'GET' && queryClassCode) {
      if (!CLASS_CODE_RE.test(queryClassCode))
        return res.status(400).json({ error: 'Invalid class code format' });

      const r = await fetchWithTimeout(
        `${FIRESTORE_BASE}/classes/${queryClassCode}?key=${API_KEY}`
      );
      const data = await r.json();
      if (data.error?.code === 404)
        return res.status(200).json({ students: [], classCode: queryClassCode });
      if (data.error)
        return res.status(500).json({ error: safeError(data.error.message) });

      const classData = parseFirestore(data);
      classData.students = parseStudents(classData.students);
      return res.status(200).json(classData);
    }

    // ── POST actions ────────────────────────────────────────────────────────
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' });

    const { action, classCode, studentEmail, studentData, assignment } = req.body || {};

    if (!classCode || !CLASS_CODE_RE.test(classCode))
      return res.status(400).json({ error: 'Invalid class code format' });

    const docUrl = `${FIRESTORE_BASE}/classes/${classCode}?key=${API_KEY}`;

    // ── init ────────────────────────────────────────────────────────────────
    if (action === 'init') {
      const r = await fetchWithTimeout(docUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestore({
          classCode,
          students: '[]',
          createdAt: new Date().toISOString()
        }))
      });
      const data = await r.json();
      if (data.error) return res.status(500).json({ error: safeError(data.error) });
      return res.status(200).json({ success: true });
    }

    // ── join ────────────────────────────────────────────────────────────────
    if (action === 'join') {
      if (!studentData?.email)
        return res.status(400).json({ error: 'Missing student email' });

      // GET with API key (critical fix)
      const getR = await fetchWithTimeout(`${FIRESTORE_BASE}/classes/${classCode}?key=${API_KEY}`);
      const existing = await getR.json();

      let classData = existing.error
        ? { classCode, students: [] }
        : parseFirestore(existing);
      classData.students = parseStudents(classData.students);

      const alreadyIn = classData.students.find(s => s.email === studentData.email);
      if (!alreadyIn && classData.students.length >= MAX_STUDENTS) {
        return res.status(200).json({
          success: false,
          error: 'class_full',
          message: `This class is full (max ${MAX_STUDENTS} students).`
        });
      }

      // Upsert student
      const idx = classData.students.findIndex(s => s.email === studentData.email);
      if (idx >= 0) classData.students[idx] = { ...classData.students[idx], ...studentData };
      else classData.students.push(studentData);

      const patchR = await fetchWithTimeout(`${FIRESTORE_BASE}/classes/${classCode}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestore({
          classCode: classData.classCode || classCode,
          students: JSON.stringify(classData.students),
          createdAt: classData.createdAt || new Date().toISOString()
        }))
      });
      const result = await patchR.json();
      if (result.error) return res.status(500).json({ error: safeError(result.error) });
      return res.status(200).json({ success: true, studentCount: classData.students.length });
    }

    // ── sync ────────────────────────────────────────────────────────────────
    if (action === 'sync') {
      if (!studentEmail)
        return res.status(400).json({ error: 'Missing student email' });

      // GET with API key (critical fix)
      const getR = await fetchWithTimeout(`${FIRESTORE_BASE}/classes/${classCode}?key=${API_KEY}`);
      const existing = await getR.json();

      let classData = existing.error ? { classCode, students: [] } : parseFirestore(existing);
      classData.students = parseStudents(classData.students);

      const idx = classData.students.findIndex(s => s.email === studentEmail);
      if (idx >= 0) classData.students[idx] = { ...classData.students[idx], ...studentData };
      else classData.students.push({ email: studentEmail, ...studentData });

      const patchR = await fetchWithTimeout(`${FIRESTORE_BASE}/classes/${classCode}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestore({
          ...classData,
          students: JSON.stringify(classData.students)
        }))
      });
      const result = await patchR.json();
      if (result.error) return res.status(500).json({ error: safeError(result.error) });
      return res.status(200).json({ success: true });
    }

    // ── assign ──────────────────────────────────────────────────────────────
    if (action === 'assign') {
      if (!assignment || typeof assignment !== 'object')
        return res.status(400).json({ error: 'Missing assignment payload' });

      const url = `${FIRESTORE_BASE}/assignments/${classCode}?key=${API_KEY}`;
      const r = await fetchWithTimeout(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestore(assignment))
      });
      const data = await r.json();
      if (data.error) return res.status(500).json({ error: safeError(data.error) });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'Upstream timeout' });
    return res.status(500).json({ error: safeError(err) });
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseStudents(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
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

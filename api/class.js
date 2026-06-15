// Firestore REST API endpoint for cross-device class data sync
const FIREBASE_PROJECT = 'studyflow-e59ef';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function getFirestoreToken() {
  // Use Firebase service account or API key for server-side access
  return process.env.FIREBASE_API_KEY || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, classCode, studentEmail, studentData, assignment } = req.body || {};
  const queryClassCode = req.query.classCode;

  try {
    // GET assignment for a class
    if (req.method === 'GET' && queryClassCode && req.query.type === 'assignment') {
      const url = `${FIRESTORE_BASE}/assignments/${queryClassCode}`;
      const r = await fetch(url + '?key=' + process.env.FIREBASE_API_KEY);
      const data = await r.json();
      if (data.error) {
        return res.status(200).json({ assignment: null });
      }
      return res.status(200).json({ assignment: parseFirestore(data) });
    }

    // GET class data
    if (req.method === 'GET' && queryClassCode) {
      const url = `${FIRESTORE_BASE}/classes/${queryClassCode}`;
      const r = await fetch(url + '?key=' + process.env.FIREBASE_API_KEY);
      const data = await r.json();
      if (data.error && data.error.code === 404) {
        return res.status(200).json({ students: [], classCode: queryClassCode });
      }
      if (data.error) return res.status(500).json({ error: data.error.message });
      const classData = parseFirestore(data);
      // Ensure students is always a real array
      if (!Array.isArray(classData.students)) {
        try { classData.students = JSON.parse(classData.students || '[]'); } catch { classData.students = []; }
      }
      return res.status(200).json(classData);
    }

    // POST — create or update class
    if (req.method === 'POST') {
      if (action === 'init') {
        const url = `${FIRESTORE_BASE}/classes/${classCode}?key=${process.env.FIREBASE_API_KEY}`;
        const r = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFirestore({ classCode, students: '[]', createdAt: new Date().toISOString() }))
        });
        const data = await r.json();
        if (data.error) return res.status(500).json({ error: data.error.message });
        return res.status(200).json({ success: true });
      }

      if (action === 'join') {
        const url = `${FIRESTORE_BASE}/classes/${classCode}?key=${process.env.FIREBASE_API_KEY}`;
        console.log('[JOIN] classCode:', classCode);
        console.log('[JOIN] studentData:', JSON.stringify(studentData));
        console.log('[JOIN] GET url:', url);

        const getR = await fetch(url);
        const existing = await getR.json();
        console.log('[JOIN] GET status:', getR.status);
        console.log('[JOIN] existing:', JSON.stringify(existing).substring(0, 200));

        let classData = existing.error ? { classCode, students: [] } : parseFirestore(existing);
        console.log('[JOIN] parsed classData:', JSON.stringify(classData).substring(0, 200));

        if (!Array.isArray(classData.students)) {
          try { classData.students = JSON.parse(classData.students || '[]'); } catch { classData.students = []; }
        }
        console.log('[JOIN] students count before:', classData.students.length);

        const alreadyIn = classData.students.find(s => s.email === studentData.email);
        if (!alreadyIn) {
          const MAX_STUDENTS = 5;
          if (classData.students.length >= MAX_STUDENTS) {
            return res.status(200).json({ success: false, error: 'class_full', message: 'This class is full (max 5 students).' });
          }
        }

        classData.students = classData.students.filter(s => s.email !== studentData.email);
        classData.students.push(studentData);
        console.log('[JOIN] students count after:', classData.students.length);

        const patchBody = toFirestore({ classCode: classData.classCode || classCode, students: JSON.stringify(classData.students), createdAt: classData.createdAt || new Date().toISOString() });
        console.log('[JOIN] PATCH body:', JSON.stringify(patchBody).substring(0, 200));

        const patchR = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody)
        });
        const result = await patchR.json();
        console.log('[JOIN] PATCH status:', patchR.status);
        console.log('[JOIN] PATCH result:', JSON.stringify(result).substring(0, 200));

        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.status(200).json({ success: true, studentCount: classData.students.length });
      }

      if (action === 'sync') {
        // Update student stats
        const url = `${FIRESTORE_BASE}/classes/${classCode}?key=${process.env.FIREBASE_API_KEY}`;
        const getR = await fetch(url);
        const existing = await getR.json();
        let classData = existing.error ? { classCode, students: [] } : parseFirestore(existing);

        if (!Array.isArray(classData.students)) {
          try { classData.students = JSON.parse(classData.students || '[]'); } catch { classData.students = []; }
        }

        const idx = classData.students.findIndex(s => s.email === studentEmail);
        if (idx >= 0) {
          classData.students[idx] = Object.assign(classData.students[idx], studentData);
        } else {
          classData.students.push(Object.assign({ email: studentEmail }, studentData));
        }

        const patchR = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFirestore({ ...classData, students: JSON.stringify(classData.students) }))
        });
        const result = await patchR.json();
        if (result.error) return res.status(500).json({ error: result.error.message });
        return res.status(200).json({ success: true });
      }

      if (action === 'assign') {
        // Save assignment
        const url = `${FIRESTORE_BASE}/assignments/${classCode}?key=${process.env.FIREBASE_API_KEY}`;
        const r = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFirestore(assignment))
        });
        const data = await r.json();
        if (data.error) return res.status(500).json({ error: data.error.message });
        return res.status(200).json({ success: true });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Convert JS object to Firestore format
function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number') fields[key] = { integerValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (Array.isArray(val)) fields[key] = { stringValue: JSON.stringify(val) };
    else if (val === null || val === undefined) fields[key] = { nullValue: null };
    else fields[key] = { stringValue: JSON.stringify(val) };
  }
  return { fields };
}

// Parse Firestore format to JS object
function parseFirestore(doc) {
  if (!doc.fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    if (val.stringValue !== undefined) {
      try { obj[key] = JSON.parse(val.stringValue); }
      catch { obj[key] = val.stringValue; }
    } else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else obj[key] = null;
  }
  return obj;
}

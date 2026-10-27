'use strict';
const MAX_MESSAGES = 10;
const FETCH_TIMEOUT_MS = 15000;

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function sanitizeContext(c) {
  // Prevents prompt injection — strips any instruction-like patterns from user content
  const strip = s => typeof s === 'string'
    ? s.replace(/ignore\s+all\s+previous/gi, '[redacted]')
         .replace(/system\s*:/gi, '[redacted]')
         .substring(0, 500)
    : '';
  const short = (s, n) => strip(s).replace(/\s+/g, ' ').trim().substring(0, n);
  const SCREENS = ['question', 'lesson', 'flashcards', 'walkthrough', 'results', 'other'];
  const pic = c.picture && typeof c.picture === 'object' && Array.isArray(c.picture.labels)
    ? {
        caption: short(c.picture.caption, 80),
        labels: c.picture.labels.slice(0, 14).map(l => short(String(l), 40)).filter(Boolean)
      }
    : null;
  return {
    subject:         strip(c.subject),
    lessonTitle:     strip(c.lessonTitle),
    lessonContent:   strip(c.lessonContent),
    currentQuestion: strip(c.currentQuestion),
    accuracy:        typeof c.accuracy === 'number' ? Math.max(0, Math.min(100, c.accuracy)) : null,
    correctCount:    typeof c.correctCount === 'number' ? c.correctCount : undefined,
    missedQuestions: Array.isArray(c.missedQuestions)
      ? c.missedQuestions.slice(0, 3).map(q => strip(String(q)))
      : [],
    // What is on the learner's screen (lesson.html chatScene, Oct 2026).
    screen:      SCREENS.includes(c.screen) ? c.screen : 'other',
    answered:    c.answered === true,
    correct:     typeof c.correct === 'boolean' ? c.correct : null,
    // The page only sends these once the question has been answered.
    yourAnswer:  c.answered === true ? short(c.yourAnswer, 160) : '',
    rightAnswer: c.answered === true ? short(c.rightAnswer, 200) : '',
    picture:     pic && pic.labels.length ? pic : null,
    grade:       short(c.grade, 30)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages must be a non-empty array' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration' });

  const c = sanitizeContext(context || {});

  // Validate message structure before sending to Claude
  const validMessages = messages
    .slice(-MAX_MESSAGES)
    .filter(m => m && typeof m.role === 'string' && typeof m.content === 'string')
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 1000) }));

  if (validMessages.length === 0)
    return res.status(400).json({ error: 'No valid messages' });

  const systemLines = [
    'You are an expert AI study tutor built into StudyFlow helping a student during a live study session.',
    '',
    '=== SESSION CONTEXT ===',
    c.subject         && `Subject: ${c.subject}`,
    c.lessonTitle     && `Today\'s lesson: ${c.lessonTitle}`,
    c.lessonContent   && `Lesson content: ${c.lessonContent}`,
    c.grade           && `Student's grade: ${c.grade}`,
    `On screen right now: ${c.screen === 'question' ? 'a practice question' : c.screen === 'results' ? 'the end-of-session results' : c.screen === 'flashcards' ? 'the key-term flashcards' : c.screen === 'walkthrough' ? 'a step-by-step walkthrough' : c.screen === 'lesson' ? 'the lesson card' : 'the session'}`,
    c.currentQuestion && `Current question: "${c.currentQuestion}"`,
    c.screen === 'question' && (c.answered
      ? `The student has answered it${c.correct === true ? ' correctly' : c.correct === false ? ' incorrectly' : ''}.`
      : 'The student has NOT answered it yet.'),
    c.yourAnswer      && `Their answer: "${c.yourAnswer}"`,
    c.rightAnswer     && `The right answer: "${c.rightAnswer}"`,
    c.picture         && `A picture is showing${c.picture.caption ? ` ("${c.picture.caption}")` : ''}, labelled: ${c.picture.labels.join(', ')}`,
    c.accuracy !== null && `Session accuracy: ${c.accuracy}%`,
    c.missedQuestions.length > 0 && `Struggled with: ${c.missedQuestions.join(' | ')}`,
    c.correctCount !== undefined  && `Correct so far: ${c.correctCount}`,
    '',
    '=== YOUR RULES ===',
    '1. Be specific — reference actual lesson content. No generic answers.',
    '2. Keep responses to 2-4 sentences. Clear and direct. For steps, up to 5 short numbered lines.',
    '3. If accuracy < 60%, be extra encouraging and simplify.',
    '4. For math/science, show the formula or working when relevant.',
    '5. Never say "I don\'t know" — always help based on context.',
    '6. Use "you" not "one" — warm and personal.',
    '7. If accuracy ≥ 80%, brief praise then answer.',
    '8. If the student has NOT answered the current question, never give, confirm or rule out its answer, even if asked. Give a hint or a guiding question instead.',
    '9. If a picture is showing, point to its parts by their labels when that helps.',
    '10. FORMAT: plain sentences only. No Markdown: no asterisks, no bold, no pound-sign headings, no tables, no LaTeX. Write × and ÷ for maths. Steps go on their own lines as "1.", "2.", "3.".',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        system: systemLines,
        messages: validMessages
      })
    });

    const data = await response.json();
    if (!data.content?.[0]?.text)
      return res.status(500).json({ error: 'No response from AI' });

    return res.status(200).json({ reply: data.content[0].text });
  } catch (err) {
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'AI tutor timeout — please try again' });
    console.error('[chat.js]', err.message);
    return res.status(500).json({ error: 'Chat unavailable' });
  }
};

'use strict';
/* The whole prompt must fit, or the model never sees the part that matters.
   app.html builds roughly 21k characters and puts the JSON skeleton, the
   QUESTION TYPE LOCK and the "output only JSON" instruction at the END - so a
   12000-char cap discarded exactly the things the response is graded against,
   and the model was left guessing the shape from the prose above it. It was
   silently dropping ~7k characters even before the extended formats were
   added, which is the most likely reason day payloads arrived with fields
   missing and keyTerms sometimes as strings rather than objects.

   Claude Haiku 4.5 takes a 200k-token context; 12000 chars is about 3k tokens.
   60000 leaves generous headroom over the current prompt plus the 3500-char
   notes budget app.html allows. */
const MAX_PROMPT_CHARS = 60000;
const FETCH_TIMEOUT_MS = 45000; // 45s server-side (Vercel limit is 60s)

function fetchWithTimeout(url, opts) {
  opts = opts || {};
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(() => clearTimeout(id));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim())
    return res.status(400).json({ error: 'prompt must be a non-empty string' });

  const trimmedPrompt = prompt.slice(0, MAX_PROMPT_CHARS);
  /* Truncation here is never harmless - it removes the tail, which is where
     the schema lives. Say so rather than failing silently. */
  if (prompt.length > MAX_PROMPT_CHARS) {
    console.warn('[generate.js] prompt truncated:', prompt.length, '->', MAX_PROMPT_CHARS,
                 '- the JSON skeleton may have been cut off');
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration' });

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
        max_tokens: 8096,
        system: [
          'You are a study plan generator. STRICT RULES:',
          '1. Output ONLY valid compact JSON — no whitespace between tokens, no line breaks, no markdown, no code fences.',
          '2. Never truncate — output the COMPLETE JSON even if it means shorter values.',
          '3. Every empty string "" must be replaced with REAL content from the student notes.',
          '4. All string values must be under 180 characters.',
          '5. Never add commentary, explanations, or text outside the JSON object.',
          '6. The JSON must start with { and end with } on the very last character you output.'
        ].join(' '),
        messages: [{ role: 'user', content: trimmedPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[generate.js] Anthropic error', response.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'AI service error: ' + response.status });
    }

    const data = await response.json();
    if (!data.content || !data.content[0] || !data.content[0].text) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const stopReason = data.stop_reason || '';
    const text = data.content[0].text;

    // Log truncations for monitoring
    if (stopReason === 'max_tokens') {
      console.warn('[generate.js] Response truncated at max_tokens — client will repair');
    }

    return res.status(200).json({
      result: text,
      truncated: stopReason === 'max_tokens'
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI service timeout — please try again' });
    }
    console.error('[generate.js]', err.message);
    return res.status(500).json({ error: 'Failed to generate plan' });
  }
};

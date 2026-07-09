'use strict';
const MAX_PROMPT_CHARS = 8000;
const FETCH_TIMEOUT_MS = 25000;

function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string')
    return res.status(400).json({ error: 'prompt must be a non-empty string' });

  // Prevent prompt-stuffing abuse / runaway costs
  const trimmedPrompt = prompt.slice(0, MAX_PROMPT_CHARS);

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
        system: 'You are a study plan generator. You ONLY output valid compact JSON with no whitespace, no line breaks, no markdown. Keep all string values under 100 characters. Always output the complete JSON — never truncate or stop early.',
        messages: [{ role: 'user', content: trimmedPrompt }]
      })
    });

    const data = await response.json();
    if (!data.content?.[0]?.text)
      return res.status(500).json({ error: 'No response from AI' });

    // If Claude hit the token limit, the JSON will be truncated
    // Signal this so the client can try repair
    const stopReason = data.stop_reason || '';
    const text = data.content[0].text;

    return res.status(200).json({
      result: text,
      truncated: stopReason === 'max_tokens'
    });
  } catch (err) {
    if (err.name === 'AbortError')
      return res.status(504).json({ error: 'AI service timeout — please try again' });
    console.error('[generate.js]', err.message);
    return res.status(500).json({ error: 'Failed to generate plan' });
  }
};

'use strict';
/* The drawing lab's endpoint (draw-lab.html): the lesson-drawing prompt, sent
   to a CHOSEN model, so the models can be compared side by side on the same
   lessons.

   Separate from api/generate.js on purpose. Plan generation is untouched, and
   when the comparison is over this file and draw-lab.html can be deleted
   without anything else noticing.

   Everything except the model is held the same as production, so the
   comparison measures the model and nothing else:
     - the system prompt below is generate.js's, word for word
     - the page sends SFDraw.lessonPrompt(day), the prompt lessons use
     - the Haiku entry is the exact model id generate.js calls

   This is a public URL, and it can call Opus on the app's API key - so it is
   LOCKED. It answers nothing unless DRAW_LAB_KEY is set in Vercel and the
   request carries the same value in an x-lab-key header (the page has a box
   for it). With the variable unset - the default - every deploy of this file,
   preview or production, refuses every call and costs nothing. Past the lock
   it still only accepts what the lab needs: three models by short name, two
   effort levels, and prompts no longer than a drawing prompt (~6k chars) plus
   headroom. */

const crypto = require('crypto');

const MODELS = {
  haiku:  { id: 'claude-haiku-4-5-20251001', thinking: false },   // production, unchanged
  sonnet: { id: 'claude-sonnet-5-5', thinking: true },
  opus:   { id: 'claude-opus-5-5', thinking: true }
};
const EFFORTS = { low: 1, medium: 1 };
const MAX_PROMPT_CHARS = 12000;
/* Same reasoning as generate.js: stop short of vercel.json's 60s so the
   function answers with a JSON error instead of being killed. */
const FETCH_TIMEOUT_MS = 55000;

/* generate.js's system prompt, copied exactly. Production drawings are made
   under it, so the other models have to be too. */
const SYSTEM = [
  'You are a study plan generator. STRICT RULES:',
  '1. Output ONLY valid compact JSON — no whitespace between tokens, no line breaks, no markdown, no code fences.',
  '2. Never truncate — output the COMPLETE JSON even if it means shorter values.',
  '3. Every empty string "" must be replaced with REAL content from the student notes.',
  '4. All string values must be under 180 characters.',
  '5. Never add commentary, explanations, or text outside the JSON object.',
  '6. The JSON must start with { and end with } on the very last character you output.'
].join(' ');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://studyflow-ten-vert.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-lab-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  /* The lock, before anything else is read. A key under 12 characters counts
     as unset: a short one can be guessed. */
  const labKey = process.env.DRAW_LAB_KEY || '';
  if (labKey.length < 12)
    return res.status(403).json({ locked: true, error: 'The drawing lab is switched off. Set DRAW_LAB_KEY in Vercel (12+ characters) to turn it on.' });
  const sent = Buffer.from(String(req.headers['x-lab-key'] || ''));
  const want = Buffer.from(labKey);
  if (sent.length !== want.length || !crypto.timingSafeEqual(sent, want))
    return res.status(403).json({ locked: true, error: 'Wrong lab key.' });

  const body = req.body || {};
  const model = MODELS[body.model];
  if (!model) return res.status(400).json({ error: 'model must be haiku, sonnet or opus' });
  const prompt = body.prompt;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim())
    return res.status(400).json({ error: 'prompt must be a non-empty string' });
  if (prompt.length > MAX_PROMPT_CHARS)
    return res.status(400).json({ error: 'prompt is longer than a drawing prompt' });
  const effort = EFFORTS[body.effort] ? body.effort : 'medium';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration' });

  const request = {
    model: model.id,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }]
  };
  if (model.thinking) {
    /* Both run adaptive thinking by default, and its tokens come out of
       max_tokens - so there is room for the thinking AND the drawing.
       Effort is set explicitly: Sonnet 5.5 defaults to high, which risks the
       55s limit, and Opus 5.5 defaults to medium.

       No refusal fallback, deliberately. A fallback answers with a different
       model, and the lab would show that model's drawing under this one's
       name. A refusal is reported as a refusal instead. */
    request.max_tokens = 16000;
    request.output_config = { effort: effort };
  } else {
    request.max_tokens = 8096;   // what generate.js sends
  }

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(request),
      signal: ctrl.signal
    });
    const ms = Date.now() - started;

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[draw-lab.js] Anthropic error', model.id, response.status, errText.slice(0, 300));
      return res.status(502).json({ error: 'AI service error: ' + response.status, ms: ms });
    }

    const data = await response.json();
    const usage = {
      input_tokens: (data.usage && data.usage.input_tokens) || 0,
      output_tokens: (data.usage && data.usage.output_tokens) || 0
    };
    if (data.stop_reason === 'refusal') {
      return res.status(200).json({
        refused: true,
        category: (data.stop_details && data.stop_details.category) || null,
        model: data.model || model.id, ms: ms, usage: usage
      });
    }
    /* A thinking model's first block can be a thinking block, so the answer
       is every text block, not content[0]. generate.js reads content[0]
       and would come back empty on these models. */
    const text = (data.content || [])
      .filter(b => b && b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text).join('');
    if (!text) return res.status(500).json({ error: 'No text in the reply', ms: ms, usage: usage });

    return res.status(200).json({
      result: text,
      model: data.model || model.id,
      stop_reason: data.stop_reason || '',
      ms: ms,
      usage: usage
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timed out after 55s', ms: Date.now() - started });
    }
    console.error('[draw-lab.js]', err.message);
    return res.status(500).json({ error: 'Failed to draw' });
  } finally {
    clearTimeout(timer);
  }
};

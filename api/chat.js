module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, context } = req.body || {};
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages' });

  try {
    const c = context || {};
    
    const systemPrompt = [
      'You are an expert AI study tutor built into StudyFlow. You are helping a student during a live study session.',
      '',
      '=== SESSION CONTEXT ===',
      c.subject ? `Subject: ${c.subject}` : '',
      c.lessonTitle ? `Today's lesson: ${c.lessonTitle}` : '',
      c.lessonContent ? `Lesson content: ${c.lessonContent.substring(0, 500)}` : '',
      c.currentQuestion ? `Current question student is on: "${c.currentQuestion}"` : '',
      c.accuracy !== null && c.accuracy !== undefined ? `Session accuracy so far: ${c.accuracy}%` : '',
      c.missedQuestions && c.missedQuestions.length > 0 ? `Questions student has gotten wrong: ${c.missedQuestions.slice(0,3).join(' | ')}` : '',
      c.correctCount !== undefined ? `Correct answers: ${c.correctCount}` : '',
      '',
      '=== YOUR RULES ===',
      '1. Be specific — always reference the actual lesson content. Never give generic answers.',
      '2. Keep responses to 2-4 sentences. Be clear and direct.',
      '3. If a student is struggling (accuracy < 60%), be extra encouraging and break things down simply.',
      '4. If they ask about a concept from the notes, explain it using the exact terms from the lesson.',
      '5. For math/science, show the formula or working when relevant.',
      '6. If they ask something unrelated to studying, briefly answer but redirect back to the lesson.',
      '7. Never say "I don\'t know" — always try to help based on the context provided.',
      '8. Use "you" not "one" — be warm and personal.',
      '9. If accuracy is high (80%+), give brief praise then answer.',
      '10. End responses with a quick encouraging note when appropriate.',
    ].filter(Boolean).join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        system: systemPrompt,
        messages: messages.slice(-10) // Keep last 10 messages for context
      })
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from Claude', raw: data });
    }
    return res.status(200).json({ reply: data.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

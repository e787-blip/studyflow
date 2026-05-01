module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, context } = req.body || {};
  if (!messages || !messages.length) return res.status(400).json({ error: 'No messages' });

  try {
    // Build a rich system prompt from context
    const systemPrompt = [
      'You are an expert AI study tutor built into StudyFlow.',
      context.subject ? 'Subject: ' + context.subject + '.' : '',
      context.lessonTitle ? 'Today\'s lesson: ' + context.lessonTitle + '.' : '',
      context.lessonContent ? 'Lesson content: ' + context.lessonContent.substring(0, 400) + '.' : '',
      context.missedQuestions && context.missedQuestions.length ?
        'Student has struggled with: ' + context.missedQuestions.slice(0,3).join('; ') + '.' : '',
      context.accuracy !== undefined ?
        'Current session accuracy: ' + context.accuracy + '%.' : '',
      context.currentQuestion ?
        'Current question student is on: ' + context.currentQuestion + '.' : '',
      '',
      'YOUR RULES:',
      '- Answer in 2-4 sentences. Be specific and reference actual lesson content.',
      '- Never be generic. Always tie your answer to the subject being studied.',
      '- If the student seems confused, break it down step by step.',
      '- If they ask something unrelated to studying, gently redirect.',
      '- Use encouraging, friendly language. You are their personal tutor.',
      '- For math/science, show the working/formula when relevant.',
    ].filter(Boolean).join(' ');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: messages // Full conversation history
      })
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response', raw: data });
    }
    return res.status(200).json({ reply: data.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

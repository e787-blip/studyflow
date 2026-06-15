// api/extract.js — Extract text from images using Claude Vision
// Supports: JPG, PNG, WebP, GIF, HEIC

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageData, mediaType, filename } = req.body;
    if (!imageData || !mediaType) {
      return res.status(400).json({ error: 'imageData and mediaType are required' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData
              }
            },
            {
              type: 'text',
              text: `You are a study notes extractor. Extract ALL text and content from this image that would be useful for studying.

This could be:
- Handwritten notes from class
- Photos of textbook pages
- Slides or presentations
- Diagrams with labels
- Whiteboard photos
- Typed notes or documents

Instructions:
- Extract ALL visible text, preserving structure (headings, bullet points, lists)
- For diagrams, describe what they show AND list all text labels
- Keep vocabulary terms, definitions, formulas, and key concepts
- Maintain the original organization as much as possible
- Do NOT add your own commentary — just extract the content
- Return ONLY the extracted notes, nothing else

Filename: ${filename || 'image'}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const extractedText = data.content[0].text;
    return res.status(200).json({ text: extractedText, tokens: data.usage?.input_tokens });

  } catch (err) {
    console.error('Extract error:', err);
    return res.status(500).json({ error: 'Failed to extract text from image' });
  }
}

/* ═══════════════════════════════════════════════
   Hati Safi — Vercel Function: api/legal-question.js
   Handles "Ask a Legal Question" tab
═══════════════════════════════════════════════ */

export default async function handler(req, res) {

  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, language } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'No question provided' });
    }

    const lang = language || 'English';

    const systemPrompt = `You are a Kenyan legal information assistant. Help people understand Kenyan law and government services.

Respond in ${lang} using plain, simple language anyone can understand.

Return ONLY this JSON (no markdown, no backticks, no extra text):
{
  "headline": "Short headline summarising the answer",
  "answer": "Clear 4-8 sentence answer mentioning specific Kenya laws or policy numbers if relevant.",
  "steps": ["Practical action step 1", "Practical action step 2"],
  "contacts": [
    { "name": "Organisation", "detail": "Contact info and what they offer", "icon": "emoji" }
  ],
  "sources": []
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: question,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    const rawText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const clean  = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const match  = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean);

    return res.status(200).json({ success: true, result: parsed });

  } catch (err) {
    console.error('legal-question error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

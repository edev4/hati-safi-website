/* ═══════════════════════════════════════════════
   Hati Safi — Netlify Function: legal-question.js
   Handles "Ask a Legal Question" tab with web search
═══════════════════════════════════════════════ */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { question, language } = JSON.parse(event.body);
    if (!question) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No question provided' }) };

    const lang = language || 'English';

    const systemPrompt = `You are a Kenyan legal information assistant. ALWAYS use web_search to find current, authentic information from official Kenyan sources before answering.

Search for:
1. The specific Kenya law or regulation being asked about
2. Official Kenya government sources (gov.ke, judiciary.go.ke, kra.go.ke, etc.)
3. Recent policy news and updates
4. Kenya Law Reform or Kenya Gazette entries
5. Free legal aid contacts relevant to the question

Respond in ${lang} using plain, simple language anyone can understand.

Return ONLY this JSON (no markdown, no backticks):
{
  "headline": "Short headline summarising the answer",
  "answer": "Clear 4-8 sentence answer. Mention specific Kenya laws, sections, or policy numbers found in research.",
  "steps": ["Practical action step 1", "Practical action step 2"],
  "contacts": [
    { "name": "Organisation", "detail": "Contact info and what they offer", "icon": "emoji" }
  ],
  "sources": [
    { "title": "Page title", "url": "https://url", "snippet": "Brief relevant extract" }
  ]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: question + '\n\nSearch online for current Kenya-specific information before answering.',
        }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);

    const data = await response.json();
    const rawText = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, result: parsed }),
    };

  } catch (err) {
    console.error('legal-question error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

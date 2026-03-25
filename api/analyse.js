/* ═══════════════════════════════════════════════
   Hati Safi — Vercel Function: api/analyse.js
   Secure proxy to Anthropic API for document analysis
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
    const { fileBase64, fileType, question, language } = req.body;

    if (!fileBase64 || !fileType) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    const lang     = language || 'English';
    const isImage  = fileType.startsWith('image/');
    const isPdf    = fileType === 'application/pdf';

    // Build content for Claude
    const userContent = [];

    if (isImage) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: fileType, data: fileBase64 },
      });
    } else if (isPdf) {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
      });
    }

    userContent.push({
      type: 'text',
      text: question
        ? `Analyse this document and answer my specific question: "${question}".`
        : 'Analyse this document thoroughly and explain it in plain language.',
    });

    const systemPrompt = `You are Hati Safi, an expert AI assistant helping ordinary Kenyans understand government documents and legal letters.

Respond in ${lang} using plain, everyday language. No legal jargon.

Return ONLY a valid JSON object — no markdown, no backticks, no extra text:

{
  "docType": "Specific document type e.g. HELB Loan Default Letter",
  "risk": "low|medium|high",
  "riskExplanation": "1-2 sentence plain explanation of risk level",
  "summary": "4-6 sentence plain-language summary of what this document means for the person",
  "answerToQuestion": "Direct answer to user question if asked, otherwise empty string",
  "keyTerms": [
    { "term": "Legal term", "definition": "Plain English definition in 1-2 sentences" }
  ],
  "actionSteps": [
    "Specific action step with who to contact and how"
  ],
  "deadlines": [
    "Date/timeframe found in document with consequences of missing it"
  ],
  "helpResources": [
    { "name": "Organisation", "description": "What help they offer + contact info", "icon": "emoji" }
  ],
  "webSources": [],
  "liveResearchSummary": ""
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
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    const rawText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!rawText.trim()) throw new Error('Empty response from AI');

    const clean  = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const match  = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean);

    return res.status(200).json({ success: true, result: parsed });

  } catch (err) {
    console.error('analyse function error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

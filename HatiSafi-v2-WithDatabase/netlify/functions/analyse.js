/* ═══════════════════════════════════════════════
   Hati Safi — Netlify Function: analyse.js
   Secure proxy to Anthropic API for document analysis
   API key is stored in Netlify environment variables
═══════════════════════════════════════════════ */

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers — allow your GitHub Pages / Netlify domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(event.body);
    const { fileBase64, fileType, question, language } = body;

    if (!fileBase64 || !fileType) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing file data' }) };
    }

    const lang = language || 'English';
    const isImage = fileType.startsWith('image/');
    const isPdf = fileType === 'application/pdf';

    // Build content for Claude
    const userContent = [];

    if (isImage) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: fileType, data: fileBase64 } });
    } else if (isPdf) {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } });
    }

    userContent.push({
      type: 'text',
      text: question
        ? `Analyse this document and answer my specific question: "${question}". Also search online for current Kenya laws relevant to this document.`
        : 'Analyse this document thoroughly. Search online for current Kenya laws, official government sources (sha.go.ke, helb.co.ke, kra.go.ke, ppra.go.ke) relevant to this document type.',
    });

    const systemPrompt = `You are Hati Safi, an expert AI assistant helping ordinary Kenyans understand government documents and legal letters. You have web search capability — ALWAYS use it to find current Kenya laws and official sources before responding.

Search for:
- The latest Kenya laws and regulations for the document type
- Official government pages (sha.go.ke, helb.co.ke, kra.go.ke, ppra.go.ke, judiciary.go.ke)
- Free legal aid contacts in Kenya
- Recent policy changes or updates

Respond in ${lang} using plain, everyday language. No legal jargon.

Return ONLY a valid JSON object — no markdown, no backticks:

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
  "webSources": [
    { "title": "Page title", "url": "https://url", "snippet": "Brief relevant extract" }
  ],
  "liveResearchSummary": "2-3 sentences on what you found online that backs this analysis"
}`;

    // Call Anthropic API — key comes from Netlify environment variable
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
        max_tokens: 4000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text blocks (after tool use)
    const rawText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!rawText.trim()) throw new Error('Empty response from AI');

    // Parse JSON from response
    const clean = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, result: parsed }),
    };

  } catch (err) {
    console.error('analyse function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

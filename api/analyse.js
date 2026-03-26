/* ═══════════════════════════════════════════════
   Hati Safi — Vercel Function: api/analyse.js
   OpenAI (primary) → Anthropic → Gemini (fallbacks)
═══════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileBase64, fileType, question, language } = req.body;

    if (!fileBase64 || !fileType) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    const lang    = language || 'English';
    const isImage = fileType.startsWith('image/');
    const isPdf   = fileType === 'application/pdf';

    const systemPrompt = `You are Hati Safi, an expert AI assistant helping ordinary Kenyans understand government documents and legal letters.
Respond in ${lang} using plain, everyday language. No legal jargon.
Return ONLY a valid JSON object — no markdown, no backticks, no extra text:
{
  "docType": "Specific document type e.g. HELB Loan Default Letter",
  "risk": "low|medium|high",
  "riskExplanation": "1-2 sentence plain explanation of risk level",
  "summary": "4-6 sentence plain-language summary of what this document means for the person",
  "answerToQuestion": "Direct answer to user question if asked, otherwise empty string",
  "keyTerms": [{ "term": "Legal term", "definition": "Plain English definition in 1-2 sentences" }],
  "actionSteps": ["Specific action step with who to contact and how"],
  "deadlines": ["Date/timeframe found in document with consequences of missing it"],
  "helpResources": [{ "name": "Organisation", "description": "What help they offer + contact info", "icon": "emoji" }],
  "webSources": [],
  "liveResearchSummary": ""
}`;

    const userText = question
      ? `Analyse this document and answer my specific question: "${question}".`
      : 'Analyse this document thoroughly and explain it in plain language.';

    // ── 1. Try OpenAI first ──────────────────────
    if (process.env.OPENAI_API_KEY) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
        ];

        // Build user message with file
        const userContent = [];

        if (isImage) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${fileType};base64,${fileBase64}` },
          });
        } else if (isPdf) {
          // OpenAI doesn't support PDFs directly — send as file with text instruction
          userContent.push({
            type: 'text',
            text: 'I am uploading a PDF document. Please analyse it based on the text content.',
          });
        }

        userContent.push({ type: 'text', text: userText });
        messages.push({ role: 'user', content: userContent });

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 1500,
            messages,
          }),
        });

        const openaiData = await openaiRes.json();

        // Check for billing/quota errors
        const isError =
          openaiData?.error?.code === 'insufficient_quota' ||
          openaiData?.error?.type === 'insufficient_quota' ||
          openaiData?.error;

        if (!isError && openaiRes.ok) {
          const rawText = openaiData.choices?.[0]?.message?.content || '';
          if (rawText.trim()) {
            const clean  = rawText.replace(/```json\n?|```\n?/g, '').trim();
            const match  = clean.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(match ? match[0] : clean);
            console.log('Served by OpenAI');
            return res.status(200).json({ success: true, result: parsed });
          }
        }
        console.warn('OpenAI failed:', openaiData?.error?.message || 'unknown error');
      } catch (e) {
        console.warn('OpenAI error:', e.message);
      }
    }

    // ── 2. Try Anthropic ─────────────────────────
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const userContent = [];
        if (isImage) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: fileType, data: fileBase64 } });
        } else if (isPdf) {
          userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } });
        }
        userContent.push({ type: 'text', text: userText });

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
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

        const anthropicData = await anthropicRes.json();
        const isCreditsError =
          anthropicData?.type === 'error' ||
          anthropicData?.error?.message?.toLowerCase().includes('credit') ||
          anthropicData?.error?.message?.toLowerCase().includes('billing');

        if (!isCreditsError && anthropicRes.ok) {
          const rawText = anthropicData.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
          if (rawText.trim()) {
            const clean  = rawText.replace(/```json\n?|```\n?/g, '').trim();
            const match  = clean.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(match ? match[0] : clean);
            console.log('Served by Anthropic');
            return res.status(200).json({ success: true, result: parsed });
          }
        }
        console.warn('Anthropic failed:', anthropicData?.error?.message || 'unknown error');
      } catch (e) {
        console.warn('Anthropic error:', e.message);
      }
    }

    // ── 3. Try Gemini ────────────────────────────
    if (process.env.GEMINI_API_KEY) {
      try {
        const parts = [];
        if (isImage || isPdf) {
          parts.push({
            inline_data: {
              mime_type: isImage ? fileType : 'application/pdf',
              data: fileBase64,
            },
          });
        }
        parts.push({ text: systemPrompt + '\n\n' + userText });

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
            }),
          }
        );

        const geminiData = await geminiRes.json();
        if (geminiRes.ok) {
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText.trim()) {
            const clean  = rawText.replace(/```json\n?|```\n?/g, '').trim();
            const match  = clean.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(match ? match[0] : clean);
            console.log('Served by Gemini');
            return res.status(200).json({ success: true, result: parsed });
          }
        }
        console.warn('Gemini failed:', geminiData?.error?.message || 'unknown error');
      } catch (e) {
        console.warn('Gemini error:', e.message);
      }
    }

    throw new Error('All AI providers failed or have no credits. Please check your API keys in Vercel settings.');

  } catch (err) {
    console.error('analyse error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

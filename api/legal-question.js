/* ═══════════════════════════════════════════════
   Hati Safi — Vercel Function: api/legal-question.js
   OpenAI (primary) → Anthropic → Gemini (fallbacks)
═══════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, language } = req.body;
    if (!question) return res.status(400).json({ error: 'No question provided' });

    const lang = language || 'English';

    const systemPrompt = `You are a Kenyan legal information assistant. Help people understand Kenyan law and government services.
Respond in ${lang} using plain, simple language anyone can understand.
Return ONLY this JSON (no markdown, no backticks, no extra text):
{
  "headline": "Short headline summarising the answer",
  "answer": "Clear 4-8 sentence answer mentioning specific Kenya laws or policy numbers if relevant.",
  "steps": ["Practical action step 1", "Practical action step 2"],
  "contacts": [{ "name": "Organisation", "detail": "Contact info and what they offer", "icon": "emoji" }],
  "sources": []
}`;

    // ── 1. Try OpenAI first ──────────────────────
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 1500,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: question },
            ],
          }),
        });

        const openaiData = await openaiRes.json();
        const isError = openaiData?.error;

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
            messages: [{ role: 'user', content: question }],
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
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt + '\n\nQuestion: ' + question }] }],
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
    console.error('legal-question error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

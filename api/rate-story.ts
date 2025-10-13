// /api/rateStory.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

type Category = 'humor' | 'creativity' | 'coherence' | 'overall';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { story, locale, categories } = req.body ?? {};
    if (!story || typeof story !== 'string') {
      return res.status(400).json({ error: 'Missing story text' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Server not configured' });

    const cats: Category[] = (Array.isArray(categories) && categories.length
      ? categories
      : ['humor', 'creativity', 'coherence', 'overall']
    ).filter((c): c is Category => ['humor', 'creativity', 'coherence', 'overall'].includes(c));

    const sys = `
You are a concise story rater. Return strict JSON with 1–5 integer scores per requested category and a short note.
Schema:
{
  "ratings": { "<category>": 1|2|3|4|5, ... },
  "note": string
}
Guidelines:
- Rate ONLY requested categories.
- Humor: funniness (wordplay, surprise, absurdity).
- Creativity: originality, imaginative turns.
- Coherence: clarity, flow, payoff.
- Overall: overall entertainment value (not an average; your judgment).
- Keep "note" one or two short sentences.
- Do not include any extra fields.`;

    const user = `Locale: ${locale || 'en'}
Categories: ${cats.join(', ')}
Story:
"""
${story}
"""`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
    });

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'No response from OpenAI' });

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'Invalid JSON from model' }); }

    // Normalize and clamp 1–5
    const ratings: Record<string, number> = {};
    for (const c of cats) {
      const raw = parsed?.ratings?.[c];
      const n = Math.min(5, Math.max(1, Math.round(Number(raw) || 0))) || 1;
      ratings[c] = n;
    }
    const note = typeof parsed?.note === 'string' ? parsed.note : '';

    res.status(200).json({ ratings, note });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}

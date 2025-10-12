import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { word, locale, requiredPOS } = req.body;
  if (!word || typeof word !== 'string' || word.length > 40) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Classify one token. Return {"valid": boolean, "pos": ["noun"|"verb"|"adjective"|"adverb"|"properNoun"], "base": string}.' },
          { role: 'user', content: `Locale:${locale||'en'} Word:"${word}" RequiredPOS:${requiredPOS||'none'}` }
        ],
      }),
    });

    const data = await r.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    const pos = Array.isArray(parsed.pos) ? parsed.pos : [];
    const base = typeof parsed.base === 'string' ? parsed.base : word;
    const valid = Boolean(parsed.valid) && (requiredPOS ? pos.includes(requiredPOS) : pos.length > 0);

    res.setHeader('Access-Control-Allow-Origin', '*'); // for now, you can lock down later
    return res.status(200).json({ valid, pos, base });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

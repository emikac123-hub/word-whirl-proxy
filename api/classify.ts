import type { VercelRequest, VercelResponse } from "@vercel/node";

const allowOrigin = "*"; // lock down later

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);

    const { word, locale, requiredPOS } = req.body ?? {};
    if (!word || typeof word !== "string" || word.length > 40) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return res
        .status(500)
        .json({ error: "Server not configured (missing API key)" });
    }

    const sys =
      "You are a multilingual lexicon checker. " +
      "Given a single token and its language, determine if it exists as a real word in that language. " +
      "Return ONLY valid JSON in the following format: " +
      '{"exists": boolean, "confidence": number}. ' +
      '"exists" should be true if the word is commonly used or appears in standard dictionaries for that language. ' +
      "Ignore capitalization and accent variations. " +
      "Do not classify part of speech or give examples.";
    const user = `Language: "${locale}"\nWord: "${word}"\n\nDoes this word exist as a valid word in the given language?`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });

    const raw = await r.text(); // read as text first for better logging
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("OpenAI non-JSON response:", raw);
      return res
        .status(502)
        .json({ error: "Upstream error (non-JSON from OpenAI)" });
    }

    if (!r.ok) {
      console.error("OpenAI error:", r.status, data);
      const msg = data?.error?.message || `OpenAI request failed (${r.status})`;
      return res.status(502).json({ error: msg });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("OpenAI response missing content:", data);
      return res.status(502).json({ error: "OpenAI response missing content" });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Invalid JSON from model:", content);
      return res.status(502).json({ error: "Invalid JSON from model" });
    }

    const pos = Array.isArray(parsed.pos) ? parsed.pos : [];
    const base = typeof parsed.base === "string" ? parsed.base : word;
    const valid =
      Boolean(parsed.valid) &&
      (requiredPOS ? pos.includes(requiredPOS) : pos.length > 0);

    return res.status(200).json({ valid, pos, base });
  } catch (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

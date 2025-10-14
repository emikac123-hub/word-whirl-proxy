import { createApiHandler } from "./_lib/handler";
import { fetchChatCompletion } from "./_lib/openai";

type Category = "humor" | "creativity" | "coherence" | "overall";
const ALL_CATEGORIES: Category[] = [
  "humor",
  "creativity",
  "coherence",
  "overall",
];

export default createApiHandler(async (req, res, { apiKey }) => {
  const { story, locale, categories } = req.body ?? {};
  if (!story || typeof story !== "string") {
    return res.status(400).json({ error: "Missing story text" });
  }

  const cats: Category[] = (
    Array.isArray(categories) && categories.length ? categories : ALL_CATEGORIES
  ).filter((c): c is Category => ALL_CATEGORIES.includes(c));

  const systemPrompt = `
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

  const userPrompt = `Locale: ${locale || "en"}
Categories: ${cats.join(", ")}
Story:
"""
${story}
"""`;

  try {
    const parsed = await fetchChatCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
      temperature: 0.4,
    });

    // Normalize and clamp 1–5
    const ratings: Record<string, number> = {};
    for (const c of cats) {
      const raw = parsed?.ratings?.[c];
      const n = Math.min(5, Math.max(1, Math.round(Number(raw) || 0))) || 1;
      ratings[c] = n;
    }
    const note = typeof parsed?.note === "string" ? parsed.note : "";

    res.status(200).json({ ratings, note });
  } catch (err: any) {
    // Errors from fetchChatCompletion are already logged
    return res.status(502).json({ error: err.message });
  }
});

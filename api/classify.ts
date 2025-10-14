import { createApiHandler } from "./_lib/handler";
import { fetchChatCompletion } from "./_lib/openai";

export default createApiHandler(async (req, res, { apiKey }) => {
  const { word, locale, requiredPOS } = req.body ?? {};
  if (!word || typeof word !== "string" || word.length > 40) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const systemPrompt =
    "You are a multilingual lexicon checker. " +
    "Given a single token and its language, determine if it exists as a real word in that language. " +
    'Return ONLY valid JSON in the following format: {"exists": boolean, "confidence": number}. ' +
    '"exists" should be true if the word is commonly used or appears in standard dictionaries for that language. ' +
    "Ignore capitalization and accent variations. " +
    "Do not classify part of speech or give examples.";

  const userPrompt = `Language: "${locale}"\nWord: "${word}"\n\nDoes this word exist as a valid word in the given language?`;

  try {
    const parsed = await fetchChatCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
    });

    const pos = Array.isArray(parsed.pos) ? parsed.pos : [];
    const base = typeof parsed.base === "string" ? parsed.base : word;
    const valid =
      Boolean(parsed.valid) &&
      (requiredPOS ? pos.includes(requiredPOS) : pos.length > 0);

    return res.status(200).json({ valid, pos, base });
  } catch (err: any) {
    // Errors from fetchChatCompletion are already logged
    return res.status(502).json({ error: err.message });
  }
});

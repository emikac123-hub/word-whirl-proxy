import { createApiHandler } from "./_lib/handler";
import { fetchChatCompletion } from "./_lib/openai";

export default createApiHandler(async (req, res, { apiKey }) => {
  const { number, locale } = req.body ?? {};

  if (typeof number !== "number" || !locale) {
    return res.status(400).json({
      error: `Missing 'number' or 'locale' in request body`,
    });
  }

  const language = (locale || "en").split("-")[0];

  const systemPrompt = `
YouYou are a translator that converts numbers into their ordinal word form in the target language.
Examples:
1 in English → first
2 in English → second
3 in English → third
1 in French → premier
2 in Spanish → segundo
1 in Japanese → 第1番 (だいいちばん)
2 in Japanese → 第2番 (だいにばん)

Now convert the given number into an ordinal in the given language.
Return ONLY valid JSON in the following format: {"ordinal": "<the ordinal word>"}
`;

  const userPrompt = `Language: ${language}\nNumber: ${number}`;

  try {
    const parsed = await fetchChatCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });

    const ordinal = parsed?.ordinal || "";

    res.status(200).json({ ordinal });
  } catch (err: any) {
    // Errors from fetchChatCompletion are already logged
    return res.status(502).json({ error: err.message });
  }
});

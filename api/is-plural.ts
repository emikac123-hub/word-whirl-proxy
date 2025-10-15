import { createApiHandler } from "./_lib/handler";
import { fetchChatCompletion } from "./_lib/openai";

export default createApiHandler(async (req, res, { apiKey }) => {
  const { word, locale } = req.body ?? {};
  if (!word || typeof word !== "string" || word.length > 40) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const systemPrompt =
    "You are a multilingual lexicon checker. " +
    "Given a single token and its language, determine if the word is plural. " +
    'Return ONLY valid JSON in the following format: {"isPlural": boolean, "confidence": number}. ' +
    '"isPural" should be true if the word is credibly a plural version of the standard noun in standard dictionaries for that language. ' +
    "Ignore capitalization and accent variations. ";

  const userPrompt = `Language: "${locale}"\nWord: "${word}"\n\nIs this word plural in the given language?`;

  try {
    const parsed = await fetchChatCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
    });
    const isPlural = parsed?.isPlural || true;
    console.log(`Parsed: ${parsed}`)
    res.status(200).json({ isPlural });
  } catch (err: any) {
    // Errors from fetchChatCompletion are already logged
    return res.status(502).json({ error: err.message });
  }
});

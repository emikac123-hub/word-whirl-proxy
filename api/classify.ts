import { createApiHandler } from "./_lib/handler";
import { fetchChatCompletion } from "./_lib/openai";

export default createApiHandler(async (req, res, { apiKey }) => {
  const { word, locale, requiredPOS } = req.body ?? {};
  if (!word || typeof word !== "string" || word.length > 40) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const systemPrompt =
    "You are a multilingual lexicon checker. " +
    "Given a single token and its language, determine if it exists as a real word in that language. Provide the parts of speech it is associated with.";
  "A given 'type' of the word will be provided. If it matches that type, requiredPos should be true. Otherwise false. For example, if the type is 'material'" +
    " 'cotton' would return true, but 'dog' would return false." +
    'Return ONLY valid JSON in the following format: {"exists": boolean, "confidence": number, "pos": string[], "requiredPos": boolean}. ' +
    '"exists" should be true if the word is commonly used or appears in standard dictionaries for that language. ' +
    "Ignore capitalization and accent variations. " +
    "Do not classify part of speech or give examples.";
  const userPrompt = `Type: ${requiredPOS} Language: "${locale}"\nWord: "${word}"\n\nDoes this word exist as a valid word in the given language? Does the type provided match?`;

  try {
    const parsed = await fetchChatCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
    });

    const pos = Array.isArray(parsed.pos) ? parsed.pos : [];
    const confidence = parsed.confidence;
    const valid = Boolean(parsed.exists);
    const requiredPos = Boolean(parsed.requiredPos);
    return res.status(200).json({ valid, confidence, pos, requiredPos });
  } catch (err: any) {
    // Errors from fetchChatCompletion are already logged
    return res.status(502).json({ error: err.message });
  }
});

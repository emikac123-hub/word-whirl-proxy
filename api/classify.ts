import { createApiHandler } from "./_lib/handler";
import { fetchChatCompletion } from "./_lib/openai";

export default createApiHandler(async (req, res, { apiKey }) => {
  // Accept BOTH the new keys and the old keys for back-compat
  const body = req.body ?? {};
  const word: string | undefined = body.word;

  // Normalize to a single set we use below
  const locale: string =
    typeof body.locale === "string" && body.locale
      ? body.locale
      : typeof body.appLanguage === "string" && body.appLanguage
      ? body.appLanguage
      : "en";

  const requiredPOS: string | null =
    body.requiredPOS ?? body.requestedPos ?? null;

  if (!word || typeof word !== "string" || word.length > 40) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const systemPrompt = [
    "You are a multilingual lexicon checker.",
    "Given a single token and its language, determine if it exists as a real word in that language.",
    "Provide the parts of speech it is associated with.",
    "A given 'type' of the word will be provided. If it matches that type, 'valid' should be true, otherwise false.",
    "For example, if the type is 'material', the type 'cotton' would return true, but 'dog' would return false.",
    // include the literal word 'json' to satisfy response_format guards

    // Add to the systemPrompt lines:
    'Also include a "tags" array of simple semantic categories (e.g. food, liquid, animal, material, color, duration, container, location, person, vehicle, toy, plant, weather, emotion). Use 0–3 tags only when clearly applicable.',
    'Return ONLY valid json in this exact shape: {"exists": boolean, "valid": boolean "confidence": number, "pos": string[], "tags": string[]}\n',
    'Summary: exists represents if the word exists in that langauge. Valid represents a boolean if it matches the TYPE passed in.',
    "Output json only—no explanation.",
  ].join(" ");

  const userPrompt =
    `Type: ${requiredPOS}\n` +
    `Language: "${locale}"\n` +
    `Word: "${word}"\n\n` +
    "Does this word exist as a valid word in the given language? Does the type provided match?";

  try {
    const parsed = await fetchChatCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
      // assuming your wrapper sets response_format: { type: "json_object" }
    });

    // Normalize/guard fields from the model
    const pos = Array.isArray(parsed.pos) ? parsed.pos : [];
    const valid = !!parsed.valid
    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const confidence =
      typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const exists = !!parsed.exists;
    // Your app expects: { valid, confidence, pos, requiredPos }
    // Where 'valid' reflects existence (you previously mapped this way)
    // and 'requiredPos' means "matches requested type/POS".
    return res.status(200).json({
      exists,
      valid,
      confidence,
      pos,
      tags,
    });
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
});

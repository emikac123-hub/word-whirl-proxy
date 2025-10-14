
export interface ChatCompletionOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export async function fetchChatCompletion(options: ChatCompletionOptions) {
  const { apiKey, systemPrompt, userPrompt, temperature = 0 } = options;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const raw = await r.text(); // read as text first for better logging
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("OpenAI non-JSON response:", raw);
    throw new Error("Upstream error (non-JSON from OpenAI)");
  }

  if (!r.ok) {
    console.error("OpenAI error:", r.status, data);
    const msg = data?.error?.message || `OpenAI request failed (${r.status})`;
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("OpenAI response missing content:", data);
    throw new Error("OpenAI response missing content");
  }

  try {
    return JSON.parse(content);
  } catch {
    console.error("Invalid JSON from model:", content);
    throw new Error("Invalid JSON from model");
  }
}

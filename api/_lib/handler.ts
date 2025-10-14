
import type { VercelRequest, VercelResponse } from "@vercel/node";

const allowOrigin = "*"; // lock down later

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
  context: { apiKey: string }
) => Promise<VercelResponse | void>;

export function createApiHandler(handler: ApiHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      return res.status(204).end();
    }

    res.setHeader("Access-Control-Allow-Origin", allowOrigin);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return res
        .status(500)
        .json({ error: "Server not configured (missing API key)" });
    }

    try {
      await handler(req, res, { apiKey: OPENAI_API_KEY });
    } catch (err) {
      console.error("Unhandled error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

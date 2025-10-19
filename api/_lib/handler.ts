// api/_lib/handler.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

/** <<< EDIT THESE >>> */
const PROD_ORIGINS = [
  "https://wordwhirl.app",
  "https://www.wordwhirl.app",
  // add any other production frontends here
];
const DEV_ORIGINS = [
  "http://192.168.4.115:8081",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:19006", // Expo web
];

/** Helpers */
function isPrivateLan(host: string) {
  return (
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)
  );
}

function resolveAllowedOrigin(originHeader?: string | null): string | null {
  if (!originHeader) return null;
  try {
    const u = new URL(originHeader);
    const allow = new Set([...PROD_ORIGINS, ...DEV_ORIGINS]);
    if (allow.has(originHeader)) return originHeader;
    if (isPrivateLan(u.hostname)) return originHeader; // allow LAN during dev
  } catch {
    // ignore parse errors => disallow
  }
  return null;
}

function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  opts?: {
    allowCredentials?: boolean;
    allowMethods?: string[];
    allowHeaders?: string[];
    maxAgeSeconds?: number;
  }
) {
  const {
    allowCredentials = true,
    allowMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders = ["Content-Type", "Authorization", "X-Requested-With", "X-Story-Id", "X-Pack-Id"],
    maxAgeSeconds = 86400,
  } = opts || {};

  const origin = resolveAllowedOrigin(req.headers.origin as string | undefined);

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (allowCredentials) res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  // If origin not allowed, do NOT set ACAO; browser will block.

  res.setHeader("Vary", "Origin"); // crucial for caching/CDN correctness
  res.setHeader("Access-Control-Allow-Methods", allowMethods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", allowHeaders.join(", "));
  res.setHeader("Access-Control-Max-Age", String(maxAgeSeconds));
}

function handlePreflight(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

/** Your route handler type */
type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
  context: { apiKey: string }
) => Promise<VercelResponse | void>;

/** Factory */
export function createApiHandler(handler: ApiHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Always handle preflight first and return quickly
    if (handlePreflight(req, res)) return;

    // Apply CORS to actual request, too
    applyCors(req, res, {
      allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Story-Id", "X-Pack-Id"],
    });

    // Ensure JSON errors are readable by browsers (CORS already set)
    res.setHeader("Content-Type", "application/json; charset=utf-8");

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
      // Include CORS on errors too (already applied above)
      res.status(500).json({ error: "Server error" });
    }
  };
}

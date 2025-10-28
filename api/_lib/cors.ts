// api/_lib/cors.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// Put your real app domains here:
const PROD_ORIGINS = [
  "https://wordwhirl.app",
  "https://www.wordwhirl.app",
  "https://word-whirl-proxy.vercel.app",
  "https://word-whirl-proxy-b55q.vercel.app"
  // Add your mobile WebView origin(s) if any
];

// Helpful in dev: localhost + LAN IPs (Expo, emulators)
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:19006",
  "http://127.0.0.1:3000",
];

function isLanOrigin(origin: string) {
  try {
    const u = new URL(origin);
    return /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)
        || /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)
        || /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin);
  } catch {
    return false;
  }
}

function resolveAllowedOrigin(originHeader?: string | null): string | null {
  if (!originHeader) return null;
  // Exact allowlist
  const allow = new Set([...PROD_ORIGINS, ...DEV_ORIGINS]);
  if (allow.has(originHeader)) return originHeader;
  // Allow local LAN during dev to support physical devices
  if (isLanOrigin(originHeader)) return originHeader;
  return null;
}

export function applyCors(req: NextApiRequest, res: NextApiResponse, opts?: {
  allowCredentials?: boolean;
  allowMethods?: string[];
  allowHeaders?: string[];
  maxAgeSeconds?: number;
}) {
  const {
    allowCredentials = true,
    allowMethods = ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowHeaders = ["Content-Type","Authorization","X-Requested-With"],
    maxAgeSeconds = 86400, // cache preflight for a day
  } = opts || {};

  const origin = resolveAllowedOrigin(req.headers.origin as string | undefined);

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    // If you plan to use cookies or Authorization: Bearer from browsers:
    if (allowCredentials) res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    // If not allowed, do NOT set ACAO (browser will block)
  }

  res.setHeader("Vary", "Origin"); // important for CDN correctness
  res.setHeader("Access-Control-Allow-Methods", allowMethods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", allowHeaders.join(", "));
  res.setHeader("Access-Control-Max-Age", String(maxAgeSeconds));
}

export function handlePreflight(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    // Apply headers first so the browser accepts the 204 as a valid preflight
    applyCors(req, res);
    res.status(204).end();
    return true; // we handled it
  }
  return false; // not a preflight
}

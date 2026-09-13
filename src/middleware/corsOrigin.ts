import type { CorsOptions } from "cors";
import { ENV } from "../_core/env.js";

export const LIVE_APP_ORIGIN = "https://appforge-unfurling-moon-9058.fly.dev";

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function allowedCorsOrigins(): Set<string> {
  const configured = (
    process.env.CORS_ORIGIN ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  )
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  const allowed = new Set<string>([LIVE_APP_ORIGIN, ...configured]);
  if (!ENV.isProduction) {
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:5173");
    allowed.add("http://127.0.0.1:3000");
    allowed.add("http://127.0.0.1:5173");
  }
  return allowed;
}

/**
 * Allow only exact live/configured browser origins. Requests without an Origin
 * are permitted because CORS is a browser boundary, not an API authentication
 * mechanism; protected routes still require normal authentication/CSRF checks.
 */
export const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const normalized = normalizeOrigin(origin);
  callback(null, Boolean(normalized && allowedCorsOrigins().has(normalized)));
};

import type { CorsOptions } from "cors";
import { ENV } from "../_core/env.js";

export function normalizeCorsOrigin(
  value: string,
  requireHttps = ENV.isProduction,
): string | null {
  try {
    const parsed = new URL(value.trim());
    const validProtocol =
      parsed.protocol === "https:" ||
      (!requireHttps && parsed.protocol === "http:");
    if (!validProtocol) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function allowedCorsOrigins(
  isProduction = ENV.isProduction,
  configuredValue = process.env.CORS_ORIGIN ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "",
): Set<string> {
  const configured = configuredValue
    .split(",")
    .map((value) => normalizeCorsOrigin(value, isProduction))
    .filter((value): value is string => Boolean(value));

  const allowed = new Set<string>(configured);
  if (!isProduction) {
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:5173");
    allowed.add("http://127.0.0.1:3000");
    allowed.add("http://127.0.0.1:5173");
  }
  return allowed;
}

/**
 * Allow only exact live/configured browser origins. Production only accepts
 * HTTPS origins, preventing a misconfigured CORS env value from authorizing an
 * insecure HTTP browser origin. Requests without an Origin are permitted
 * because CORS is a browser boundary, not an API authentication mechanism;
 * protected routes still require normal authentication/CSRF checks.
 */
export const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const normalized = normalizeCorsOrigin(origin, ENV.isProduction);
  callback(
    null,
    Boolean(normalized && allowedCorsOrigins(ENV.isProduction).has(normalized)),
  );
};

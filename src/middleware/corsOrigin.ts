import type { CorsOptions } from "cors";
import { ENV } from "../_core/env.js";

export const LIVE_APP_ORIGIN = "https://appforge-unfurling-moon-9058.fly.dev";

function allowedCorsOrigins(): Set<string> {
  const extras = (
    process.env.CORS_ORIGIN ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  )
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowed = new Set<string>([LIVE_APP_ORIGIN, ...extras]);
  if (!ENV.isProduction) {
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:5173");
    allowed.add("http://127.0.0.1:3000");
    allowed.add("http://127.0.0.1:5173");
  }
  return allowed;
}

/**
 * Allow the live Fly origin, configured origins, and requests with no Origin
 * (mobile browsers / in-app webviews). Never error on a missing Origin.
 */
export const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }
  const normalized = origin.replace(/\/$/, "");
  if (allowedCorsOrigins().has(normalized)) {
    callback(null, origin);
    return;
  }
  try {
    if (new URL(origin).hostname === "appforge-unfurling-moon-9058.fly.dev") {
      callback(null, origin);
      return;
    }
  } catch {
    /* ignore invalid Origin */
  }
  callback(null, false);
};

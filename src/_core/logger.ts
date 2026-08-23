// ── Structured logger (pino-style wrapper) ──
// In production, this should be replaced with real pino or logtail drain.
// Stub implementation for now.

export const logger = {
  info: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.log(`[INFO] ${obj}`);
    } else {
      console.log(`[INFO] ${msg ?? ""}`, JSON.stringify(obj));
    }
  },
  warn: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.warn(`[WARN] ${obj}`);
    } else {
      console.warn(`[WARN] ${msg ?? ""}`, JSON.stringify(obj));
    }
  },
  error: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.error(`[ERROR] ${obj}`);
    } else {
      console.error(`[ERROR] ${msg ?? ""}`, JSON.stringify(obj));
    }
  },
  debug: (obj: Record<string, unknown> | string, msg?: string) => {
    if (process.env.NODE_ENV !== "production") {
      if (typeof obj === "string") {
        console.log(`[DEBUG] ${obj}`);
      } else {
        console.log(`[DEBUG] ${msg ?? ""}`, JSON.stringify(obj));
      }
    }
  },
};
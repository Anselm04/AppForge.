// Structured application logger with recursive secret redaction.
// The output format remains console-compatible for Fly.io log collection.

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|password|passwd|api[-_]?key|session|credential|stripe[-_]?signature/i;
const MAX_DEPTH = 8;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[MaxDepth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      clean[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : sanitize(item, depth + 1);
    }
    return clean;
  }
  return value;
}

function serialize(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(sanitize(obj));
  } catch {
    return JSON.stringify({ logSerializationError: true });
  }
}

export const logger = {
  info: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.log(`[INFO] ${obj}`);
    } else {
      console.log(`[INFO] ${msg ?? ""}`, serialize(obj));
    }
  },
  warn: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.warn(`[WARN] ${obj}`);
    } else {
      console.warn(`[WARN] ${msg ?? ""}`, serialize(obj));
    }
  },
  error: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.error(`[ERROR] ${obj}`);
    } else {
      console.error(`[ERROR] ${msg ?? ""}`, serialize(obj));
    }
  },
  debug: (obj: Record<string, unknown> | string, msg?: string) => {
    if (process.env.NODE_ENV !== "production") {
      if (typeof obj === "string") {
        console.log(`[DEBUG] ${obj}`);
      } else {
        console.log(`[DEBUG] ${msg ?? ""}`, serialize(obj));
      }
    }
  },
};

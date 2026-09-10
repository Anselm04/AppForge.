// Structured application logger with recursive secret redaction.
// The output format remains console-compatible for Fly.io log collection.

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|password|passwd|api[-_]?key|session|credential|stripe[-_]?signature/i;
const SENSITIVE_STRING =
  /(authorization|cookie|token|secret|password|passwd|api[-_]?key|session|credential|stripe[-_]?signature)(\s*[:=]\s*)([^\s,;]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const MAX_DEPTH = 8;

function sanitizeString(value: string): string {
  return value
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(SENSITIVE_STRING, "$1$2[REDACTED]");
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[MaxDepth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack:
        process.env.NODE_ENV === "production"
          ? undefined
          : value.stack
            ? sanitizeString(value.stack)
            : undefined,
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
  if (typeof value === "string") return sanitizeString(value);
  return value;
}

function serialize(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(sanitize(obj));
  } catch {
    return JSON.stringify({ logSerializationError: true });
  }
}

function safeMessage(value: string): string {
  return sanitizeString(value);
}

export const logger = {
  info: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.log(`[INFO] ${safeMessage(obj)}`);
    } else {
      console.log(`[INFO] ${safeMessage(msg ?? "")}`, serialize(obj));
    }
  },
  warn: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.warn(`[WARN] ${safeMessage(obj)}`);
    } else {
      console.warn(`[WARN] ${safeMessage(msg ?? "")}`, serialize(obj));
    }
  },
  error: (obj: Record<string, unknown> | string, msg?: string) => {
    if (typeof obj === "string") {
      console.error(`[ERROR] ${safeMessage(obj)}`);
    } else {
      console.error(`[ERROR] ${safeMessage(msg ?? "")}`, serialize(obj));
    }
  },
  debug: (obj: Record<string, unknown> | string, msg?: string) => {
    if (process.env.NODE_ENV !== "production") {
      if (typeof obj === "string") {
        console.log(`[DEBUG] ${safeMessage(obj)}`);
      } else {
        console.log(`[DEBUG] ${safeMessage(msg ?? "")}`, serialize(obj));
      }
    }
  },
};

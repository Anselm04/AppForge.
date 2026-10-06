const SENSITIVE_KEY =
  /(?:authorization|cookie|password|passwd|secret|token|api[_-]?key|private[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|session)/i;
const MAX_DEPTH = 8;
const MAX_ARRAY = 100;
const MAX_KEYS = 200;
const MAX_STRING = 2_000;

export function sanitizeCapabilityMetadata(value: unknown): unknown {
  const visit = (current: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return "[TRUNCATED]";
    if (typeof current === "string") {
      return current.length > MAX_STRING
        ? `${current.slice(0, MAX_STRING)}…`
        : current;
    }
    if (
      current === null ||
      typeof current === "number" ||
      typeof current === "boolean" ||
      current === undefined
    ) {
      return current;
    }
    if (Array.isArray(current)) {
      return current.slice(0, MAX_ARRAY).map((item) => visit(item, depth + 1));
    }
    if (typeof current !== "object") return String(current);

    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      current as Record<string, unknown>,
    ).slice(0, MAX_KEYS)) {
      result[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : visit(child, depth + 1);
    }
    return result;
  };

  return visit(value, 0);
}

const SENSITIVE_KEY_PATTERN = /(?:authorization|cookie|password|passwd|secret|token|api[_-]?key|apikey|private[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|session)/i;
const MAX_DEPTH = 8;
const MAX_NODES = 1_000;
const MAX_STRING = 20_000;
const MAX_ARRAY = 250;

export function redactCapabilityMetadata(value: unknown): unknown {
  let nodes = 0;

  const visit = (current: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > MAX_NODES) return "[TRUNCATED]";
    if (depth > MAX_DEPTH) return "[MAX_DEPTH]";

    if (typeof current === "string") {
      return current.length > MAX_STRING
        ? `${current.slice(0, MAX_STRING)}[TRUNCATED]`
        : current;
    }
    if (
      current === null ||
      current === undefined ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      return current;
    }
    if (Array.isArray(current)) {
      return current.slice(0, MAX_ARRAY).map((item) => visit(item, depth + 1));
    }
    if (typeof current !== "object") return String(current);

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : visit(child, depth + 1);
    }
    return output;
  };

  return visit(value, 0);
}

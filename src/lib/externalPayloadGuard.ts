const SENSITIVE_KEY_PATTERN = /(?:^|[_-])(authorization|cookie|password|passwd|secret|token|api[_-]?key|private[_-]?key|service[_-]?role|access[_-]?key|refresh[_-]?token|session)(?:$|[_-])/i;
const MAX_DEPTH = 8;
const MAX_NODES = 1_000;
const MAX_STRING_LENGTH = 20_000;
const MAX_ARRAY_LENGTH = 250;

export class ExternalPayloadGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalPayloadGuardError";
  }
}

export function assertSafeExternalPayload(
  value: unknown,
  label = "external payload",
): void {
  let nodes = 0;

  const visit = (current: unknown, depth: number, path: string): void => {
    nodes += 1;
    if (nodes > MAX_NODES) {
      throw new ExternalPayloadGuardError(`${label} is too complex`);
    }
    if (depth > MAX_DEPTH) {
      throw new ExternalPayloadGuardError(`${label} is nested too deeply`);
    }

    if (typeof current === "string") {
      if (current.length > MAX_STRING_LENGTH) {
        throw new ExternalPayloadGuardError(`${label} contains an oversized string at ${path}`);
      }
      return;
    }

    if (
      current === null ||
      typeof current === "number" ||
      typeof current === "boolean" ||
      current === undefined
    ) {
      return;
    }

    if (Array.isArray(current)) {
      if (current.length > MAX_ARRAY_LENGTH) {
        throw new ExternalPayloadGuardError(`${label} contains an oversized array at ${path}`);
      }
      current.forEach((item, index) => visit(item, depth + 1, `${path}[${index}]`));
      return;
    }

    if (typeof current !== "object") {
      throw new ExternalPayloadGuardError(`${label} contains an unsupported value at ${path}`);
    }

    const record = current as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new ExternalPayloadGuardError(
          `${label} may not include credential-like field "${key}"`,
        );
      }
      visit(child, depth + 1, path ? `${path}.${key}` : key);
    }
  };

  visit(value, 0, "$root");
}

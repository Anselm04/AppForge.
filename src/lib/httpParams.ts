export type RouteParamValue = string | string[] | undefined;

export function parsePositiveSafeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") return null;
  if (!/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;

  return parsed;
}

/**
 * Parse an Express route parameter as a canonical positive safe integer.
 *
 * Rejects arrays, empty values, signs, decimals, exponents, leading/trailing
 * whitespace, zero/negative values, and numbers outside JS safe-integer range.
 * This keeps request-boundary behavior stable across Express/@types upgrades.
 */
export function parsePositiveIntParam(value: RouteParamValue): number | null {
  if (Array.isArray(value) || value === undefined) return null;
  return parsePositiveSafeInteger(value);
}

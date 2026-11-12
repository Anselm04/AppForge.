import { isIP } from "node:net";

/**
 * Never trust caller-provided X-Forwarded-For. Unless configured otherwise,
 * only a proxy on this application's loopback interface is trusted.
 */
export function trustedProxyPolicy(raw: string | undefined): string[] {
  const input = raw?.trim();
  const values = input
    ? input.split(",").map((value) => value.trim())
    : ["loopback"];
  if (values.length === 0 || values.length > 16) {
    throw new Error("Expected 1 to 16 trusted reverse-proxy addresses");
  }
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) {
      throw new Error("Duplicate or empty trusted proxy address");
    }
    seen.add(value);
    if (value === "loopback") continue;
    // Require explicit IP/CIDR entries: no wildcard or broad shortcuts.
    const match = value.match(/^([^/]+)(?:\/(\d+))?$/);
    const version = match ? isIP(match[1]) : 0;
    if (!version) {
      throw new Error(`Invalid trusted reverse-proxy IP/CIDR: ${value}`);
    }
    const maximum = version === 4 ? 32 : 128;
    const prefix = match?.[2] === undefined ? maximum : Number(match[2]);
    if (!Number.isInteger(prefix) || prefix < 1 || prefix > maximum) {
      throw new Error("Broad or invalid trusted proxy CIDR is not allowed");
    }
  }
  return values;
}

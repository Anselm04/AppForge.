import { isIP } from "node:net";

/**
 * Express must never trust arbitrary X-Forwarded-For supplied by a caller.
 * Without an explicit ingress allowlist only a same-host loopback proxy
 * is trusted. Configure the actual reverse-proxy addresses on other hosts.
 */
export function trustedProxyPolicy(raw: string | undefined): string[] {
  const values = raw?.trim()
    ? raw.split(",").map((value) => value.trim())
    : ["loopback"];
  if (values.length === 0 || values.length > 16) {
    throw new Error("Expected 1 to 16 trusted reverse-proxy addresses");
  }
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) {
      throw new Error("Trusted reverse-proxy addresses must be nonempty and unique");
    }
    seen.add(value);
    if (value === "loopback") continue;
    // Require explicitly configured IP/CIDR addresses. Never allow broad
    // shortcuts such as true, *, all, linklocal or uniquelocal.
    const match = value.match(/^([^/]+)(?:\/(\d+))?$/);
    const version = match ? isIP(match[1]) : 0;
    if (!version) {
      throw new Error(`Invalid trusted reverse-proxy IP/CIDR: ${value}`);
    }
    const prefix = match?.[2] === undefined ? (version === 4 ? 32 : 128) : Number(match[2]);
    if (!Number.isInteger(prefix) || prefix < 1 || prefix > (version === 4 ? 32 : 128)) {
      throw new Error("Broad or invalid trusted proxy CIDR is not allowed");
    }
  }
  return values;
}

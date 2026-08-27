const FALLBACK_OWNER = "anselm.perkins@gmail.com";

function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Owner is Anselm. Server also honours OWNER_EMAIL when present.
 * Comparison is case-insensitive so mixed-case logins still match.
 */
export function isOwnerEmail(email?: string | null): boolean {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  const extras: string[] = [FALLBACK_OWNER];
  try {
    const envEmail = typeof process !== "undefined" ? process.env?.OWNER_EMAIL : undefined;
    if (envEmail) extras.push(envEmail);
  } catch {
    /* browser bundle may not expose process.env */
  }
  return extras.some((candidate) => normalizeEmail(candidate) === needle);
}

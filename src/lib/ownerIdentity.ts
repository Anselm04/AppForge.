/**
 * Canonical owner identity. Safe for client and server.
 * Menu visibility may use this; privileged APIs still require a verified session.
 * Not a password backdoor — other emails never match.
 */
export const OWNER_EMAIL = "anselm.perkins@gmail.com";

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function canonicalOwnerEmail(): string {
  return OWNER_EMAIL;
}

export function isOwnerEmail(email?: string | null): boolean {
  const needle = normalizeEmail(email);
  return needle.length > 0 && needle === OWNER_EMAIL;
}

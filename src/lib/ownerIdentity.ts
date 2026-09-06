/**
 * Canonical owner identity. Safe for client and server.
 * Menu visibility may use this; privileged APIs still require a verified session.
 * Not a password backdoor — other emails never match.
 * Admin SMS is locked to OWNER_PHONE only. Other users' phones never unlock Admin.
 */
export const OWNER_EMAIL = "anselm.perkins@gmail.com";
export const OWNER_PHONE = "+64224553315";

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function canonicalOwnerEmail(): string {
  return OWNER_EMAIL;
}

export function canonicalOwnerPhone(): string {
  return OWNER_PHONE;
}

export function isOwnerEmail(email?: string | null): boolean {
  const needle = normalizeEmail(email);
  return needle.length > 0 && needle === OWNER_EMAIL;
}

export function isOwnerAdminPhone(phone?: string | null): boolean {
  const trimmed = (phone || "").trim().replace(/[()\s-]/g, "");
  return trimmed === OWNER_PHONE;
}

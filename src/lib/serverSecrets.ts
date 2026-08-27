import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

/** Canonical owner. Server-only — never import this module from client code. */
const CANONICAL_OWNER_EMAIL = "anselm.perkins@gmail.com";

function serverSecret(): string {
  const secret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "";
  if (!secret) {
    throw new Error("Server secret is not configured");
  }
  return secret;
}

function aesKey(purpose: string): Buffer {
  return scryptSync(serverSecret(), `appforge:${purpose}:v1`, 32);
}

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function canonicalOwnerEmail(): string {
  return CANONICAL_OWNER_EMAIL;
}

export function encryptUtf8(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(purpose), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptUtf8(payload: string, purpose: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 29) throw new Error("Invalid ciphertext");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", aesKey(purpose), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function hmacUtf8(value: string, purpose: string): string {
  return createHmac("sha256", serverSecret()).update(`${purpose}:${value}`).digest("hex");
}

export function hmacEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Owner check is HMAC-compared against the canonical Gmail only.
 * OWNER_EMAIL env cannot promote a different address.
 */
export function isOwnerEmail(email?: string | null): boolean {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  try {
    const expected = hmacUtf8(CANONICAL_OWNER_EMAIL, "owner-email");
    const actual = hmacUtf8(needle, "owner-email");
    return hmacEqualHex(actual, expected);
  } catch {
    return needle === CANONICAL_OWNER_EMAIL;
  }
}

export function encryptOwnerEmail(email: string): string {
  return encryptUtf8(normalizeEmail(email), "owner-email");
}

export function ownerEmailHmac(email: string): string {
  return hmacUtf8(normalizeEmail(email), "owner-email");
}

export function hashGodCode(raw: string): string {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  return createHash("sha256").update(`god-code:${normalized}:${serverSecret()}`).digest("hex");
}

export function encryptGodCode(raw: string): string {
  return encryptUtf8(raw.trim().toUpperCase().replace(/\s+/g, ""), "god-code");
}

export function mintGodCode(): string {
  const raw = randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `AF-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

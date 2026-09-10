export function secureBillingSessionModule(): string {
  return `import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "app_user";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function signature(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

function validSignature(userId: string, supplied: string, secret: string): boolean {
  const expected = Buffer.from(signature(userId, secret));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSignedUserSessionCookie(userId: string): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }
  const value = encodeURIComponent(\`${userId}.\${signature(userId, secret)}\`);
  return \`${SESSION_COOKIE}=\${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=\${MAX_AGE_SECONDS}\`;
}

export function getUserIdFromCookie(cookieHeader: string | null): string | null {
  const secret = sessionSecret();
  if (!secret || !cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(\`(?:^|;\\\\s*)\${SESSION_COOKIE}=([^;]+)\`));
  if (!match?.[1]) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  const separator = decoded.lastIndexOf(".");
  if (separator <= 0) return null;
  const userId = decoded.slice(0, separator);
  const supplied = decoded.slice(separator + 1);
  if (!userId || !supplied || !validSignature(userId, supplied, secret)) return null;
  return userId;
}

export function getUserIdFromRequest(req: {
  headers: { get?(name: string): string | null; cookie?: string };
}): string | null {
  if (typeof req.headers.get === "function") {
    return getUserIdFromCookie(req.headers.get("cookie"));
  }
  return getUserIdFromCookie(req.headers.cookie ?? null);
}
`;
}

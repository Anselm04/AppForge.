import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type GithubOAuthStatePayload = {
  userId: number;
  exp: number;
  nonce: string;
};

function signingSecret(): string {
  const secret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "";
  if (secret.length < 32) {
    throw new Error(
      "GitHub OAuth state signing requires COOKIE_SECRET or JWT_SECRET with at least 32 characters",
    );
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", signingSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createGithubOAuthState(userId: number): string {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid GitHub OAuth user id");
  }

  const payload: GithubOAuthStatePayload = {
    userId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: randomBytes(18).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyGithubOAuthState(state: string): number | null {
  try {
    const [encodedPayload, suppliedSignature, extra] = state.split(".");
    if (!encodedPayload || !suppliedSignature || extra) return null;

    const expectedSignature = sign(encodedPayload);
    const supplied = Buffer.from(suppliedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<GithubOAuthStatePayload>;

    if (
      !Number.isInteger(payload.userId) ||
      (payload.userId ?? 0) <= 0 ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() ||
      payload.exp > Date.now() + STATE_TTL_MS + 60_000 ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length < 16
    ) {
      return null;
    }

    return payload.userId as number;
  } catch {
    return null;
  }
}

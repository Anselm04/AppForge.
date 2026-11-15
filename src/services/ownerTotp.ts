import type { Request, Response } from "express";
import { setSessionCookies } from "../middleware/supabaseAuth.js";
import { setAdminMfaCookie } from "../lib/adminMfa.js";

/**
 * Authenticator-based owner step-up backed by Supabase GoTrue.
 * Adapted from the established challenge/verify pattern in the Apache-2.0
 * Keycloak OTP authenticator; uses the existing Supabase identity rather than
 * maintaining a parallel password or storing TOTP secrets in AppForge.
 *
 * Each method must be called only by an ownerAuthenticatedProcedure.
 * The bearer token has already been validated by Supabase middleware.
 */
type Factor = { id: string; factor_type: string; status: string };
type SupabaseUser = { id: string; factors?: Factor[] };
type FactorEnrollment = {
  id: string;
  type?: string;
  totp?: { qr_code?: string; secret?: string; uri?: string };
};
type MfaResponse = { access_token: string; refresh_token: string };

function config(): { origin: string; key: string } {
  const raw =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!raw || !key)
    throw new Error("Owner TOTP requires configured Supabase Auth");
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Supabase Auth URL is invalid");
  }
  return { origin: url.origin, key };
}

function validatedBearer(req: Request): string {
  const token = req.authAccessToken;
  if (!token || token.length > 8192) {
    throw new Error("A validated owner session is required");
  }
  return token;
}

async function requestGoTrue<T>(
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const { origin, key } = config();
  const response = await fetcher(`${origin}/auth/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Do not leak Supabase response bodies or authenticator secrets into logs.
    throw new Error(
      `Supabase owner TOTP request refused (HTTP ${response.status})`,
    );
  }
  return (await response.json()) as T;
}

function factors(user: SupabaseUser): Factor[] {
  return (user.factors ?? []).filter(
    (factor) =>
      typeof factor.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(factor.id) &&
      factor.factor_type === "totp",
  );
}

async function ownerFactors(
  req: Request,
  ownerUid: string,
  fetcher: typeof fetch,
): Promise<Factor[]> {
  const user = await requestGoTrue<SupabaseUser>(
    validatedBearer(req),
    "/user",
    "GET",
    undefined,
    fetcher,
  );
  if (!user.id || user.id !== ownerUid) {
    throw new Error("Supabase TOTP owner identity mismatch");
  }
  return factors(user);
}

export async function ownerTotpStatus(
  req: Request,
  ownerUid: string,
  fetcher: typeof fetch = fetch,
): Promise<{
  enrolled: boolean;
  factorCount: number;
  factorId: string | null;
}> {
  const verified = (await ownerFactors(req, ownerUid, fetcher)).filter(
    (factor) => factor.status === "verified",
  );
  return {
    enrolled: verified.length > 0,
    factorCount: verified.length,
    factorId: verified[0]?.id ?? null,
  };
}

export async function enrollOwnerTotp(
  req: Request,
  ownerUid: string,
  fetcher: typeof fetch = fetch,
): Promise<{ factorId: string; uri: string; secret: string }> {
  const present = await ownerFactors(req, ownerUid, fetcher);
  if (present.some((factor) => factor.status === "verified")) {
    throw new Error(
      "Owner TOTP is already enrolled; verify your existing factor",
    );
  }
  // Reuse an unverified factor only through its original private QR secret;
  // never expose an old factor's private seed from another session.
  if (present.length > 0) {
    throw new Error("An unfinished authenticator enrollment already exists");
  }
  const result = await requestGoTrue<FactorEnrollment>(
    validatedBearer(req),
    "/factors",
    "POST",
    { factor_type: "totp", friendly_name: "AppForge Owner" },
    fetcher,
  );
  if (
    !result.id ||
    !/^[0-9a-f-]{36}$/i.test(result.id) ||
    !result.totp?.secret ||
    !result.totp.uri?.startsWith("otpauth://totp/")
  ) {
    throw new Error("Supabase returned an incomplete TOTP enrollment");
  }
  return {
    factorId: result.id,
    uri: result.totp.uri,
    secret: result.totp.secret,
  };
}

function verifiedJwtClaims(token: string): {
  sub?: string;
  session_id?: string;
  aal?: string;
} {
  try {
    return JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { sub?: string; session_id?: string; aal?: string };
  } catch {
    throw new Error("Supabase owner TOTP returned an invalid access token");
  }
}

export async function verifyOwnerTotp(
  req: Request,
  res: Response,
  userId: number,
  ownerUid: string,
  factorId: string,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<MfaResponse> {
  if (!/^[0-9a-f-]{36}$/i.test(factorId) || !/^\d{6}$/.test(code)) {
    throw new Error("Invalid authenticator challenge");
  }
  const permitted = await ownerFactors(req, ownerUid, fetcher);
  if (!permitted.some((factor) => factor.id === factorId)) {
    throw new Error("Authenticator factor is not owned by the current user");
  }
  if (
    permitted.some((factor) => factor.status === "verified") &&
    !permitted.some(
      (factor) => factor.id === factorId && factor.status === "verified",
    )
  ) {
    throw new Error(
      "An existing verified factor must be used for owner step-up",
    );
  }

  const token = validatedBearer(req);
  const challenge = await requestGoTrue<{ id?: string }>(
    token,
    `/factors/${encodeURIComponent(factorId)}/challenge`,
    "POST",
    {},
    fetcher,
  );
  if (!challenge.id || !/^[0-9a-f-]{36}$/i.test(challenge.id)) {
    throw new Error("Supabase returned an invalid MFA challenge");
  }
  const upgraded = await requestGoTrue<MfaResponse>(
    token,
    `/factors/${encodeURIComponent(factorId)}/verify`,
    "POST",
    { challenge_id: challenge.id, code },
    fetcher,
  );
  if (!upgraded.access_token || !upgraded.refresh_token) {
    throw new Error("Supabase did not return an upgraded session");
  }
  const original = verifiedJwtClaims(token);
  const claims = verifiedJwtClaims(upgraded.access_token);
  if (
    claims.sub !== ownerUid ||
    original.sub !== ownerUid ||
    !claims.session_id ||
    !original.session_id ||
    original.session_id !== claims.session_id ||
    claims.aal !== "aal2"
  ) {
    throw new Error("Supabase owner step-up session identity is inconsistent");
  }
  // Independently verify the upgraded bearer with the provider before
  // signing the admin cookie. A decoded JWT alone is not authentication.
  const user = await requestGoTrue<SupabaseUser>(
    upgraded.access_token,
    "/user",
    "GET",
    undefined,
    fetcher,
  );
  if (user.id !== ownerUid) {
    throw new Error("Supabase owner verification identity mismatch");
  }
  req.authAccessToken = upgraded.access_token;
  setSessionCookies(res, upgraded.access_token, upgraded.refresh_token);
  setAdminMfaCookie(req, res, userId);
  return upgraded;
}

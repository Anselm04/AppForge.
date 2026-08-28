import { createHash, randomBytes } from "crypto";

function readConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) {
    throw new Error("Supabase URL and publishable key are required for SSO");
  }
  return { url: url.replace(/\/$/, ""), key };
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export type SsoInitResult = {
  url: string;
  codeVerifier: string;
};

/** SP-initiated SSO — returns IdP redirect URL and PKCE verifier to store in cookie. */
export async function initiateSupabaseSso(params: {
  domain?: string;
  providerId?: string;
  redirectTo: string;
}): Promise<SsoInitResult> {
  const { url, key } = readConfig();
  const { verifier, challenge } = pkcePair();
  const body: Record<string, string> = {
    redirect_to: params.redirectTo,
    code_challenge: challenge,
    code_challenge_method: "s256",
  };
  if (params.providerId) body.provider_id = params.providerId;
  else if (params.domain) body.domain = params.domain;
  else throw new Error("domain or providerId required");

  const res = await fetch(`${url}/auth/v1/sso`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    url?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok || !json.url) {
    throw new Error(json.message || json.error || "SSO initiation failed");
  }
  return { url: json.url, codeVerifier: verifier };
}

export type SsoSessionTokens = {
  access_token: string;
  refresh_token?: string;
  user?: { id: string; email?: string };
};

/** Exchange authorization code from Supabase SSO callback for a session. */
export async function exchangeSupabaseSsoCode(
  code: string,
  codeVerifier: string,
): Promise<SsoSessionTokens> {
  const { url, key } = readConfig();
  const res = await fetch(`${url}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_code: code,
      code_verifier: codeVerifier,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as SsoSessionTokens & {
    message?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.message || json.error || "SSO code exchange failed");
  }
  return json;
}

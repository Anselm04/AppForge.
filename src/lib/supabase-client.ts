import { withCsrfHeaders } from "./csrf";

declare global {
  interface Window {
    __APPFORGE_CONFIG__?: {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
      stripePublicKey?: string;
      hcaptchaSiteKey?: string;
      posthogKey?: string;
      posthogHost?: string;
    };
  }
}

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; email?: string };
  error?: { message: string };
};

function config() {
  const runtime =
    typeof window !== "undefined" ? window.__APPFORGE_CONFIG__ : undefined;
  // Prefer runtime /config.js so a localhost VITE_* bake cannot override live Fly.
  const url =
    runtime?.supabaseUrl ||
    (import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const publishableKey =
    runtime?.supabasePublishableKey ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !publishableKey) {
    throw new Error("Sign-in is not configured yet. Please try again later.");
  }
  return { url, publishableKey };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, publishableKey } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error("Authentication service is temporarily unavailable.");
    }
    throw new Error(
      body?.message ||
        body?.error_description ||
        `Authentication request failed: ${response.status}`,
    );
  }
  return body as T;
}

async function requestAppForgeSignup(
  email: string,
  password: string,
  next: string,
): Promise<AuthResponse> {
  const headers = await withCsrfHeaders({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  const response = await fetch("/api/health/auth-signup", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ email, password, next }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.error || `Unable to create account (${response.status})`,
    );
  }
  return body as AuthResponse;
}

export const SOCIAL_SIGN_IN_PROVIDERS = ["google", "github"] as const;
export type SocialSignInProvider = (typeof SOCIAL_SIGN_IN_PROVIDERS)[number];

/**
 * Read the Supabase project's public auth settings so the UI can only offer
 * identity providers that are actually enabled server-side. Fails closed to
 * "no social providers" rather than rendering buttons that would error.
 */
async function listAuthProviders(): Promise<SocialSignInProvider[]> {
  try {
    const { url, publishableKey } = config();
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: publishableKey, Accept: "application/json" },
    });
    if (!response.ok) return [];
    const body = (await response.json().catch(() => null)) as {
      external?: Record<string, boolean>;
    } | null;
    const external = body?.external ?? {};
    return SOCIAL_SIGN_IN_PROVIDERS.filter(
      (provider) => external[provider] === true,
    );
  } catch {
    return [];
  }
}

/**
 * Implicit-flow authorize URL: Supabase redirects back to `redirectTo` with
 * `#access_token=...`, which `completeAuthRedirect` already consumes.
 */
function oauthAuthorizeUrl(
  provider: SocialSignInProvider,
  redirectTo: string,
): string {
  const { url } = config();
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
  });
  return `${url}/auth/v1/authorize?${params.toString()}`;
}

export const supabaseClient = {
  signUp(email: string, password: string, next = "/") {
    return requestAppForgeSignup(email, password, next);
  },
  signIn(email: string, password: string) {
    return request<AuthResponse>("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  refreshSession(refreshToken: string) {
    return request<AuthResponse>("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
  signOut(accessToken: string) {
    return request<Record<string, never>>("/auth/v1/logout?scope=local", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  requestPasswordReset(email: string) {
    const redirect =
      typeof window !== "undefined"
        ? `${window.location.origin}/password-reset`
        : undefined;
    const path = redirect
      ? `/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`
      : "/auth/v1/recover";
    return request<Record<string, unknown>>(path, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  updatePassword(accessToken: string, password: string) {
    return request<AuthResponse>("/auth/v1/user", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ password }),
    });
  },
  listAuthProviders,
  oauthAuthorizeUrl,
};

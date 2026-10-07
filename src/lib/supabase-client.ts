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
  fullName?: string,
  phone?: string,
): Promise<AuthResponse> {
  const headers = await withCsrfHeaders({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  const response = await fetch("/api/health/auth-signup", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ email, password, next, fullName, phone }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.error || `Unable to create account (${response.status})`,
    );
  }
  return body as AuthResponse;
}

export const supabaseClient = {
  signUp(
    email: string,
    password: string,
    next = "/",
    fullName?: string,
    phone?: string,
  ) {
    return requestAppForgeSignup(email, password, next, fullName, phone);
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
};

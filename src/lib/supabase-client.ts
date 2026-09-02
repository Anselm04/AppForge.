declare global {
  interface Window {
    __APPFORGE_CONFIG__?: {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
      stripePublicKey?: string;
    };
  }
}

type AuthResponse = { access_token?: string; refresh_token?: string; user?: { id: string; email?: string }; error?: { message: string } };

function config() {
  const runtime = typeof window !== 'undefined' ? window.__APPFORGE_CONFIG__ : undefined;
  // Prefer runtime /config.js so a localhost VITE_* bake cannot override live Fly.
  const url =
    runtime?.supabaseUrl ||
    (import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const publishableKey =
    runtime?.supabasePublishableKey ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !publishableKey) {
    throw new Error('Sign-in and project saving are not configured yet. Please try again later.');
  }
  return { url, publishableKey };
}

function authRedirectTo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/login`;
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const { url, publishableKey } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error_description || `Supabase request failed: ${response.status}`);
  return body as T;
}

export const supabaseClient = {
  signUp(email: string, password: string) {
    const redirect = authRedirectTo();
    const path = redirect
      ? `/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`
      : '/auth/v1/signup';
    return request<AuthResponse>(path, { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  signIn(email: string, password: string) {
    return request<AuthResponse>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  refreshSession(refreshToken: string) {
    return request<AuthResponse>('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
  getProjects(accessToken: string) {
    return request('/rest/v1/projects?select=*&order=updated_at.desc', {}, accessToken);
  },
  createProject(accessToken: string, project: { owner_id: string; name: string; idea: string }) {
    return request('/rest/v1/projects', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(project) }, accessToken);
  },
};

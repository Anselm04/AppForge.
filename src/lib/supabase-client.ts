type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; email?: string };
  error?: { message: string };
};

function config() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !publishableKey) {
    throw new Error('Sign-in and project saving are not configured yet. Please try again later.');
  }
  return { url, publishableKey };
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
  if (!response.ok) {
    throw new Error(
      body?.message || body?.error_description || body?.error || `Supabase request failed: ${response.status}`
    );
  }
  return body as T;
}

export const supabaseClient = {
  signUp(email: string, password: string) {
    return request<AuthResponse>('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  signIn(email: string, password: string) {
    return request<AuthResponse>('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getProjects(accessToken: string) {
    return request('/rest/v1/projects?select=*&order=updated_at.desc', {}, accessToken);
  },
  createProject(
    accessToken: string,
    project: { owner_id: string; name: string; idea: string }
  ) {
    return request(
      '/rest/v1/projects',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(project),
      },
      accessToken
    );
  },
  async buildProject(accessToken: string, projectId: string, prompt?: string) {
    const response = await fetch('/api/build', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ projectId, prompt }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Build failed: ${response.status}`);
    }
    return body as {
      projectId: string;
      creditsRemaining: number;
      result: {
        name: string;
        summary: string;
        stack: string;
        files: { path: string; content: string }[];
        run_instructions: string;
      };
    };
  },
};

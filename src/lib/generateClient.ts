import {
  ensureFreshSession,
  getAccessToken,
  getSession,
  refreshSession,
} from "./auth.js";
import { clearCsrfToken, withCsrfHeaders } from "./csrf.js";

export type GenerateResult = { id: number; liveUrl: string };

export function generateUnauthorizedAction(
  hasLiveSession: boolean,
): "stay" | "login" {
  return hasLiveSession ? "stay" : "login";
}

export function hasLiveSession(): boolean {
  return !!getAccessToken() || !!getSession();
}

export function generateAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["x-appforge-token"] = token;
  }
  return headers;
}

export async function postGenerate(body: {
  title: string;
  description: string;
  techStack: string;
  locale?: string;
  buildCapabilities?: string[];
  hcaptchaToken?: string;
}): Promise<GenerateResult> {
  await ensureFreshSession();

  const open = async (retried: boolean): Promise<Response> => {
    const headers = await withCsrfHeaders(generateAuthHeaders());
    const res = await fetch("/api/generate", {
      method: "POST",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
    });
    if (res.status === 403 && !retried) {
      clearCsrfToken();
      return open(true);
    }
    if (res.status === 401 && !retried) {
      const refreshed = await refreshSession();
      if (refreshed) return open(true);
    }
    return res;
  };

  const res = await open(false);
  let payload: {
    id?: number;
    liveUrl?: string;
    error?: string;
    message?: string;
    code?: string;
  } = {};
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    /* ignore */
  }
  if (res.status === 401) {
    const err = new Error(
      payload.message || payload.error || "Not authenticated",
    );
    (err as Error & { status?: number; data?: { code?: string } }).status = 401;
    (err as Error & { data?: { code?: string } }).data = {
      code: "UNAUTHORIZED",
    };
    throw err;
  }
  if (!res.ok || typeof payload.id !== "number") {
    throw new Error(
      payload.message || payload.error || `Generate failed (${res.status})`,
    );
  }
  const liveUrl =
    typeof payload.liveUrl === "string" && payload.liveUrl
      ? payload.liveUrl
      : `/apps/${payload.id}`;
  return { id: payload.id, liveUrl };
}

export async function syncServerSession(): Promise<{
  email: string;
  isOwner: boolean;
} | null> {
  await ensureFreshSession();
  const token = getAccessToken();
  if (!token) return null;
  try {
    const headers = await withCsrfHeaders(generateAuthHeaders());
    const res = await fetch("/api/session", {
      method: "POST",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: "{}",
    });
    if (!res.ok) return null;
    return (await res.json()) as { email: string; isOwner: boolean };
  } catch {
    return null;
  }
}

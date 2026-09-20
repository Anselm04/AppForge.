import { useSyncExternalStore } from "react";
import { supabaseClient } from "./supabase-client";
import { clearCsrfToken, withCsrfHeaders } from "./csrf";

const USER_KEY = "appforge.user";
const ACCESS_TOKEN_KEY = "appforge.access-token";
const listeners = new Set<() => void>();

export interface AppForgeSession {
  accessToken?: string;
  user: { id: string; email?: string };
}

let cachedSession: AppForgeSession | null = null;
let refreshInFlight: Promise<AppForgeSession | null> | null = null;
let sessionGeneration = 0;

function emitSessionChange() {
  listeners.forEach((listener) => listener());
}

function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredUser(): { id: string; email?: string } | null {
  try {
    const raw = globalThis.localStorage?.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: string; email?: string };
    return typeof user.id === "string"
      ? { id: user.id, email: user.email }
      : null;
  } catch {
    return null;
  }
}

function storeUser(user: { id: string; email?: string }) {
  try {
    globalThis.localStorage?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // In-memory auth remains valid when storage is unavailable.
  }
}

function clearStoredUser() {
  try {
    globalThis.localStorage?.removeItem(USER_KEY);
  } catch {
    // ignore blocked storage
  }
}

function readStoredAccessToken(): string | undefined {
  try {
    const token = globalThis.sessionStorage?.getItem(ACCESS_TOKEN_KEY);
    return token && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

function storeAccessToken(accessToken?: string) {
  try {
    if (accessToken) {
      globalThis.sessionStorage?.setItem(ACCESS_TOKEN_KEY, accessToken);
    } else {
      globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // In-memory auth remains valid when storage is unavailable.
  }
}

function clearStoredAccessToken() {
  try {
    globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore blocked storage
  }
}

function jwtUser(accessToken: string): { id: string; email?: string } | null {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as {
      sub?: string;
      email?: string;
    };
    if (!decoded.sub) return null;
    return { id: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

function saveSession(session: AppForgeSession) {
  cachedSession = session;
  storeUser(session.user);
  storeAccessToken(session.accessToken);
  emitSessionChange();
}

export function rememberAuthenticatedUser(user: {
  id: string;
  email?: string;
}): AppForgeSession {
  const session = { user };
  saveSession(session);
  return session;
}

function sessionFromAuth(result: {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; email?: string };
}): AppForgeSession | null {
  if (!result.access_token || !result.user?.id) return null;
  return {
    accessToken: result.access_token,
    user: result.user,
  };
}

async function syncServerSession(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  const post = async (): Promise<Response> => {
    const headers = await withCsrfHeaders({
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(refreshToken ? { "x-supabase-refresh-token": refreshToken } : {}),
    });
    return fetch("/api/auth/session", {
      method: "POST",
      credentials: "same-origin",
      headers,
    });
  };

  let res = await post();
  // A stale/rotated CSRF token yields 403 EBADCSRFTOKEN. Refetch the token once
  // and retry so a transient CSRF mismatch cannot silently prevent the secure
  // HttpOnly session cookie from being established (which later 401s the build
  // request and bounced users back to login).
  if (res.status === 403) {
    clearCsrfToken();
    res = await post();
  }
  if (!res.ok) {
    throw new Error(
      `Failed to establish secure browser session (${res.status})`,
    );
  }
}

async function syncServerSessionBestEffort(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  try {
    await syncServerSession(accessToken, refreshToken);
  } catch {
    // The SPA authenticates protected API calls with the validated Supabase
    // bearer token. A transient cookie/CSRF sync failure must not turn a valid
    // Supabase login or refresh into a false "sign-in failed" result.
  }
}

async function clearServerSession(accessToken?: string): Promise<void> {
  try {
    const headers = await withCsrfHeaders(
      accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    );
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "same-origin",
      headers,
    });
  } catch {
    // Local sign-out must still complete even if the server is unreachable.
  }
}

export function getSession(): AppForgeSession | null {
  if (cachedSession) return cachedSession;
  const user = readStoredUser();
  if (!user) return null;
  const accessToken = readStoredAccessToken();
  cachedSession = accessToken ? { user, accessToken } : { user };
  return cachedSession;
}

export function getAccessToken(): string | null {
  const token = getSession()?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function loginPathWithReturn(next = "/"): string {
  const path =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/";
  return `/login?next=${encodeURIComponent(path)}`;
}

export function useSession(): AppForgeSession | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export function signOut() {
  const session = getSession();
  sessionGeneration += 1;
  cachedSession = null;
  clearStoredUser();
  clearStoredAccessToken();
  refreshInFlight = null;
  emitSessionChange();

  void clearServerSession(session?.accessToken);
  if (session?.accessToken) {
    void supabaseClient.signOut(session.accessToken).catch(() => undefined);
  }
}

export async function refreshSession(): Promise<AppForgeSession | null> {
  const current = getSession();
  if (!current) return null;

  // Refresh tokens live only in the server-managed HttpOnly cookie. Remove a
  // rejected/expired bearer token from browser session storage and let the next
  // same-origin request authenticate through the secure cookie path, where the
  // server can refresh and rotate the session.
  clearStoredAccessToken();
  cachedSession = { user: current.user };
  emitSessionChange();
  return cachedSession;
}

function accessTokenExpired(token: string, skewMs = 30_000): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof json.exp !== "number") return false;
    return json.exp * 1000 <= Date.now() + skewMs;
  } catch {
    return false;
  }
}

export async function ensureFreshSession(): Promise<AppForgeSession | null> {
  const session = getSession();
  if (!session) return null;

  if (!session.accessToken || accessTokenExpired(session.accessToken)) {
    clearStoredAccessToken();
    cachedSession = { user: session.user };
    emitSessionChange();
    return cachedSession;
  }

  return session;
}

/**
 * Complete Supabase's email-confirmation implicit redirect.
 * Direct /auth/v1/signup confirmations return access/refresh tokens in the URL
 * fragment. Previously /login ignored them, so a correctly confirmed account
 * still looked signed out and testers were sent back through login again.
 */
export async function completeAuthRedirect(): Promise<AppForgeSession | null> {
  if (typeof window === "undefined") return null;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  const errorDescription =
    hash.get("error_description") || search.get("error_description");
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken) return null;

  for (const key of [
    "access_token",
    "refresh_token",
    "token_type",
    "expires_in",
    "expires_at",
    "type",
  ]) {
    search.delete(key);
  }
  const cleanQuery = search.toString();
  const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`;
  window.history.replaceState({}, document.title, cleanUrl || "/login");

  const user = jwtUser(accessToken);
  if (!user) throw new Error("Unable to read confirmed Supabase session.");

  const session: AppForgeSession = {
    accessToken,
    user,
  };
  sessionGeneration += 1;
  saveSession(session);
  await syncServerSessionBestEffort(accessToken, refreshToken || undefined);
  return session;
}

export async function signUp(email: string, password: string, next = "/") {
  const result = await supabaseClient.signUp(email, password, next);
  if (result.error) throw new Error(result.error.message);
  const session = sessionFromAuth(result);
  if (session) {
    sessionGeneration += 1;
    saveSession(session);
    await syncServerSessionBestEffort(
      session.accessToken!,
      result.refresh_token,
    );
  }
  return result;
}

export async function signIn(
  email: string,
  password: string,
): Promise<AppForgeSession> {
  const result = await supabaseClient.signIn(email, password);
  const session = sessionFromAuth(result);
  if (!session) {
    throw new Error(result.error?.message || "Sign-in failed.");
  }
  sessionGeneration += 1;
  saveSession(session);
  await syncServerSessionBestEffort(session.accessToken!, result.refresh_token);
  return session;
}

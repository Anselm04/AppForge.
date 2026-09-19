import { useSyncExternalStore } from "react";
import { supabaseClient } from "./supabase-client";
import { withCsrfHeaders } from "./csrf";

const USER_KEY = "appforge.user";
/** SPA bearer across navigations/full loads (esp. iOS CriOS). Not HttpOnly. */
const ACCESS_TOKEN_KEY = "appforge.accessToken";
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
    return typeof user.id === "string" ? { id: user.id, email: user.email } : null;
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


function readStoredAccessToken(): string | null {
  try {
    const token = globalThis.sessionStorage?.getItem(ACCESS_TOKEN_KEY);
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function storeAccessToken(token: string) {
  try {
    globalThis.sessionStorage?.setItem(ACCESS_TOKEN_KEY, token);
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
  if (typeof session.accessToken === "string" && session.accessToken.length > 0) {
    storeAccessToken(session.accessToken);
  } else {
    clearStoredAccessToken();
  }
  emitSessionChange();
}

export function rememberAuthenticatedUser(user: {
  id: string;
  email?: string;
}): AppForgeSession {
  // Preserve in-memory bearer from signIn until HttpOnly cookies hydrate.
  // Wiping it here caused Generate → /login when cookie sync lagged or failed.
  const existingToken = getSession()?.accessToken;
  const session: AppForgeSession = existingToken
    ? { accessToken: existingToken, user }
    : { user };
  saveSession(session);
  return session;
}

/** Drop optimistic local user marker without clearing HttpOnly cookies. */
export function clearClientUserMarker() {
  cachedSession = null;
  clearStoredUser();
  clearStoredAccessToken();
  emitSessionChange();
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
  const headers = await withCsrfHeaders({
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...(refreshToken ? { "x-supabase-refresh-token": refreshToken } : {}),
  });
  const res = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers,
  });
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
  // Prefer in-memory session that already has a bearer.
  if (cachedSession?.accessToken) return cachedSession;

  // Restore bearer from sessionStorage after navigation / full load (iOS CriOS).
  const storedToken = readStoredAccessToken();
  if (storedToken) {
    const user =
      jwtUser(storedToken) || readStoredUser() || cachedSession?.user;
    if (user) {
      cachedSession = { accessToken: storedToken, user };
      return cachedSession;
    }
    // Unusable token without a subject — drop it.
    clearStoredAccessToken();
  }

  if (cachedSession) return cachedSession;
  const user = readStoredUser();
  if (!user) return null;
  // localStorage marker only — no bearer (cookies may still auth via /api/auth/me).
  cachedSession = { user };
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

/**
 * Re-establish SPA session from cookies and/or the in-memory bearer from signIn.
 * NEVER strip the bearer before the probe — v320 did that, then /api/auth/me
 * ran cookie-only, got 401 when cookies had not landed, and bounced Generate to /login.
 */
export async function refreshSession(): Promise<AppForgeSession | null> {
  if (refreshInFlight) return refreshInFlight;
  const generationAtStart = sessionGeneration;

  refreshInFlight = (async () => {
    try {
      const current = getSession();
      const bearer =
        typeof current?.accessToken === "string" && current.accessToken.length > 0
          ? current.accessToken
          : null;

      const headers: Record<string, string> = { Accept: "application/json" };
      if (bearer) headers.Authorization = `Bearer ${bearer}`;

      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers,
      });

      if (generationAtStart !== sessionGeneration) return getSession();

      if (!res.ok) {
        // Keep a still-usable in-memory bearer across transient probe failures.
        // Only clear when the server rejects auth AND we have no bearer to fall back on,
        // or when the bearer we sent was itself rejected (true logout / revoked).
        if (res.status === 401 || res.status === 403) {
          if (bearer) {
            // Bearer was sent and rejected — session is dead.
            cachedSession = null;
            clearStoredUser();
            clearStoredAccessToken();
            emitSessionChange();
            return null;
          }
          cachedSession = null;
          clearStoredUser();
          clearStoredAccessToken();
          emitSessionChange();
        }
        // Network/5xx: keep whatever session we had (including bearer).
        return bearer && current ? current : getSession();
      }

      const body = (await res.json()) as {
        id?: number | string;
        email?: string;
        name?: string;
        supabaseUid?: string;
      };
      const uid =
        (typeof body.supabaseUid === "string" && body.supabaseUid.length > 0
          ? body.supabaseUid
          : null) ||
        (body.id != null ? String(body.id) : "");
      if (!uid) return bearer && current ? current : null;

      // rememberAuthenticatedUser preserves bearer from getSession().
      return rememberAuthenticatedUser({
        id: uid,
        email: typeof body.email === "string" ? body.email : undefined,
      });
    } catch {
      return getSession();
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
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

  // Fresh bearer from signIn wins — never strip it for a cookie probe.
  if (session?.accessToken && !accessTokenExpired(session.accessToken)) {
    return session;
  }

  // No fresh bearer (reload / expired JWT): hydrate via cookies and/or probe.
  // refreshSession keeps any remaining bearer until the server rejects it.
  const hydrated = await refreshSession();
  if (hydrated) return hydrated;

  // Do not resurrect a localStorage-only marker after refresh proved auth dead —
  // that made Home call projects.create, get UNAUTHORIZED, then bounce to /login.
  return null;
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
  await syncServerSessionBestEffort(
    accessToken,
    refreshToken || undefined,
  );
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
  saveSession(session); // persists accessToken to sessionStorage for iOS navigations
  // Hard cookie sync: await POST /api/auth/session. If cookies fail to stick
  // (common on iPhone CriOS), sessionStorage bearer still powers Authorization.
  try {
    await syncServerSession(session.accessToken!, result.refresh_token);
  } catch (err) {
    console.warn("[auth] cookie sync failed; keeping sessionStorage bearer", err);
    await syncServerSessionBestEffort(
      session.accessToken!,
      result.refresh_token,
    );
  }
  return session;
}

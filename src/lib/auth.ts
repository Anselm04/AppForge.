import { useSyncExternalStore } from "react";
import { supabaseClient } from "./supabase-client";
import { withCsrfHeaders } from "./csrf";

const SESSION_KEY = "appforge.session";
const listeners = new Set<() => void>();

export interface AppForgeSession {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email?: string };
}

let cachedRaw: string | null | undefined;
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

function readStorage(key: string): string | null {
  try {
    const storage =
      typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
    if (!storage) return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    const storage =
      typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
    if (!storage) return;
    storage.setItem(key, value);
  } catch {
    // quota/private mode: keep the in-memory session below
  }
}

function removeStorage(key: string) {
  try {
    const storage =
      typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
    if (!storage) return;
    storage.removeItem(key);
  } catch {
    // ignore blocked storage
  }
}

function parseSession(raw: string): AppForgeSession | null {
  try {
    const parsed = JSON.parse(raw) as AppForgeSession;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.accessToken !== "string" ||
      parsed.accessToken.length === 0
    )
      return null;
    if (
      !parsed.user ||
      typeof parsed.user !== "object" ||
      typeof parsed.user.id !== "string"
    )
      return null;
    return parsed;
  } catch {
    return null;
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
  const raw = JSON.stringify(session);
  writeStorage(SESSION_KEY, raw);
  cachedRaw = raw;
  cachedSession = session;
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
    refreshToken: result.refresh_token,
    user: result.user,
  };
}

async function syncServerSession(accessToken: string): Promise<void> {
  const headers = await withCsrfHeaders({
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
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
  const raw = readStorage(SESSION_KEY);
  if (!raw) {
    return cachedSession;
  }
  if (raw === cachedRaw) return cachedSession;
  const parsed = parseSession(raw);
  if (!parsed) {
    removeStorage(SESSION_KEY);
    cachedRaw = null;
    cachedSession = null;
    return null;
  }
  cachedRaw = raw;
  cachedSession = parsed;
  return parsed;
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
  removeStorage(SESSION_KEY);
  cachedRaw = null;
  cachedSession = null;
  refreshInFlight = null;
  emitSessionChange();

  void clearServerSession(session?.accessToken);
  if (session?.accessToken) {
    void supabaseClient.signOut(session.accessToken).catch(() => undefined);
  }
}

export async function refreshSession(): Promise<AppForgeSession | null> {
  const current = getSession();
  if (!current?.refreshToken) return null;
  if (refreshInFlight) return refreshInFlight;
  const generationAtStart = sessionGeneration;
  refreshInFlight = (async () => {
    try {
      const result = await supabaseClient.refreshSession(current.refreshToken!);
      if (result.error || generationAtStart !== sessionGeneration) return null;
      const next = sessionFromAuth({
        access_token: result.access_token,
        refresh_token: result.refresh_token || current.refreshToken,
        user: result.user || current.user,
      });
      if (!next || generationAtStart !== sessionGeneration) return null;
      saveSession(next);
      await syncServerSession(next.accessToken);
      return next;
    } catch {
      return null;
    } finally {
      if (generationAtStart === sessionGeneration) {
        refreshInFlight = null;
      }
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
  if (!session) return null;

  if (!accessTokenExpired(session.accessToken)) {
    void syncServerSession(session.accessToken).catch(() => undefined);
    return session;
  }

  if (!session.refreshToken) {
    signOut();
    return null;
  }

  const generationAtStart = sessionGeneration;
  const refreshed = await refreshSession();
  if (refreshed) return refreshed;

  if (generationAtStart !== sessionGeneration) return getSession();

  // An expired access token is never usable. If it cannot be refreshed, clear
  // it rather than repeatedly sending a known-expired credential to API/SSE.
  signOut();
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

  const accessToken = hash.get("access_token") || search.get("access_token");
  const refreshToken = hash.get("refresh_token") || search.get("refresh_token");
  if (!accessToken) return null;

  const user = jwtUser(accessToken);
  if (!user) throw new Error("Unable to read confirmed Supabase session.");

  const session: AppForgeSession = {
    accessToken,
    refreshToken: refreshToken || undefined,
    user,
  };
  sessionGeneration += 1;
  saveSession(session);
  await syncServerSession(accessToken);

  // Remove credentials from browser history immediately after consuming them.
  const cleanUrl = `${window.location.pathname}${window.location.search
    .replace(
      /([?&])(access_token|refresh_token|token_type|expires_in|expires_at|type)=[^&]*/g,
      "$1",
    )
    .replace(/[?&]$/, "")}`;
  window.history.replaceState({}, document.title, cleanUrl || "/login");
  return session;
}

export async function signUp(email: string, password: string) {
  const result = await supabaseClient.signUp(email, password);
  if (result.error) throw new Error(result.error.message);
  const session = sessionFromAuth(result);
  if (session) {
    sessionGeneration += 1;
    saveSession(session);
    await syncServerSession(session.accessToken);
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
  await syncServerSession(session.accessToken);
  return session;
}

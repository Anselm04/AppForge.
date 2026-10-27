import { useSyncExternalStore } from "react";
import { supabaseClient, type SocialSignInProvider } from "./supabase-client";
import { supabase } from "./supabase";
import { clearCsrfToken, withCsrfHeaders } from "./csrf";

const USER_KEY = "appforge.user";
const ACCESS_TOKEN_KEY = "appforge.access-token";
const BROWSER_SESSION_KEY = "appforge.browser-session";
const BROWSER_SESSION_HEADER = "x-appforge-browser-session";
const listeners = new Set<() => void>();

export interface AppForgeSession {
  accessToken?: string;
  user: { id: string; email?: string; phone?: string };
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

function readStoredUser(): AppForgeSession["user"] | null {
  try {
    const raw = globalThis.localStorage?.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as {
      id?: string;
      email?: string;
      phone?: string;
    };
    return typeof user.id === "string"
      ? { id: user.id, email: user.email, phone: user.phone }
      : null;
  } catch {
    return null;
  }
}

function storeUser(user: AppForgeSession["user"]) {
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

function hasBrowserSession(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(BROWSER_SESSION_KEY) === "active";
  } catch {
    return false;
  }
}

export function browserSessionHeaders(): Record<string, string> {
  return hasBrowserSession() ? { [BROWSER_SESSION_HEADER]: "active" } : {};
}

function markBrowserSession() {
  try {
    globalThis.sessionStorage?.setItem(BROWSER_SESSION_KEY, "active");
  } catch {
    // In-memory auth remains valid when storage is unavailable.
  }
}

function clearBrowserSession() {
  try {
    globalThis.sessionStorage?.removeItem(BROWSER_SESSION_KEY);
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

function jwtUser(accessToken: string): AppForgeSession["user"] | null {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as {
      sub?: string;
      email?: string;
      phone?: string;
    };
    if (!decoded.sub) return null;
    return { id: decoded.sub, email: decoded.email, phone: decoded.phone };
  } catch {
    return null;
  }
}

function saveSession(session: AppForgeSession) {
  cachedSession = session;
  storeUser(session.user);
  storeAccessToken(session.accessToken);
  markBrowserSession();
  emitSessionChange();
}

export function rememberAuthenticatedUser(
  user: AppForgeSession["user"],
): AppForgeSession {
  const session = { user };
  saveSession(session);
  return session;
}

function sessionFromAuth(result: {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; email?: string; phone?: string };
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
      ...browserSessionHeaders(),
      ...(refreshToken ? { "x-supabase-refresh-token": refreshToken } : {}),
    });
    return fetch("/api/auth/session", {
      method: "POST",
      credentials: "same-origin",
      headers,
    });
  };

  let res = await post();
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

type SessionRevocationScope = "local" | "others" | "global";

async function revokeServerSessions(
  scope: SessionRevocationScope,
  accessToken?: string,
): Promise<void> {
  const request = async (): Promise<Response> => {
    const headers = await withCsrfHeaders({
      ...browserSessionHeaders(),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    });
    return fetch(`/api/auth/session?scope=${encodeURIComponent(scope)}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers,
    });
  };

  let response = await request();
  if (response.status === 403) {
    clearCsrfToken();
    response = await request();
  }
  if (!response.ok) {
    throw new Error(
      scope === "others"
        ? "Unable to sign out your other devices."
        : scope === "global"
          ? "Unable to sign out all devices."
          : "Unable to end the current session.",
    );
  }
}

async function clearServerSession(accessToken?: string): Promise<void> {
  try {
    await revokeServerSessions("local", accessToken);
  } catch {
    // Local sign-out must still complete even if the server is unreachable.
  }
}

export function getSession(): AppForgeSession | null {
  if (cachedSession) return cachedSession;
  const user = readStoredUser();
  if (!user) return null;
  const accessToken = readStoredAccessToken();
  if (accessToken) {
    markBrowserSession();
    cachedSession = { user, accessToken };
    return cachedSession;
  }
  if (!hasBrowserSession()) return null;
  cachedSession = { user };
  return cachedSession;
}

export function getAccessToken(): string | null {
  const token = getSession()?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    ...browserSessionHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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

function clearLocalSessionState() {
  sessionGeneration += 1;
  cachedSession = null;
  clearStoredUser();
  clearStoredAccessToken();
  clearBrowserSession();
  refreshInFlight = null;
  emitSessionChange();
}

export function signOut() {
  const session = getSession();
  const proofHeaders = browserSessionHeaders();
  clearLocalSessionState();

  void clearServerSessionWithHeaders(session?.accessToken, proofHeaders);
  if (session?.accessToken) {
    void supabaseClient.signOut(session.accessToken).catch(() => undefined);
  }
  void supabase.auth.signOut().catch(() => undefined);
}

async function clearServerSessionWithHeaders(
  accessToken: string | undefined,
  proofHeaders: Record<string, string>,
): Promise<void> {
  try {
    const headers = await withCsrfHeaders({
      ...proofHeaders,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    });
    await fetch("/api/auth/session?scope=local", {
      method: "DELETE",
      credentials: "same-origin",
      headers,
    });
  } catch {
    // Local browser state is already cleared.
  }
}

export async function logout(): Promise<void> {
  const session = getSession();
  const proofHeaders = browserSessionHeaders();
  clearLocalSessionState();

  await Promise.allSettled([
    clearServerSessionWithHeaders(session?.accessToken, proofHeaders),
    supabase.auth.signOut(),
    session?.accessToken
      ? supabaseClient.signOut(session.accessToken)
      : Promise.resolve(),
  ]);
}

export async function signOutOtherDevices(): Promise<void> {
  const session = getSession();
  await revokeServerSessions("others", session?.accessToken);
}

export async function signOutAllDevices(): Promise<void> {
  const session = getSession();
  await revokeServerSessions("global", session?.accessToken);
  clearLocalSessionState();
}

async function refreshServerCookieSession(): Promise<boolean> {
  if (!hasBrowserSession()) return false;
  const post = async (): Promise<Response> => {
    const headers = await withCsrfHeaders({
      Accept: "application/json",
      ...browserSessionHeaders(),
    });
    return fetch("/api/auth/session", {
      method: "POST",
      credentials: "same-origin",
      headers,
    });
  };

  let response = await post();
  if (response.status === 403) {
    clearCsrfToken();
    response = await post();
  }
  return response.ok;
}

export async function refreshSession(): Promise<AppForgeSession | null> {
  if (refreshInFlight) return refreshInFlight;

  const current = getSession();
  if (!current) return null;
  const generation = sessionGeneration;

  refreshInFlight = (async () => {
    clearStoredAccessToken();
    const refreshed = await refreshServerCookieSession().catch(() => false);

    if (generation !== sessionGeneration) return null;
    if (!refreshed) {
      cachedSession = null;
      clearStoredUser();
      clearStoredAccessToken();
      clearBrowserSession();
      emitSessionChange();
      return null;
    }

    cachedSession = { user: current.user };
    emitSessionChange();
    return cachedSession;
  })().finally(() => {
    refreshInFlight = null;
  });

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

  if (!session.accessToken || accessTokenExpired(session.accessToken)) {
    return refreshSession();
  }

  return session;
}

export async function getCurrentSession(): Promise<AppForgeSession | null> {
  return ensureFreshSession();
}

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

/** Identity providers the Supabase project actually has enabled. */
export function listSocialSignInProviders(): Promise<SocialSignInProvider[]> {
  return supabaseClient.listAuthProviders();
}

export function safeAuthDestination(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }
  return fallback;
}

export function startSocialSignIn(
  provider: SocialSignInProvider,
  next = "/",
): void {
  if (typeof window === "undefined") return;
  const target = safeAuthDestination(next);
  const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(target)}`;
  window.location.assign(
    supabaseClient.oauthAuthorizeUrl(provider, redirectTo),
  );
}

export function normalizePhone(phone: string): string {
  const normalized = phone.trim().replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone number must use international format, for example +6421…");
  }
  return normalized;
}

export async function signUp(
  email: string,
  phone: string,
  password: string,
  next = "/",
) {
  const result = await supabaseClient.signUp(
    email,
    normalizePhone(phone),
    password,
    next,
  );
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

export const emailSignUp = signUp;

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

export const emailLogin = signIn;

// Retained only for explicit phone-only auth flows. Account signup verification
// uses the linked authenticated-account Twilio flow instead, so it cannot create
// a second identity for the same person.
export async function sendPhoneOtp(phone: string): Promise<void> {
  const normalizedPhone = normalizePhone(phone);
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
  });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedToken = token.trim();
  if (!/^\d{6,10}$/.test(normalizedToken)) {
    throw new Error("Enter the SMS verification code.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: normalizedToken,
    type: "sms",
  });
  if (error) throw error;

  const remote = data.session;
  if (remote?.access_token && remote.user?.id) {
    const session: AppForgeSession = {
      accessToken: remote.access_token,
      user: {
        id: remote.user.id,
        email: remote.user.email ?? undefined,
        phone: remote.user.phone ?? normalizedPhone,
      },
    };
    sessionGeneration += 1;
    saveSession(session);
    await syncServerSessionBestEffort(
      remote.access_token,
      remote.refresh_token || undefined,
    );
  }

  return data;
}

export async function resendVerification(
  email: string,
  next = "/",
): Promise<void> {
  const headers = await withCsrfHeaders({ "Content-Type": "application/json" });
  const response = await fetch("/api/health/auth-resend-verification", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      email: email.trim(),
      next: safeAuthDestination(next),
    }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Too many requests. Please wait before trying again."
        : "Unable to request a verification email. Please try again shortly.",
    );
  }
}

import { useSyncExternalStore } from 'react';
import { supabaseClient } from './supabase-client';

const SESSION_KEY = 'appforge.session';
const listeners = new Set<() => void>();

export interface AppForgeSession {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email?: string };
}

let cachedRaw: string | null | undefined;
let cachedSession: AppForgeSession | null = null;

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
    const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    if (!storage) return null;
    return storage.getItem(key);
  } catch {
    /* iOS Safari private / ITP / blocked cookies: getItem throws SecurityError */
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    if (!storage) return;
    storage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function removeStorage(key: string) {
  try {
    const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    if (!storage) return;
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function parseSession(raw: string): AppForgeSession | null {
  try {
    const parsed = JSON.parse(raw) as AppForgeSession;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.accessToken !== 'string' || parsed.accessToken.length === 0) return null;
    if (!parsed.user || typeof parsed.user !== 'object' || typeof parsed.user.id !== 'string') return null;
    return parsed;
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

export function getSession(): AppForgeSession | null {
  const raw = readStorage(SESSION_KEY);
  if (!raw) {
    cachedRaw = null;
    cachedSession = null;
    return null;
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

export function authedUrl(path: string): string {
  const token = getAccessToken();
  if (!token) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}token=${encodeURIComponent(token)}`;
}

export function useSession(): AppForgeSession | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export function signOut() {
  removeStorage(SESSION_KEY);
  cachedRaw = null;
  cachedSession = null;
  emitSessionChange();
}

export async function signUp(email: string, password: string) {
  const result = await supabaseClient.signUp(email, password);
  if (result.error) throw new Error(result.error.message);
  const session = sessionFromAuth(result);
  if (session) saveSession(session);
  return result;
}

export async function signIn(email: string, password: string): Promise<AppForgeSession> {
  const result = await supabaseClient.signIn(email, password);
  const session = sessionFromAuth(result);
  if (!session) {
    throw new Error(result.error?.message || 'Sign-in failed.');
  }
  saveSession(session);
  return session;
}

export async function listProjects() {
  const session = getSession();
  if (!session) throw new Error('You must sign in first.');
  return supabaseClient.getProjects(session.accessToken);
}

export async function createProject(name: string, idea: string) {
  const session = getSession();
  if (!session) throw new Error('You must sign in first.');
  return supabaseClient.createProject(session.accessToken, { owner_id: session.user.id, name, idea });
}

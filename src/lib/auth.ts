import { useSyncExternalStore } from 'react';
import { supabaseClient } from './supabase-client';

const SESSION_KEY = 'appforge.session';
const listeners = new Set<() => void>();

export interface AppForgeSession {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email?: string };
}

function emitSessionChange() {
  listeners.forEach((listener) => listener());
}

function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function saveSession(session: AppForgeSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppForgeSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
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

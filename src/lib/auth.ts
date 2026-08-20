import { supabaseClient } from './supabase-client';

const SESSION_KEY = 'appforge.session';

export interface AppForgeSession {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email?: string };
}

function saveSession(session: AppForgeSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AppForgeSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppForgeSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export async function signUp(email: string, password: string) {
  const result = await supabaseClient.signUp(email, password);
  if (result.error) throw new Error(result.error.message);
  return result;
}

export async function signIn(email: string, password: string): Promise<AppForgeSession> {
  const result = await supabaseClient.signIn(email, password);
  if (!result.access_token || !result.user?.id) {
    throw new Error(result.error?.message || 'Sign-in failed.');
  }

  const session: AppForgeSession = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    user: result.user,
  };
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
  return supabaseClient.createProject(session.accessToken, {
    owner_id: session.user.id,
    name,
    idea,
  });
}

export async function buildProject(projectId: string, prompt?: string) {
  const session = getSession();
  if (!session) throw new Error('You must sign in first.');
  return supabaseClient.buildProject(session.accessToken, projectId, prompt);
}

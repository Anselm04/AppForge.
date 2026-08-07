import { FormEvent, useEffect, useState } from 'react';
import { AppForgeSession, createProject, getSession, listProjects, signIn, signOut, signUp } from './lib/auth';
import { Pricing } from './components/Pricing';
import type { AppForgePlan } from './lib/billing';
import type { Project } from './types/database';

const paymentLinks: Record<AppForgePlan, string> = {
  starter: 'https://buy.stripe.com/aFa8wOb7Dfe7f781tecfK01',
  builder: 'https://buy.stripe.com/00w7sKcbHfe7cZ0eg0cfK02',
  studio: 'https://buy.stripe.com/eVq14m1x3c1V3oq9ZKcfK03',
};

export default function App() {
  const [session, setSession] = useState<AppForgeSession | null>(() => getSession());
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { if (session) setProjects(await listProjects() as Project[]); };
  useEffect(() => { void load(); }, [session]);
  const choose = (plan: AppForgePlan) => { window.location.assign(paymentLinks[plan]); };
  const authenticate = async (mode: 'signin' | 'signup') => { setBusy(true); try { if (mode === 'signup') { await signUp(email, password); setMessage('Account created. Check email, then sign in.'); } else setSession(await signIn(email, password)); } catch (e) { setMessage(e instanceof Error ? e.message : 'Authentication failed.'); } finally { setBusy(false); } };
  const save = async (e: FormEvent) => { e.preventDefault(); if (!session) return; setBusy(true); try { await createProject(name, idea); setName(''); setIdea(''); await load(); } finally { setBusy(false); } };
  return <main style={{ maxWidth: 1040, margin: 'auto', padding: 24, fontFamily: 'system-ui' }}><header><h1>AppForge</h1><p>Turn an app idea into a structured build plan.</p>{session && <button onClick={() => { signOut(); setSession(null); }}>Sign out</button>}</header>{message && <p>{message}</p>}<Pricing busy={busy} onChoose={choose}/>{!session ? <section><h2>Start building</h2><input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}/><input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}/><button disabled={busy} onClick={() => void authenticate('signin')}>Sign in</button><button disabled={busy} onClick={() => void authenticate('signup')}>Create account</button></section> : <section><h2>Create a project</h2><form onSubmit={save}><input placeholder="Project name" value={name} onChange={e => setName(e.target.value)} required/><textarea placeholder="What do you want to build?" value={idea} onChange={e => setIdea(e.target.value)} required/><button disabled={busy}>Save project</button></form><h2>Your projects</h2>{projects.map(p => <p key={p.id}>{p.name} — {p.status}</p>)}</section>}</main>;
}

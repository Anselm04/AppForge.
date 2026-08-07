import { FormEvent, useEffect, useState } from 'react';
import { AppForgeSession, createProject, getSession, listProjects, signIn, signOut, signUp } from './lib/auth';
import type { Project } from './types/database';

const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' };
const input = { width: '100%', boxSizing: 'border-box' as const, padding: 12, marginTop: 6, border: '1px solid #d1d5db', borderRadius: 8 };
const button = { border: 0, borderRadius: 8, padding: '11px 16px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' };

export default function App() {
  const [session, setSession] = useState<AppForgeSession | null>(() => getSession());
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadProjects = async () => {
    try { setProjects((await listProjects()) as Project[]); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load projects.'); }
  };

  useEffect(() => { if (session) void loadProjects(); }, [session]);

  const authenticate = async (event: FormEvent, mode: 'signin' | 'signup') => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'signup') { await signUp(email, password); setMessage('Account created. Check email if confirmation is enabled, then sign in.'); }
      else { setSession(await signIn(email, password)); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  };

  const submitProject = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await createProject(name, idea); setName(''); setIdea(''); await loadProjects(); setMessage('Project saved.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save project.'); }
    finally { setBusy(false); }
  };

  return <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div><h1 style={{ margin: 0 }}>AppForge</h1><p style={{ color: '#64748b' }}>Turn an app idea into a structured build plan.</p></div>
        {session && <button style={button} onClick={() => { signOut(); setSession(null); setProjects([]); }}>Sign out</button>}
      </header>
      {message && <p role="status" style={{ ...card, borderColor: '#93c5fd', color: '#1d4ed8' }}>{message}</p>}
      {!session ? <section style={{ ...card, maxWidth: 440, margin: '48px auto' }}>
        <h2>Start building</h2><p style={{ color: '#64748b' }}>Create an account or sign in to save projects.</p>
        <form onSubmit={(event) => authenticate(event, 'signin')}>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} style={input} required /></label>
          <label style={{ display: 'block', marginTop: 14 }}>Password<input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={input} required /></label>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><button style={button} disabled={busy}>Sign in</button><button type="button" style={{ ...button, background: '#475569' }} disabled={busy} onClick={() => { const form = document.querySelector('form'); if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }}>Create account</button></div>
        </form>
        <button style={{ marginTop: 12, border: 0, background: 'none', color: '#2563eb', cursor: 'pointer' }} disabled={busy} onClick={(event) => { const form = (event.currentTarget.closest('section')?.querySelector('form')); if (form) void authenticate({ preventDefault: () => undefined } as FormEvent, 'signup'); }}>Create account instead</button>
      </section> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, .8fr)', gap: 20 }}>
        <section style={card}><h2>Create a project</h2><form onSubmit={submitProject}><label>Project name<input value={name} onChange={e => setName(e.target.value)} style={input} maxLength={120} required /></label><label style={{ display: 'block', marginTop: 14 }}>What do you want to build?<textarea value={idea} onChange={e => setIdea(e.target.value)} style={{ ...input, minHeight: 150 }} maxLength={20000} required /></label><button style={{ ...button, marginTop: 18 }} disabled={busy}>Save project</button></form></section>
        <section style={card}><h2>Your projects</h2>{projects.length ? projects.map(project => <article key={project.id} style={{ borderTop: '1px solid #e5e7eb', padding: '12px 0' }}><strong>{project.name}</strong><p style={{ margin: '5px 0', color: '#64748b' }}>{project.status}</p></article>) : <p style={{ color: '#64748b' }}>No projects yet.</p>}</section>
      </div>}
    </div>
  </main>;
}

import { FormEvent, useEffect, useState } from 'react';
import {
  AppForgeSession,
  buildProject,
  createProject,
  getSession,
  listProjects,
  signIn,
  signOut,
  signUp,
} from './lib/auth';
import { startCheckout, type AppForgePlan } from './lib/billing';
import { Pricing } from './components/Pricing';
import type { Project } from './types/database';

function downloadFilesAsZip(
  projectName: string,
  files: { path: string; content: string }[]
) {
  // Minimal uncompressed ZIP (store method) so users get real files without a dependency.
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const u32 = (n: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    local.set([0x50, 0x4b, 0x03, 0x04], 0);
    local.set(u16(20), 4);
    local.set(u16(0), 6);
    local.set(u16(0), 8);
    local.set(u16(0), 10);
    local.set(u16(0), 12);
    local.set(u32(0), 14);
    local.set(u32(data.length), 18);
    local.set(u32(data.length), 22);
    local.set(u16(nameBytes.length), 26);
    local.set(u16(0), 28);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    parts.push(local);

    const cen = new Uint8Array(46 + nameBytes.length);
    cen.set([0x50, 0x4b, 0x01, 0x02], 0);
    cen.set(u16(20), 4);
    cen.set(u16(20), 6);
    cen.set(u16(0), 8);
    cen.set(u16(0), 10);
    cen.set(u16(0), 12);
    cen.set(u16(0), 14);
    cen.set(u32(0), 16);
    cen.set(u32(data.length), 20);
    cen.set(u32(data.length), 24);
    cen.set(u16(nameBytes.length), 28);
    cen.set(u16(0), 30);
    cen.set(u16(0), 32);
    cen.set(u16(0), 34);
    cen.set(u16(0), 36);
    cen.set(u32(0), 38);
    cen.set(u32(offset), 42);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  end.set([0x50, 0x4b, 0x05, 0x06], 0);
  end.set(u16(0), 4);
  end.set(u16(0), 6);
  end.set(u16(files.length), 8);
  end.set(u16(files.length), 10);
  end.set(u32(centralSize), 12);
  end.set(u32(offset), 16);
  end.set(u16(0), 20);

  const total =
    parts.reduce((s, p) => s + p.length, 0) + centralSize + end.length;
  const zip = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    zip.set(p, o);
    o += p.length;
  }
  for (const c of central) {
    zip.set(c, o);
    o += c.length;
  }
  zip.set(end, o);

  const blob = new Blob([zip], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName || 'appforge-project'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [session, setSession] = useState<AppForgeSession | null>(() => getSession());
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastBuild, setLastBuild] = useState<{
    name: string;
    files: { path: string; content: string }[];
    summary: string;
    stack: string;
    run_instructions: string;
  } | null>(null);

  const load = async () => {
    if (session) setProjects((await listProjects()) as Project[]);
  };
  useEffect(() => {
    void load();
  }, [session]);

  const choose = async (plan: AppForgePlan) => {
    if (!session)
      return setMessage('Create an account or sign in before starting your 7-day trial.');
    setBusy(true);
    try {
      await startCheckout(plan, session.accessToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout is not configured yet.');
      setBusy(false);
    }
  };

  const authenticate = async (mode: 'signin' | 'signup') => {
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setMessage('Account created. Check your email if confirmation is required, then sign in.');
      } else setSession(await signIn(email, password));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      const created = (await createProject(name, idea)) as Project[] | Project;
      const project = Array.isArray(created) ? created[0] : created;
      setName('');
      setIdea('');
      await load();

      if (project?.id) {
        setMessage('Project saved. Generating application…');
        const build = await buildProject(project.id, project.idea);
        setLastBuild(build.result);
        setMessage(
          `Build complete (${build.result.files.length} files). Credits remaining: ${build.creditsRemaining}.`
        );
        await load();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Save or build failed. You may need an active trial/subscription with credits.'
      );
    } finally {
      setBusy(false);
    }
  };

  const rebuild = async (project: Project) => {
    setBusy(true);
    setMessage('');
    try {
      const build = await buildProject(project.id, project.idea);
      setLastBuild(build.result);
      setMessage(
        `Build complete (${build.result.files.length} files). Credits remaining: ${build.creditsRemaining}.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Build failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 1040, margin: 'auto', padding: 24, fontFamily: 'system-ui' }}>
      <header>
        <h1>AppForge</h1>
        <p>Turn an app idea into a generated starter project you can download.</p>
        {session && (
          <button
            onClick={() => {
              signOut();
              setSession(null);
              setProjects([]);
              setLastBuild(null);
            }}
          >
            Sign out
          </button>
        )}
      </header>
      {message && <p role="status">{message}</p>}
      <Pricing signedIn={!!session} busy={busy} onChoose={choose} />
      {!session ? (
        <section>
          <h2>Start building</h2>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button disabled={busy} onClick={() => void authenticate('signin')}>
            Sign in
          </button>
          <button disabled={busy} onClick={() => void authenticate('signup')}>
            Create account
          </button>
        </section>
      ) : (
        <section>
          <h2>Create a project</h2>
          <form onSubmit={save}>
            <input
              placeholder="Project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <textarea
              placeholder="What do you want to build?"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              required
              rows={4}
              style={{ width: '100%' }}
            />
            <button disabled={busy}>{busy ? 'Working…' : 'Save & generate'}</button>
          </form>
          <h2>Your projects</h2>
          {projects.map((project) => (
            <p key={project.id}>
              {project.name} — {project.status}{' '}
              <button disabled={busy} onClick={() => void rebuild(project)}>
                Generate again
              </button>
            </p>
          ))}
          {lastBuild && (
            <section style={{ marginTop: 24, borderTop: '1px solid #ddd', paddingTop: 16 }}>
              <h2>{lastBuild.name}</h2>
              <p>{lastBuild.summary}</p>
              <p>
                <strong>Stack:</strong> {lastBuild.stack}
              </p>
              <p>
                <strong>Files:</strong> {lastBuild.files.map((f) => f.path).join(', ')}
              </p>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{lastBuild.run_instructions}</pre>
              <button
                onClick={() => downloadFilesAsZip(lastBuild.name, lastBuild.files)}
              >
                Download ZIP
              </button>
            </section>
          )}
        </section>
      )}
    </main>
  );
}

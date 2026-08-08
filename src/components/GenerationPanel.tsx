import { useState } from 'react';
import { generateProject, type GeneratedManifest } from '../lib/generation';

type Props = {
  approvedPlan: string;
  accessToken: string | null;
  onGenerated?: (manifest: GeneratedManifest) => void;
};

export function GenerationPanel({ approvedPlan, accessToken, onGenerated }: Props) {
  const [state, setState] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [manifest, setManifest] = useState<GeneratedManifest | null>(null);

  const generate = async () => {
    if (!approvedPlan.trim()) return setMessage('Approve a plan before generating.');
    if (!accessToken) return setMessage('Sign in and redeem a beta code before generating.');
    setState('generating');
    setMessage('Generating a source artifact…');
    try {
      const result = await generateProject(approvedPlan, accessToken);
      setManifest(result.manifest);
      setState('complete');
      setMessage(`Generated ${result.manifest.files.length} source files.`);
      onGenerated?.(result.manifest);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Generation failed.');
    }
  };

  return <section aria-live="polite">
    <h2>Generate source</h2>
    <p>Generation returns a source artifact. It has not been exported, deployed, or tested yet.</p>
    <button type="button" onClick={generate} disabled={state === 'generating'}>
      {state === 'generating' ? 'Generating…' : 'Generate project'}
    </button>
    {message && <p role={state === 'error' ? 'alert' : 'status'}>{message}</p>}
    {manifest && <details><summary>{manifest.projectName}: {manifest.files.length} files</summary><p>{manifest.summary}</p><ul>{manifest.files.map((file) => <li key={file.path}>{file.path}</li>)}</ul></details>}
  </section>;
}

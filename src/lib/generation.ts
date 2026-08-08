export type GeneratedFile = { path: string; content: string };
export type GeneratedManifest = { projectName: string; summary: string; files: GeneratedFile[] };
export type GenerationResult = { manifest: GeneratedManifest; generatedAt: string };

export async function generateProject(plan: string, accessToken: string): Promise<GenerationResult> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ plan })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Generation failed.');
  if (!payload.manifest || !Array.isArray(payload.manifest.files)) throw new Error('Generation returned an invalid artifact.');
  return payload as GenerationResult;
}

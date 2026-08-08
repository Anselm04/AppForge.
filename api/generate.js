import { buildPrompt, validateManifest } from './build.js';

const send = (res, status, body) => res.status(status).json(body);
const rest = (url, key, path, options = {}) => fetch(`${url}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } });
async function input(req) { if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 24000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); } }); req.on('error', reject); }); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  let runId = null, url, service;
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    url = process.env.SUPABASE_URL; const anon = process.env.SUPABASE_ANON_KEY; service = process.env.SUPABASE_SERVICE_ROLE_KEY; const gateway = process.env.AI_GATEWAY_API_KEY;
    if (!token || !url || !anon || !service || !gateway) throw new Error('Generation is not configured.');
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!userResponse.ok) return send(res, 401, { error: 'Sign in is required.' });
    const user = await userResponse.json(); const data = await input(req); const projectId = String(data.projectId || ''); const plan = String(data.plan || '').trim(); const type = String(data.type || 'web-app');
    if (!projectId || !plan || plan.length > 20000) throw new Error('Provide a project and approved plan.');
    const invite = await rest(url, service, `appforge_invite_redemptions?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
    if (!invite.ok || !(await invite.json()).length) return send(res, 403, { error: 'A redeemed beta invite is required.' });
    const project = await rest(url, service, `projects?id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
    if (!project.ok || !(await project.json()).length) return send(res, 404, { error: 'Project not found.' });
    const prompt = buildPrompt(type, plan); const created = await rest(url, service, 'build_runs', { method: 'POST', body: JSON.stringify({ project_id: projectId, requested_by: user.id, status: 'running', prompt: plan, provider: 'vercel-ai-gateway', model: process.env.APPFORGE_GENERATION_MODEL || 'openai/gpt-4.1-mini', started_at: new Date().toISOString() }) });
    if (!created.ok) throw new Error('Could not create build run.'); runId = (await created.json())[0]?.id; if (!runId) throw new Error('Could not create build run.');
    await rest(url, service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: runId, stage: 'generating', status: 'started', message: 'Generating constrained source artifact.', metadata: { type } }) });
    const ai = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gateway}` }, body: JSON.stringify({ model: process.env.APPFORGE_GENERATION_MODEL || 'openai/gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }) });
    if (!ai.ok) throw new Error('Generation provider failed.'); const payload = await ai.json(); const manifest = validateManifest(JSON.parse(payload.choices?.[0]?.message?.content || '{}'));
    const now = new Date().toISOString(); const artifact = await rest(url, service, 'appforge_build_artifacts', { method: 'POST', body: JSON.stringify({ build_run_id: runId, kind: 'source_archive', content: manifest }) }); if (!artifact.ok) throw new Error('Could not save source artifact.');
    await rest(url, service, `build_runs?id=eq.${encodeURIComponent(runId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', result: manifest, completed_at: now }) });
    await rest(url, service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: runId, stage: 'completed', status: 'passed', message: `Saved ${manifest.files.length} generated source files.`, metadata: { fileCount: manifest.files.length, type } }) });
    return send(res, 200, { runId, manifest, generatedAt: now });
  } catch (error) {
    if (runId && url && service) { const message = error?.message || 'Generation failed.'; await rest(url, service, `build_runs?id=eq.${encodeURIComponent(runId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_message: message, completed_at: new Date().toISOString() }) }).catch(() => null); await rest(url, service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: runId, stage: 'failed', status: 'failed', message, metadata: {} }) }).catch(() => null); }
    return send(res, 400, { error: error?.message || 'Generation failed.' });
  }
}

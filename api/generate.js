const MAX_PLAN_CHARS = 18000;
const MAX_FILES = 24;
const MAX_FILE_CHARS = 40000;

const send = (res, status, body) => res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
const parse = (value) => JSON.parse(String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));

async function body(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 25000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); } }); req.on('error', reject); });
}

function manifest(value) {
  if (!value || !Array.isArray(value.files) || value.files.length < 1 || value.files.length > MAX_FILES) throw new Error('The model did not return a valid file manifest.');
  const files = value.files.map(file => ({ path: String(file.path || ''), content: String(file.content || '') }));
  const safe = /^(src|public)\/[A-Za-z0-9_./-]+$|^(index\.html|package\.json|vite\.config\.ts|tsconfig\.json)$/;
  const names = new Set();
  for (const file of files) if (!safe.test(file.path) || file.path.includes('..') || names.has(file.path) || file.content.length > MAX_FILE_CHARS) throw new Error('The model returned an unsafe or oversized file.'); else names.add(file.path);
  return { projectName: String(value.projectName || 'generated-app').slice(0, 80), summary: String(value.summary || '').slice(0, 800), files };
}

function rest(url, key, path, options = {}) {
  return fetch(`${url}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } });
}

async function identity(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anon || !service) throw new Error('Server authentication is not configured.');
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) throw new Error('Sign in is required.');
  const user = await userResponse.json();
  const invite = await rest(url, service, `appforge_invite_redemptions?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
  if (!invite.ok || !(await invite.json()).length) throw new Error('A redeemed beta invite is required.');
  return { user, url, service };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  let ctx, runId;
  try {
    ctx = await identity(req);
    const input = await body(req), plan = String(input.plan || '').trim(), projectId = String(input.projectId || '');
    if (!plan || plan.length > MAX_PLAN_CHARS || !projectId) return send(res, 400, { error: 'Provide a project and an approved plan under 18,000 characters.' });
    const project = await rest(ctx.url, ctx.service, `projects?id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(ctx.user.id)}&select=id&limit=1`);
    if (!project.ok || !(await project.json()).length) return send(res, 404, { error: 'Project not found.' });
    const model = process.env.APPFORGE_GENERATION_MODEL || 'openai/gpt-4.1-mini';
    const runResponse = await rest(ctx.url, ctx.service, 'build_runs', { method: 'POST', body: JSON.stringify({ project_id: projectId, requested_by: ctx.user.id, status: 'running', prompt: plan, provider: 'vercel-ai-gateway', model, started_at: new Date().toISOString() }) });
    if (!runResponse.ok) throw new Error('Could not create the build run.');
    runId = (await runResponse.json())[0].id;
    await rest(ctx.url, ctx.service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: runId, stage: 'generating', status: 'started', message: 'Creating source artifact.' }) });
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) throw new Error('Generation is not configured yet.');
    const prompt = `Create a small runnable React + Vite TypeScript app from this approved plan. Return JSON only: {projectName,summary,files:[{path,content}]}. Include package.json, index.html, src/main.tsx, src/App.tsx, src/styles.css, src/vite-env.d.ts and only essential files. Never include server code, secrets, environment files, remote scripts, shell commands, binary data, or markdown. Approved plan:\n${plan}`;
    const ai = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You produce constrained application file manifests.' }, { role: 'user', content: prompt }] }) });
    if (!ai.ok) throw new Error('The generation provider did not complete the request.');
    const output = manifest(parse((await ai.json())?.choices?.[0]?.message?.content));
    await rest(ctx.url, ctx.service, 'appforge_build_artifacts', { method: 'POST', body: JSON.stringify({ build_run_id: runId, kind: 'source_archive', content: output }) });
    await rest(ctx.url, ctx.service, `build_runs?id=eq.${encodeURIComponent(runId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', result: output, completed_at: new Date().toISOString() }) });
    await rest(ctx.url, ctx.service, `projects?id=eq.${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', current_spec: output, updated_at: new Date().toISOString() }) });
    await rest(ctx.url, ctx.service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: runId, stage: 'completed', status: 'passed', message: 'Source artifact generated and saved.', metadata: { fileCount: output.files.length } }) });
    return send(res, 200, { runId, manifest: output, generatedAt: new Date().toISOString() });
  } catch (error) {
    if (ctx && runId) { await rest(ctx.url, ctx.service, `build_runs?id=eq.${encodeURIComponent(runId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_message: String(error.message || 'Generation failed.'), completed_at: new Date().toISOString() }) }); await rest(ctx.url, ctx.service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: runId, stage: 'failed', status: 'failed', message: String(error.message || 'Generation failed.') }) }); }
    return send(res, error.message === 'Sign in is required.' ? 401 : 400, { error: error.message || 'Generation failed.', runId });
  }
}

const MAX_PLAN_CHARS = 18000;
const MAX_FILES = 24;
const MAX_FILE_CHARS = 40000;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body) return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 25000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); } });
    req.on('error', reject);
  });
}

function extractJson(value) {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

function safeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) throw new Error('The model did not return a file manifest.');
  if (manifest.files.length < 1 || manifest.files.length > MAX_FILES) throw new Error('The generated file count is outside the allowed limit.');
  const files = manifest.files.map((file) => ({ path: String(file.path || ''), content: String(file.content || '') }));
  const allowed = /^(src|public)\/[A-Za-z0-9_./-]+$|^(index\.html|package\.json|vite\.config\.ts|tsconfig\.json)$/;
  const unique = new Set();
  for (const file of files) {
    if (!allowed.test(file.path) || file.path.includes('..') || unique.has(file.path) || file.content.length > MAX_FILE_CHARS) throw new Error('The model returned an unsafe or oversized file.');
    unique.add(file.path);
  }
  return { projectName: String(manifest.projectName || 'generated-app').slice(0, 80), summary: String(manifest.summary || '').slice(0, 800), files };
}

async function verifiedUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey || !serviceKey) throw new Error('Server authentication is not configured.');
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) throw new Error('Sign in is required.');
  const user = await userResponse.json();
  const accessResponse = await fetch(`${url}/rest/v1/appforge_beta_redemptions?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!accessResponse.ok) throw new Error('Unable to verify beta access.');
  const redemptions = await accessResponse.json();
  if (!Array.isArray(redemptions) || !redemptions.length) throw new Error('A redeemed beta code is required.');
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    await verifiedUser(req);
    const body = await readBody(req);
    const plan = String(body.plan || '').trim();
    if (!plan || plan.length > MAX_PLAN_CHARS) return json(res, 400, { error: 'Provide an approved plan under 18,000 characters.' });
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    if (!gatewayKey) return json(res, 503, { error: 'Generation is not configured yet.' });
    const model = process.env.APPFORGE_GENERATION_MODEL || 'openai/gpt-4.1-mini';
    const prompt = `Create a small, runnable React + Vite TypeScript app from this approved plan. Return JSON only: {projectName,summary,files:[{path,content}]}. Include package.json, index.html, src/main.tsx, src/App.tsx, src/styles.css, src/vite-env.d.ts and only essential additional files. Do not include server code, secrets, environment files, remote scripts, tracking, shell commands, binary data, or markdown. Use only safe local UI behavior. Approved plan:\n${plan}`;
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gatewayKey}` },
      body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You produce constrained application file manifests.' }, { role: 'user', content: prompt }] })
    });
    if (!response.ok) return json(res, 502, { error: 'The generation provider did not complete the request.' });
    const payload = await response.json();
    const manifest = safeManifest(extractJson(payload?.choices?.[0]?.message?.content));
    return json(res, 200, { manifest, generatedAt: new Date().toISOString() });
  } catch (error) {
    return json(res, error.message === 'Sign in is required.' ? 401 : 400, { error: error.message || 'Generation failed.' });
  }
}

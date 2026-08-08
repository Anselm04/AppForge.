const send = (res, status, body) => res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

async function body(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 24000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); } }); req.on('error', reject); });
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
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.' });
  try {
    const ctx = await identity(req);
    if (req.method === 'GET') {
      const fields = 'id,name,idea,status,current_spec,created_at,updated_at,build_runs(id,status,provider,model,result,error_message,started_at,completed_at,created_at,appforge_build_artifacts(id,kind,url,content,created_at),appforge_build_events(id,stage,status,message,metadata,created_at))';
      const response = await rest(ctx.url, ctx.service, `projects?owner_id=eq.${encodeURIComponent(ctx.user.id)}&select=${encodeURIComponent(fields)}&order=updated_at.desc`);
      if (!response.ok) throw new Error('Could not load projects.');
      return send(res, 200, { projects: await response.json() });
    }
    const input = await body(req), name = String(input.name || '').trim(), idea = String(input.idea || '').trim();
    if (!name || name.length > 120 || !idea || idea.length > 20000) return send(res, 400, { error: 'Provide a project name and idea within the allowed limits.' });
    const response = await rest(ctx.url, ctx.service, 'projects', { method: 'POST', body: JSON.stringify({ owner_id: ctx.user.id, name, idea, status: 'draft' }) });
    if (!response.ok) throw new Error('Could not create the project.');
    return send(res, 201, { project: (await response.json())[0] });
  } catch (error) {
    return send(res, error.message === 'Sign in is required.' ? 401 : 400, { error: error.message || 'Project request failed.' });
  }
}

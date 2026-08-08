const send = (res, status, body) => res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

async function body(req) { if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 12000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body.')); } }); req.on('error', reject); }); }
function rest(url, key, path, options = {}) { return fetch(`${url}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } }); }

async function identity(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anon || !service) throw new Error('Server authentication is not configured.');
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } }); if (!userResponse.ok) throw new Error('Sign in is required.'); const user = await userResponse.json();
  const invite = await rest(url, service, `appforge_invite_redemptions?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`); if (!invite.ok || !(await invite.json()).length) throw new Error('A redeemed beta invite is required.');
  return { user, url, service };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const ctx = await identity(req), input = await body(req), buildRunId = String(input.buildRunId || ''), owner = String(input.owner || ''), repo = String(input.repo || ''), branch = String(input.branch || 'main');
    if (!/^[A-Za-z0-9-]{1,39}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || !/^[A-Za-z0-9_./-]{1,100}$/.test(branch) || branch.includes('..')) return send(res, 400, { error: 'Provide a valid repository owner, name, and branch.' });
    const runQuery = `build_runs?id=eq.${encodeURIComponent(buildRunId)}&requested_by=eq.${encodeURIComponent(ctx.user.id)}&select=id,project_id&limit=1`;
    const runResponse = await rest(ctx.url, ctx.service, runQuery); const runs = runResponse.ok ? await runResponse.json() : []; if (!runs.length) return send(res, 404, { error: 'Build run not found.' });
    const artifactResponse = await rest(ctx.url, ctx.service, `appforge_build_artifacts?build_run_id=eq.${encodeURIComponent(buildRunId)}&kind=eq.source_archive&select=content&order=created_at.desc&limit=1`); const artifacts = artifactResponse.ok ? await artifactResponse.json() : []; const source = artifacts[0]?.content;
    if (!source?.files?.length) return send(res, 400, { error: 'No saved source artifact is available for this build run.' });
    const githubToken = process.env.APPFORGE_GITHUB_TOKEN; if (!githubToken) return send(res, 503, { error: 'GitHub export is not configured yet.' });
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${githubToken}`, 'X-GitHub-Api-Version': '2022-11-28' };
    for (const file of source.files) {
      const path = String(file.path || ''); if (!/^(src|public)\/[A-Za-z0-9_./-]+$|^(index\.html|package\.json|vite\.config\.ts|tsconfig\.json)$/.test(path) || path.includes('..')) throw new Error('Saved artifact contains an invalid path.');
      const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
      const current = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers }); const currentBody = current.ok ? await current.json() : null;
      if (!current.ok && current.status !== 404) throw new Error(`GitHub could not read ${path}.`);
      const update = await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `AppForge export: ${path}`, content: Buffer.from(String(file.content || ''), 'utf8').toString('base64'), branch, ...(currentBody?.sha ? { sha: currentBody.sha } : {}) }) });
      if (!update.ok) throw new Error(`GitHub could not export ${path}.`);
    }
    const repositoryUrl = `https://github.com/${owner}/${repo}`;
    await rest(ctx.url, ctx.service, 'appforge_build_artifacts', { method: 'POST', body: JSON.stringify({ build_run_id: buildRunId, kind: 'repository_url', url: repositoryUrl, content: { branch, fileCount: source.files.length } }) });
    await rest(ctx.url, ctx.service, 'appforge_build_events', { method: 'POST', body: JSON.stringify({ build_run_id: buildRunId, stage: 'completed', status: 'passed', message: 'Source artifact exported to GitHub.', metadata: { repositoryUrl, branch, fileCount: source.files.length } }) });
    return send(res, 200, { repositoryUrl, branch, fileCount: source.files.length });
  } catch (error) { return send(res, error.message === 'Sign in is required.' ? 401 : 400, { error: error.message || 'GitHub export failed.' }); }
}

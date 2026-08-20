/**
 * POST /api/build
 * Auth: Supabase access token (Bearer)
 * Body: { projectId: string, prompt?: string }
 *
 * Checks entitlement credits, calls OpenAI to generate real project files,
 * decrements one credit, stores result on the project row.
 */

const MAX_FILES = 12;
const MAX_FILE_CHARS = 25000;

async function supabaseUser(token) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function serviceHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function getEntitlement(userId) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/appforge_entitlements?user_id=eq.${userId}&select=*`,
    { headers: serviceHeaders() }
  );
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function getProject(projectId, userId) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&owner_id=eq.${userId}&select=*`,
    {
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function cleanFiles(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const f of raw.slice(0, MAX_FILES)) {
    if (!f || typeof f !== 'object') continue;
    const path = String(f.path || '')
      .trim()
      .replace(/^\/+/, '');
    let content = typeof f.content === 'string' ? f.content : '';
    if (!path || path.includes('..')) continue;
    if (content.length > MAX_FILE_CHARS) {
      content = content.slice(0, MAX_FILE_CHARS) + '\n// truncated by AppForge\n';
    }
    out.push({ path, content });
  }
  return out;
}

async function generateFiles(prompt) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiKey) throw new Error('LLM API key is not configured');

  const model = process.env.AI_MODEL || 'gpt-4o';
  const base =
    process.env.BUILT_IN_FORGE_API_URL?.replace(/\/$/, '') ||
    'https://api.openai.com';

  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 8000,
      messages: [
        {
          role: 'system',
          content: `You are AppForge. Return ONE JSON object only (no markdown):
{"name":"kebab-name","summary":"...","stack":"...","files":[{"path":"relative/path","content":"full file contents"}],"run_instructions":"..."}
Rules: 5-12 real runnable files, include README.md and dependency manifest, no TODO stubs, no secrets, paths must be relative without ..`,
        },
        { role: 'user', content: `Build this application:\n${prompt}` },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `LLM failed: ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM returned no JSON');
  const parsed = JSON.parse(match[0]);
  const files = cleanFiles(parsed.files);
  if (!files.length) throw new Error('LLM produced no valid files');

  return {
    name: String(parsed.name || 'generated-app').slice(0, 80),
    summary: String(parsed.summary || '').slice(0, 400),
    stack: String(parsed.stack || '').slice(0, 200),
    files,
    run_instructions: String(parsed.run_instructions || '').slice(0, 2000),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)
  ) {
    return res.status(503).json({ error: 'Build API is not configured.' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await supabaseUser(token);
  if (!user?.id) {
    return res.status(401).json({ error: 'Sign in first.' });
  }

  const projectId = req.body?.projectId;
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'projectId is required.' });
  }

  const project = await getProject(projectId, user.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const entitlement = await getEntitlement(user.id);
  const status = entitlement?.subscription_status;
  const credits = Number(entitlement?.build_credits_remaining ?? 0);
  const periodOk =
    !entitlement?.current_period_end ||
    new Date(entitlement.current_period_end) > new Date();
  const entitled =
    entitlement &&
    (status === 'active' || status === 'trialing') &&
    periodOk &&
    credits > 0;

  if (!entitled) {
    return res.status(402).json({
      error:
        'Active subscription with remaining build credits is required. Start a trial from pricing.',
    });
  }

  const prompt =
    (typeof req.body?.prompt === 'string' && req.body.prompt.trim()) ||
    project.idea;

  try {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'planning', updated_at: new Date().toISOString() }),
      }
    );

    const generated = await generateFiles(prompt);

    // Decrement credit (not a full ledger yet — single atomic-ish patch)
    const newCredits = Math.max(0, credits - 1);
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/appforge_entitlements?user_id=eq.${user.id}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          build_credits_remaining: newCredits,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'completed',
          current_spec: generated,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return res.status(200).json({
      projectId,
      creditsRemaining: newCredits,
      result: generated,
    });
  } catch (error) {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          updated_at: new Date().toISOString(),
        }),
      }
    ).catch(() => {});

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Build failed.',
    });
  }
}

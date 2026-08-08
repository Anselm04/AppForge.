const TARGETS = {
  'web-app': { runtime: 'React + Vite TypeScript', modules: ['responsive pages', 'routing', 'local state', 'accessible forms'], artifacts: ['source manifest', 'build plan', 'test checklist'] },
  game: { runtime: 'HTML5 Canvas + TypeScript', modules: ['game loop', 'keyboard/touch input', 'score/progression', 'asset placeholders'], artifacts: ['source manifest', 'game design plan', 'test checklist'] },
  agent: { runtime: 'React + TypeScript agent interface', modules: ['task contract', 'tool allowlist', 'approval boundary', 'session transcript'], artifacts: ['source manifest', 'agent plan', 'tool policy'] },
  tool: { runtime: 'React + Vite TypeScript', modules: ['role workflows', 'data forms', 'filters', 'audit-ready events'], artifacts: ['source manifest', 'workflow map', 'test checklist'] },
  software: { runtime: 'React + Vite TypeScript', modules: ['product flows', 'settings', 'data model', 'release boundary'], artifacts: ['source manifest', 'architecture plan', 'test checklist'] }
};
const allowedPath = /^(src|public)\/[A-Za-z0-9_./-]+$|^(index\.html|package\.json|vite\.config\.ts|tsconfig\.json)$/;

export function buildPrompt(type, plan) {
  const target = TARGETS[type];
  if (!target) throw new Error('Unsupported build type.');
  return `Build a small runnable ${target.runtime} project. Required modules: ${target.modules.join(', ')}. Return JSON only: {projectName,summary,files:[{path,content}]}. Include only essential local files. Never include secrets, environment files, server code, remote scripts, shell commands, binary data, or markdown. Expected artifacts: ${target.artifacts.join(', ')}. Approved plan:\n${plan}`;
}

export function validateManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 30) throw new Error('Invalid generated file manifest.');
  const names = new Set();
  const files = manifest.files.map(({ path, content }) => ({ path: String(path || ''), content: String(content || '') }));
  for (const file of files) {
    if (!allowedPath.test(file.path) || file.path.includes('..') || names.has(file.path) || file.content.length > 50000) throw new Error('Unsafe generated file manifest.');
    names.add(file.path);
  }
  return { projectName: String(manifest.projectName || 'generated-project').slice(0, 80), summary: String(manifest.summary || '').slice(0, 1000), files };
}

export default function handler(req, res) {
  const type = String(req.query.type || 'web-app');
  if (!TARGETS[type]) return res.status(400).json({ error: 'Unsupported build type.', supportedTypes: Object.keys(TARGETS) });
  return res.status(200).json({ type, target: TARGETS[type], promptContract: buildPrompt(type, 'Describe the product outcome, users, and constraints.') });
}

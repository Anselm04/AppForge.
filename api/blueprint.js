const BLUEPRINTS = {
  'web-app': { label: 'Web app', runtime: 'React + Vite', modules: ['responsive UI', 'routing', 'state model', 'access boundaries'], artifacts: ['source manifest', 'build plan', 'test checklist'] },
  game: { label: 'Game', runtime: 'HTML5 canvas or React', modules: ['game loop', 'input controls', 'scoring/progression', 'asset placeholders'], artifacts: ['source manifest', 'game design plan', 'test checklist'] },
  agent: { label: 'AI agent', runtime: 'web interface + server boundary', modules: ['task contract', 'tool allowlist', 'session state', 'human approval points'], artifacts: ['agent plan', 'source manifest', 'tool policy'] },
  tool: { label: 'Internal tool', runtime: 'React + Vite', modules: ['role-based workflows', 'form/data state', 'audit events', 'exports'], artifacts: ['source manifest', 'workflow map', 'test checklist'] },
  software: { label: 'Software product', runtime: 'React + Vite', modules: ['product flows', 'data model', 'settings', 'release boundaries'], artifacts: ['source manifest', 'architecture plan', 'test checklist'] }
};

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const type = String(req.query.type || 'web-app');
  const blueprint = BLUEPRINTS[type];
  if (!blueprint) return res.status(400).json({ error: 'Unsupported build type.', supportedTypes: Object.keys(BLUEPRINTS) });
  return res.status(200).json({ type, blueprint, supportedTypes: Object.entries(BLUEPRINTS).map(([id, value]) => ({ id, label: value.label })) });
}

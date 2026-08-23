const sidebars = {
  tutorialSidebar: [
    { type: 'category', label: 'Getting Started', collapsed: false, items: ['intro', 'quickstart', 'installation', 'configuration'] },
    { type: 'category', label: 'Core Concepts', collapsed: false, items: ['concepts/architecture', 'concepts/agents', 'concepts/projects', 'concepts/tasks'] },
    { type: 'category', label: 'API Reference', collapsed: true, items: ['api/overview', 'api/authentication', { type: 'category', label: 'Agents', items: ['api/agents/list', 'api/agents/create', 'api/agents/get', 'api/agents/update', 'api/agents/delete'] }, { type: 'category', label: 'Projects', items: ['api/projects/list', 'api/projects/create', 'api/projects/get', 'api/projects/update', 'api/projects/delete'] }, { type: 'category', label: 'Tasks', items: ['api/tasks/list', 'api/tasks/create', 'api/tasks/get', 'api/tasks/update', 'api/tasks/delete'] }, 'api/errors', 'api/rate-limiting'] },
    { type: 'category', label: 'Guides', collapsed: true, items: ['guides/architecture', 'guides/deployment', 'guides/monitoring', 'guides/security', 'guides/performance'] },
    { type: 'category', label: 'Components', collapsed: true, items: ['components/button', 'components/input', 'components/card', 'components/modal', 'components/table'] },
    { type: 'category', label: 'Contributing', collapsed: true, items: ['contributing/overview', 'contributing/setup', 'contributing/pull-requests', 'contributing/code-style'] },
  ],
};

module.exports = sidebars;

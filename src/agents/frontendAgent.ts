import { Agent, AgentContext, AgentResult } from './types';

export const FrontendAgent: Agent = {
  role: 'frontend',
  name: 'Frontend Agent',
  description: 'Designs React page structure, component hierarchy, and UX flows.',
  async run(context: AgentContext): Promise<AgentResult> {
    const summary = 'Mapped the main user journeys to React pages and components.';
    const details = {
      framework: 'React + TypeScript + Tailwind',
      pages: ['LandingPage', 'DashboardPage', 'SettingsPage'],
      components: ['Navbar', 'Sidebar', 'Card', 'Form', 'Table'],
      routes: ['/', '/dashboard', '/settings'],
      state: 'React Query for server state, local state via hooks',
    };
    return { taskId: 'frontend-task', role: 'frontend', summary, details };
  },
};

export default FrontendAgent;

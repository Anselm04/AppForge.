import { Agent, AgentContext, AgentResult } from './types';

export const TestingAgent: Agent = {
  role: 'testing',
  name: 'Testing Agent',
  description: 'Defines testing strategy and suggests Vitest test skeletons.',
  async run(context: AgentContext): Promise<AgentResult> {
    const summary = 'Defined testing strategy across unit, integration, and E2E layers.';
    const details = {
      framework: 'Vitest + Testing Library',
      unitTests: ['Component rendering', 'services logic', 'utility functions'],
      integrationTests: ['API routes with mocked DB', 'auth flows'],
      e2e: ['Happy-path user journeys via Playwright or Cypress (future)'],
      coverageTargets: { lines: 80, branches: 80 },
    };
    return { taskId: 'testing-task', role: 'testing', summary, details };
  },
};

export default TestingAgent;

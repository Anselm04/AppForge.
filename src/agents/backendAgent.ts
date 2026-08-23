import { Agent, AgentContext, AgentResult } from './types';

export const BackendAgent: Agent = {
  role: 'backend',
  name: 'Backend Agent',
  description: 'Designs the API surface, services, and backend flows.',
  async run(context: AgentContext): Promise<AgentResult> {
    const summary = 'Outlined backend API endpoints, services, and data flows.';
    const details = {
      framework: 'Express + tRPC',
      endpoints: ['/api/auth/login', '/api/auth/register', '/api/entities', '/api/entities/:id'],
      services: ['AuthService', 'EntityService'],
      patterns: ['Controller + service separation', 'request validation via Zod', 'error handling with middleware'],
    };
    return { taskId: 'backend-task', role: 'backend', summary, details };
  },
};

export default BackendAgent;

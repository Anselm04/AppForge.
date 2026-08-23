import { Agent, AgentContext, AgentResult } from './types';

export const ArchitectAgent: Agent = {
  role: 'architect',
  name: 'Architect Agent',
  description: 'Understands the idea and produces a high-level system architecture.',
  async run(context: AgentContext): Promise<AgentResult> {
    const summary = 'Designed high-level architecture for the requested application.';
    const details = {
      frontend: {
        framework: 'React + TypeScript',
        keyPages: ['Landing', 'Dashboard', 'Settings'],
      },
      backend: {
        framework: 'Express + tRPC',
        layers: ['API layer', 'service layer', 'integration layer'],
      },
      database: {
        technology: 'PostgreSQL + Drizzle ORM',
        approach: 'Normalized schema with clear relationships',
      },
      infrastructure: {
        deployment: 'Vercel (frontend) + Docker (backend)',
        monitoring: 'Prometheus + Grafana',
        backups: 'Automated pg_dump + cloud storage',
      },
    };
    return { taskId: 'architect-task', role: 'architect', summary, details };
  },
};

export default ArchitectAgent;

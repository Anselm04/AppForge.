import { Agent, AgentContext, AgentResult } from './types';

export const DevOpsAgent: Agent = {
  role: 'devops',
  name: 'DevOps Agent',
  description: 'Defines CI/CD, Docker, monitoring, and backup strategies.',
  async run(context: AgentContext): Promise<AgentResult> {
    const summary = 'Outlined deployment, CI/CD, monitoring, and backup setup.';
    const details = {
      ciCd: ['GitHub Actions for tests and build', 'Vercel deployment for frontend', 'Docker build for backend'],
      docker: ['Multi-stage builds', 'production-ready image with healthchecks'],
      monitoring: ['Prometheus metrics', 'Grafana dashboards'],
      backups: ['Daily pg_dump backups', 'Cloud storage (S3/R2)', 'Retention policy (daily/weekly/monthly)'],
    };
    return { taskId: 'devops-task', role: 'devops', summary, details };
  },
};

export default DevOpsAgent;

import { Agent, AgentContext, AgentResult } from './types';

export const SecurityAgent: Agent = {
  role: 'security',
  name: 'Security Agent',
  description: 'Reviews security posture: auth, validation, rate limiting, headers.',
  async run(context: AgentContext): Promise<AgentResult> {
    const summary = 'Evaluated authentication, validation, rate limiting, and headers.';
    const details = {
      auth: ['JWT-based auth', 'secure password hashing (bcrypt)', 'refresh tokens if needed'],
      validation: ['Zod-based input validation on API boundaries'],
      rateLimiting: ['Redis-backed rate limiting middleware'],
      headers: ['Helmet.js security headers', 'CSP, HSTS, X-Frame-Options, Referrer-Policy'],
      recommendations: ['Add secret scanning in CI', 'Enforce HTTPS everywhere'],
    };
    return { taskId: 'security-task', role: 'security', summary, details };
  },
};

export default SecurityAgent;

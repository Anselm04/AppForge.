import { AgentContext, AgentResult, BuildPlan } from '../agents/types.js';
import { ArchitectAgent } from '../agents/architectAgent.js';
import { BackendAgent } from '../agents/backendAgent.js';
import { FrontendAgent } from '../agents/frontendAgent.js';
import { DatabaseAgent } from '../agents/databaseAgent.js';
import { DevOpsAgent } from '../agents/devopsAgent.js';
import { SecurityAgent } from '../agents/securityAgent.js';
import { TestingAgent } from '../agents/testingAgent.js';

const agents = [
  ArchitectAgent,
  BackendAgent,
  FrontendAgent,
  DatabaseAgent,
  DevOpsAgent,
  SecurityAgent,
  TestingAgent,
];

export class AgentOrchestrator {
  async runBuild(prompt: string): Promise<BuildPlan> {
    const context: AgentContext = { prompt, decisions: {} };
    const results: AgentResult[] = [];

    for (const agent of agents) {
      const result = await agent.run(context);
      results.push(result);

      if (agent.role === 'architect') {
        context.architecture = result.details;
      }

      context.decisions![agent.role] = result.details;
    }

    const plan: BuildPlan = {
      id: `build_${Date.now()}`,
      prompt,
      createdAt: new Date(),
      requirements: context.decisions ?? {},
      architecture: context.architecture ?? {},
      agents: results,
    };

    return plan;
  }
}

export default AgentOrchestrator;

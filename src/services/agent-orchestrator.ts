import { AgentContext, AgentResult, BuildPlan } from '../agents/types';
import {
  ArchitectAgent,
  BackendAgent,
  FrontendAgent,
  DatabaseAgent,
  DevOpsAgent,
  SecurityAgent,
  TestingAgent,
} from '../agents/llmAgent';

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
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 8) {
      throw new Error('Prompt must be at least 8 characters');\n    }

    const context: AgentContext = { prompt: prompt.trim(), decisions: {} };
    const results: AgentResult[] = [];

    for (const agent of agents) {
      const result = await agent.run(context);
      results.push(result);

      if (agent.role === 'architect') {
        context.architecture = result.details;
      }

      context.decisions![agent.role] = result.details;
    }

    return {
      id: `build_${Date.now()}`,
      prompt: context.prompt,
      createdAt: new Date(),
      requirements: context.requirements ?? {},
      architecture: context.architecture ?? {},
      agents: results,
    };
  }
}

export default AgentOrchestrator;

import { invokeLLM } from '../_core/llm';
import type { Agent, AgentContext, AgentResult, AgentRole } from './types';

async function runLlmAgent(
  role: AgentRole,
  name: string,
  system: string,
  context: AgentContext
): Promise<AgentResult> {
  const prior = JSON.stringify(
    {
      architecture: context.architecture ?? null,
      decisions: context.decisions ?? null,
    },
    null,
    2
  ).slice(0, 6000);

  const result = await invokeLLM({
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `User app request:\n${context.prompt}\n\nPrior agent context (JSON):\n${prior}\n\nRespond with a single JSON object only.`,
      },
    ],
    maxTokens: 2500,
  });

  const raw = result.choices[0]?.message?.content;
  const text =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? raw
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('')
        : '';

  let details: Record<string, unknown> = { raw: text };
  let summary = `${name} completed.`;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      details = JSON.parse(match[0]);
      if (typeof details.summary === 'string') summary = details.summary;
    }
  } catch {
    // keep raw text in details
  }

  return {
    taskId: `${role}-${Date.now()}`,
    role,
    summary,
    details,
  };
}

function makeAgent(
  role: AgentRole,
  name: string,
  description: string,
  system: string
): Agent {
  return {
    role,
    name,
    description,
    run: (ctx) => runLlmAgent(role, name, system, ctx),
  };
}

export const ArchitectAgent = makeAgent(
  'architect',
  'Architect Agent',
  'Produces architecture from the user prompt.',
  `You are the Architect agent for AppForge. Given a user app idea, return JSON:
{"summary":"...","frontend":{"framework":"...","pages":[]},"backend":{"framework":"...","endpoints":[]},"database":{"technology":"...","tables":[]},"infrastructure":{"deployment":"..."}}`
);

export const BackendAgent = makeAgent(
  'backend',
  'Backend Agent',
  'Designs API and services from the architecture.',
  `You are the Backend agent. Return JSON: {"summary":"...","endpoints":[{"method":"GET","path":"/api/...","purpose":"..."}],"services":[],"auth":"..."}`
);

export const FrontendAgent = makeAgent(
  'frontend',
  'Frontend Agent',
  'Designs UI structure from the architecture.',
  `You are the Frontend agent. Return JSON: {"summary":"...","pages":[],"components":[],"routing":"..."}`
);

export const DatabaseAgent = makeAgent(
  'database',
  'Database Agent',
  'Designs schema from requirements.',
  `You are the Database agent. Return JSON: {"summary":"...","tables":[{"name":"...","columns":["..."]}],"relationships":[]}`
);

export const DevOpsAgent = makeAgent(
  'devops',
  'DevOps Agent',
  'Proposes deployment and CI approach.',
  `You are the DevOps agent. Return JSON: {"summary":"...","deployment":"...","ci":"...","envVars":[]}`
);

export const SecurityAgent = makeAgent(
  'security',
  'Security Agent',
  'Reviews security concerns for the plan.',
  `You are the Security agent. Return JSON: {"summary":"...","risks":[],"mitigations":[],"authRecommendations":"..."}`
);

export const TestingAgent = makeAgent(
  'testing',
  'Testing Agent',
  'Proposes test strategy.',
  `You are the Testing agent. Return JSON: {"summary":"...","unit":[],"integration":[],"e2e":[]}`
);

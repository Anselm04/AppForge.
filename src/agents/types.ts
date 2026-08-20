export type AgentRole =
  | 'architect'
  | 'backend'
  | 'frontend'
  | 'database'
  | 'devops'
  | 'security'
  | 'testing';

export interface AgentContext {
  prompt: string;
  requirements?: Record<string, unknown>;
  architecture?: Record<string, unknown>;
  decisions?: Record<string, unknown>;
}

export interface AgentResult {
  taskId: string;
  role: AgentRole;
  summary: string;
  details: Record<string, unknown>;
}

export interface Agent {
  role: AgentRole;
  name: string;
  description: string;
  run(context: AgentContext): Promise<AgentResult>;
}

export interface BuildPlan {
  id: string;
  prompt: string;
  createdAt: Date;
  requirements: Record<string, unknown>;
  architecture: Record<string, unknown>;
  agents: AgentResult[];
}

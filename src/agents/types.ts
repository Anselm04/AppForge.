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
  requirements?: any;
  architecture?: any;
  decisions?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  role: AgentRole;
  description: string;
  createdAt: Date;
}

export interface AgentResult {
  taskId: string;
  role: AgentRole;
  summary: string;
  details: Record<string, any>;
  warnings?: string[];
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
  requirements: any;
  architecture: any;
  agents: AgentResult[];
}

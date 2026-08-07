export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProjectStatus = 'draft' | 'planning' | 'completed' | 'failed' | 'archived';
export type BuildStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
export type AgentRole = 'architect' | 'backend' | 'frontend' | 'database' | 'devops' | 'security' | 'testing';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  idea: string;
  status: ProjectStatus;
  current_spec: Json | null;
  created_at: string;
  updated_at: string;
}

export interface BuildRun {
  id: string;
  project_id: string;
  requested_by: string;
  status: BuildStatus;
  prompt: string;
  provider: string | null;
  model: string | null;
  result: Json | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  build_run_id: string;
  role: AgentRole;
  status: AgentStatus;
  output: Json | null;
  error_message: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> };
      projects: { Row: Project; Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Project, 'id' | 'owner_id' | 'created_at'>> };
      build_runs: { Row: BuildRun; Insert: Omit<BuildRun, 'id' | 'created_at'>; Update: Partial<Omit<BuildRun, 'id' | 'project_id' | 'requested_by' | 'created_at'>> };
      agent_runs: { Row: AgentRun; Insert: Omit<AgentRun, 'id' | 'created_at'>; Update: Partial<Omit<AgentRun, 'id' | 'build_run_id' | 'created_at'>> };
    };
  };
}

export type CapabilityProviderState =
  | "healthy"
  | "restricted"
  | "quarantined"
  | "disabled";

export type CapabilityRisk = "low" | "medium" | "high" | "critical";

export interface CapabilityExecutionContext {
  customerId: string;
  projectId: string;
  buildJobId: string;
  requestingAgent: string;
  taskId?: string;
  purpose: string;
  requestedCapability: string;
  requestedScopes: string[];
  correlationId: string;
  target?: string;
  targetCustomerId?: string;
  targetProjectId?: string;
}

export interface CapabilityPolicyDecision {
  allowed: boolean;
  risk: CapabilityRisk;
  reason: string;
  grantedScopes: string[];
  deniedScopes: string[];
}

export interface CapabilityDiscoveryRequest {
  context: CapabilityExecutionContext;
  query: string;
}

export interface CapabilityDiscoveryResult {
  providerId: string;
  capabilities: Array<{
    id: string;
    description?: string;
    scopes?: string[];
  }>;
}

export interface CapabilityExecutionRequest {
  context: CapabilityExecutionContext;
  capabilityId: string;
  arguments: Record<string, unknown>;
}

export interface CapabilityExecutionResult {
  providerId: string;
  capabilityId: string;
  ok: boolean;
  output?: unknown;
  errorCode?: string;
}

export interface CapabilityProvider {
  readonly id: string;
  isConfigured(): boolean;
  discover(request: CapabilityDiscoveryRequest): Promise<CapabilityDiscoveryResult>;
  execute(request: CapabilityExecutionRequest): Promise<CapabilityExecutionResult>;
}

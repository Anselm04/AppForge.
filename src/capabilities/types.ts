export type CapabilityProviderState =
  | "healthy"
  | "restricted"
  | "quarantined"
  | "disabled";

export type CapabilityRiskLevel = "low" | "medium" | "high" | "critical";

export interface CapabilityExecutionContext {
  customerId: number;
  projectId: number;
  buildJobId: string;
  requestingAgent: string;
  taskId?: string;
  purpose: string;
  requestedCapability: string;
  requestedScopes: string[];
  correlationId: string;
}

export interface CapabilityTarget {
  customerId: number;
  projectId: number;
}

export interface CapabilityPolicyDecision {
  allowed: boolean;
  riskLevel: CapabilityRiskLevel;
  reason: string;
  grantedScopes: string[];
  deniedScopes: string[];
}

export interface CapabilityDiscoveryRequest {
  context: CapabilityExecutionContext;
  useCase: string;
}

export interface CapabilityExecutionRequest {
  context: CapabilityExecutionContext;
  toolId: string;
  arguments: Record<string, unknown>;
}

export interface CapabilityProviderResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface CapabilityProvider {
  readonly id: string;
  isConfigured(): boolean;
  discover(
    request: CapabilityDiscoveryRequest,
  ): Promise<CapabilityProviderResult>;
  execute(
    request: CapabilityExecutionRequest,
  ): Promise<CapabilityProviderResult>;
}

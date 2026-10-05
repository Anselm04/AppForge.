import { getProjectById } from "../db.js";
import { resolveCapabilityConfig } from "./config.js";
import { evaluateCapabilityPolicy } from "./policy.js";
import { CapabilityProviderRegistry } from "./providerRegistry.js";
import {
  getCapabilityProviderState,
  recordCapabilityAudit,
  type ProviderStateRecord,
} from "./store.js";
import type {
  CapabilityDiscoveryRequest,
  CapabilityExecutionRequest,
  CapabilityPolicyDecision,
  CapabilityProvider,
  CapabilityProviderResult,
} from "./types.js";

export type CapabilityWatchdogSignal = {
  provider: string;
  context: CapabilityDiscoveryRequest["context"];
  outcome:
    | "success"
    | "provider_failure"
    | "policy_denial"
    | "security_violation";
  reason?: string;
  evidence?: unknown;
};

type BrokerDependencies = {
  enabled?: boolean;
  providers?: CapabilityProvider[];
  resolveProjectOwner?: (projectId: number) => Promise<number | null>;
  readProviderState?: (provider: string) => Promise<ProviderStateRecord>;
  recordAudit?: typeof recordCapabilityAudit;
  signalWatchdog?: (signal: CapabilityWatchdogSignal) => Promise<void>;
};

const unavailable = (message: string): CapabilityProviderResult => ({
  ok: false,
  error: message,
});

const unavailablePolicy = (reason: string): CapabilityPolicyDecision => ({
  allowed: false,
  riskLevel: "high",
  reason,
  grantedScopes: [],
  deniedScopes: [],
});

export class CapabilityBroker {
  private readonly enabled: boolean;
  private readonly registry: CapabilityProviderRegistry;
  private readonly resolveProjectOwner: (
    projectId: number,
  ) => Promise<number | null>;
  private readonly readProviderState: (
    provider: string,
  ) => Promise<ProviderStateRecord>;
  private readonly recordAudit: typeof recordCapabilityAudit;
  private readonly signalWatchdog: (
    signal: CapabilityWatchdogSignal,
  ) => Promise<void>;

  constructor(deps: BrokerDependencies = {}) {
    this.enabled = deps.enabled ?? resolveCapabilityConfig().brokerEnabled;
    this.registry = new CapabilityProviderRegistry(deps.providers ?? []);
    this.resolveProjectOwner =
      deps.resolveProjectOwner ??
      (async (projectId) => (await getProjectById(projectId))?.userId ?? null);
    this.readProviderState = deps.readProviderState ?? getCapabilityProviderState;
    this.recordAudit = deps.recordAudit ?? recordCapabilityAudit;
    this.signalWatchdog =
      deps.signalWatchdog ??
      (async (signal) => {
        const { processCapabilityWatchdogSignal } = await import("./watchdog.js");
        await processCapabilityWatchdogSignal(signal);
      });
  }

  private provider(providerId: string): CapabilityProvider | null {
    return this.registry.get(providerId);
  }

  private async authorize(
    providerId: string,
    context: CapabilityDiscoveryRequest["context"],
    operation: "discover" | "execute",
  ): Promise<{
    provider: CapabilityProvider | null;
    state: ProviderStateRecord;
    policy: CapabilityPolicyDecision;
    allowed: boolean;
    reason: string;
    securityViolation: boolean;
  }> {
    const provider = this.provider(providerId);
    const state = await this.readProviderState(providerId);

    if (!this.enabled) {
      return {
        provider,
        state,
        policy: unavailablePolicy("Capability broker is disabled"),
        allowed: false,
        reason: "Capability broker is disabled",
        securityViolation: false,
      };
    }
    if (!provider || !provider.isConfigured()) {
      return {
        provider,
        state,
        policy: unavailablePolicy("Capability provider is unavailable"),
        allowed: false,
        reason: "Capability provider is unavailable",
        securityViolation: false,
      };
    }
    if (state.state === "disabled" || state.state === "quarantined") {
      return {
        provider,
        state,
        policy: unavailablePolicy(`Capability provider is ${state.state}`),
        allowed: false,
        reason: `Capability provider is ${state.state}`,
        securityViolation: false,
      };
    }
    if (state.state === "restricted" && operation === "execute") {
      return {
        provider,
        state,
        policy: unavailablePolicy("Restricted provider cannot execute tools"),
        allowed: false,
        reason: "Restricted provider cannot execute tools",
        securityViolation: false,
      };
    }

    const owner = await this.resolveProjectOwner(context.projectId);
    if (owner !== context.customerId) {
      return {
        provider,
        state,
        policy: unavailablePolicy(
          "Cross-customer or cross-project capability context does not match persisted project ownership",
        ),
        allowed: false,
        reason:
          "Cross-customer or cross-project capability context does not match persisted project ownership",
        securityViolation: true,
      };
    }

    const policy = evaluateCapabilityPolicy({
      context,
      target: { customerId: owner, projectId: context.projectId },
    });
    return {
      provider,
      state,
      policy,
      allowed: policy.allowed,
      reason: policy.reason,
      securityViolation: false,
    };
  }

  async discover(
    providerId: string,
    request: CapabilityDiscoveryRequest,
  ): Promise<CapabilityProviderResult> {
    const started = Date.now();
    const auth = await this.authorize(providerId, request.context, "discover");
    if (!auth.allowed || !auth.provider) {
      await this.recordAudit({
        context: request.context,
        provider: providerId,
        policy: auth.policy,
        providerState: auth.state.state,
        resultStatus: "blocked",
        latencyMs: Date.now() - started,
        metadata: { reason: auth.reason, operation: "discover" },
      });
      await this.signalWatchdog({
        provider: providerId,
        context: request.context,
        outcome: auth.securityViolation
          ? "security_violation"
          : "policy_denial",
        reason: auth.reason,
      });
      return unavailable(auth.reason);
    }

    const result = await auth.provider.discover(request);
    await this.recordAudit({
      context: request.context,
      provider: providerId,
      policy: auth.policy,
      providerState: auth.state.state,
      resultStatus: result.ok ? "success" : "provider_failure",
      latencyMs: Date.now() - started,
      metadata: result.ok ? { operation: "discover" } : { error: result.error },
    });
    await this.signalWatchdog({
      provider: providerId,
      context: request.context,
      outcome: result.ok ? "success" : "provider_failure",
      reason: result.error,
    });
    return result;
  }

  async execute(
    providerId: string,
    request: CapabilityExecutionRequest,
  ): Promise<CapabilityProviderResult> {
    const started = Date.now();
    const auth = await this.authorize(providerId, request.context, "execute");
    if (!auth.allowed || !auth.provider) {
      await this.recordAudit({
        context: request.context,
        provider: providerId,
        policy: auth.policy,
        providerState: auth.state.state,
        resultStatus: "blocked",
        latencyMs: Date.now() - started,
        toolId: request.toolId,
        metadata: { reason: auth.reason, operation: "execute" },
      });
      await this.signalWatchdog({
        provider: providerId,
        context: request.context,
        outcome: auth.securityViolation
          ? "security_violation"
          : "policy_denial",
        reason: auth.reason,
      });
      return unavailable(auth.reason);
    }

    const result = await auth.provider.execute(request);
    await this.recordAudit({
      context: request.context,
      provider: providerId,
      policy: auth.policy,
      providerState: auth.state.state,
      resultStatus: result.ok ? "success" : "provider_failure",
      latencyMs: Date.now() - started,
      toolId: request.toolId,
      metadata: result.ok ? { operation: "execute" } : { error: result.error },
    });
    await this.signalWatchdog({
      provider: providerId,
      context: request.context,
      outcome: result.ok ? "success" : "provider_failure",
      reason: result.error,
    });
    return result;
  }
}

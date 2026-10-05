import { Composio } from "@composio/core";
import { resolveCapabilityConfig } from "../config.js";
import { sanitizeCapabilityMetadata } from "../redaction.js";
import type {
  CapabilityDiscoveryRequest,
  CapabilityExecutionRequest,
  CapabilityProvider,
  CapabilityProviderResult,
} from "../types.js";

export interface ComposioSessionLike {
  execute(toolSlug: string, args: Record<string, unknown>): Promise<unknown>;
}

type SessionFactory = (
  sessionId: string,
  apiKey: string,
) => Promise<ComposioSessionLike>;

export function buildComposioSessionId(
  customerId: number,
  projectId: number,
): string {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new Error("Composio requires a valid AppForge customer ID");
  }
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Composio requires a valid AppForge project ID");
  }
  return `appforge:customer:${customerId}:project:${projectId}`;
}

const defaultSessionFactory: SessionFactory = async (sessionId, apiKey) => {
  const client = new Composio({ apiKey });
  return client.create(sessionId);
};

export class ComposioProvider implements CapabilityProvider {
  readonly id = "composio";
  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly sessionFactory: SessionFactory;

  constructor(options?: {
    enabled?: boolean;
    apiKey?: string;
    sessionFactory?: SessionFactory;
  }) {
    const config = resolveCapabilityConfig();
    this.enabled = options?.enabled ?? config.composioEnabled;
    this.apiKey = options?.apiKey ?? config.composioApiKey;
    this.sessionFactory = options?.sessionFactory ?? defaultSessionFactory;
  }

  isConfigured(): boolean {
    return this.enabled && this.apiKey.trim().length > 0;
  }

  private async session(
    customerId: number,
    projectId: number,
  ): Promise<ComposioSessionLike> {
    if (!this.isConfigured()) {
      throw new Error("Composio provider is disabled or not configured");
    }
    return this.sessionFactory(
      buildComposioSessionId(customerId, projectId),
      this.apiKey,
    );
  }

  async discover(
    request: CapabilityDiscoveryRequest,
  ): Promise<CapabilityProviderResult> {
    try {
      const useCase = request.useCase.trim();
      if (!useCase) return { ok: false, error: "Capability discovery requires a use case" };
      const session = await this.session(
        request.context.customerId,
        request.context.projectId,
      );
      const data = await session.execute("COMPOSIO_SEARCH_TOOLS", {
        queries: [{ use_case: useCase.slice(0, 500) }],
        session: { generate_id: true },
      });
      return { ok: true, data: sanitizeCapabilityMetadata(data) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 500) : "Composio discovery failed",
      };
    }
  }

  async execute(
    request: CapabilityExecutionRequest,
  ): Promise<CapabilityProviderResult> {
    try {
      const toolId = request.toolId.trim();
      if (!toolId) return { ok: false, error: "Capability execution requires a tool ID" };
      const session = await this.session(
        request.context.customerId,
        request.context.projectId,
      );
      const data = await session.execute(toolId, request.arguments);
      return { ok: true, data: sanitizeCapabilityMetadata(data) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 500) : "Composio execution failed",
      };
    }
  }
}

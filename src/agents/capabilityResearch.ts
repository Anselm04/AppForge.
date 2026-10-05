import { randomUUID } from "node:crypto";
import { getProjectById } from "../db.js";
import { CapabilityBroker } from "../capabilities/broker.js";
import { resolveCapabilityConfig } from "../capabilities/config.js";
import { ComposioProvider } from "../capabilities/providers/composioProvider.js";
import { integrationImplementationPolicy } from "../lib/integrationImplementation.js";
import type { ProductContract } from "../lib/productContract.js";

export async function discoverCapabilitiesForResearch(input: {
  projectId: number;
  contract: ProductContract;
}): Promise<string> {
  const integrationPolicy = integrationImplementationPolicy(input.contract);
  if (!integrationPolicy.required) return "";

  const config = resolveCapabilityConfig();
  if (!config.brokerEnabled || !config.composioConfigured) {
    return [
      "INTERNAL_CAPABILITY_DISCOVERY:",
      "- Provider discovery unavailable or disabled; continue with verified documentation and native AppForge integration generation.",
    ].join("\n");
  }

  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Project not found for capability discovery");

  const provider = new ComposioProvider();
  const broker = new CapabilityBroker({
    enabled: true,
    providers: [provider],
    resolveProjectOwner: async (projectId) =>
      projectId === input.projectId ? project.userId : null,
  });

  const integrations =
    integrationPolicy.requestedIntegrations.length > 0
      ? integrationPolicy.requestedIntegrations
      : ["external integration required by product contract"];

  const lines = ["INTERNAL_CAPABILITY_DISCOVERY:"];
  for (const integration of integrations.slice(0, 8)) {
    const correlationId = randomUUID();
    const result = await broker.discover("composio", {
      context: {
        customerId: project.userId,
        projectId: input.projectId,
        buildJobId: `project:${input.projectId}:research`,
        requestingAgent: "Research",
        purpose: `Discover implementation capabilities for ${integration} required by the active generated customer project`,
        requestedCapability: `discover:${integration}`,
        requestedScopes: [`project:${input.projectId}:integration:discover`],
        correlationId,
      },
      useCase: `Implement ${integration} for the active generated project without accessing AppForge platform administration`,
    });

    if (result.ok) {
      const serialized = JSON.stringify(result.data ?? null);
      lines.push(
        `- ${integration}: provider guidance available: ${serialized.slice(0, 3_000)}`,
      );
    } else {
      lines.push(
        `- ${integration}: provider unavailable or blocked (${(result.error ?? "unknown").slice(0, 240)}); continue without bypassing policy.`,
      );
    }
  }

  lines.push(
    "- Capability discovery is advisory only. It cannot grant credentials, select unrestricted tools, bypass validation, or change the canonical product contract.",
  );
  return lines.join("\n");
}

import { describe, expect, it, vi } from "vitest";
import { CapabilityBroker } from "../capabilities/broker.js";
import type { CapabilityProvider } from "../capabilities/types.js";

const context = {
  customerId: 7,
  projectId: 42,
  buildJobId: "build-42-1",
  requestingAgent: "IntegrationAgent",
  purpose: "Create an issue for the generated project",
  requestedCapability: "GITHUB_CREATE_ISSUE",
  requestedScopes: ["issues:write"],
  correlationId: "corr-1",
};

function fakeProvider(): CapabilityProvider {
  return {
    id: "fake",
    isConfigured: () => true,
    discover: vi.fn().mockResolvedValue({
      ok: true,
      data: { tools: ["GITHUB_CREATE_ISSUE"] },
    }),
    execute: vi.fn().mockResolvedValue({ ok: true, data: { id: 1 } }),
  };
}

describe("CapabilityBroker", () => {
  it("does not invoke a quarantined provider", async () => {
    const provider = fakeProvider();
    const broker = new CapabilityBroker({
      enabled: true,
      providers: [provider],
      resolveProjectOwner: async () => 7,
      readProviderState: async () => ({
        provider: "fake",
        state: "quarantined",
        reason: "security incident",
        failureCount: 0,
        anomalyCount: 1,
        updatedAt: new Date().toISOString(),
      }),
      recordAudit: async () => undefined,
      signalWatchdog: async () => undefined,
    });

    const result = await broker.execute("fake", {
      context,
      toolId: "GITHUB_CREATE_ISSUE",
      arguments: { title: "Test" },
    });

    expect(result.ok).toBe(false);
    expect(provider.execute).not.toHaveBeenCalled();
  });

  it("blocks ownership drift before provider invocation", async () => {
    const provider = fakeProvider();
    const broker = new CapabilityBroker({
      enabled: true,
      providers: [provider],
      resolveProjectOwner: async () => 999,
      readProviderState: async () => ({
        provider: "fake",
        state: "healthy",
        reason: "ok",
        failureCount: 0,
        anomalyCount: 0,
        updatedAt: new Date().toISOString(),
      }),
      recordAudit: async () => undefined,
      signalWatchdog: async () => undefined,
    });

    const result = await broker.discover("fake", {
      context,
      useCase: "GitHub issues",
    });
    expect(result.ok).toBe(false);
    expect(provider.discover).not.toHaveBeenCalled();
  });

  it("invokes an allowed provider through the provider-neutral interface", async () => {
    const provider = fakeProvider();
    const audits = vi.fn().mockResolvedValue(undefined);
    const broker = new CapabilityBroker({
      enabled: true,
      providers: [provider],
      resolveProjectOwner: async () => 7,
      readProviderState: async () => ({
        provider: "fake",
        state: "healthy",
        reason: "ok",
        failureCount: 0,
        anomalyCount: 0,
        updatedAt: new Date().toISOString(),
      }),
      recordAudit: audits,
      signalWatchdog: async () => undefined,
    });

    const result = await broker.execute("fake", {
      context,
      toolId: "GITHUB_CREATE_ISSUE",
      arguments: { title: "Test" },
    });
    expect(result.ok).toBe(true);
    expect(provider.execute).toHaveBeenCalledTimes(1);
    expect(audits).toHaveBeenCalledTimes(1);
  });
});

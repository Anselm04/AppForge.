import { describe, expect, it, vi } from "vitest";
import {
  buildComposioSessionId,
  ComposioProvider,
  type ComposioSessionLike,
} from "../capabilities/providers/composioProvider.js";

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

describe("Composio provider", () => {
  it("uses project-scoped session identities", () => {
    expect(buildComposioSessionId(7, 42)).toBe(
      "appforge:customer:7:project:42",
    );
  });

  it("performs internal discovery through the tool router", async () => {
    const execute = vi.fn().mockResolvedValue({
      successful: true,
      data: { tools: [] },
    });
    const session: ComposioSessionLike = { execute };
    const provider = new ComposioProvider({
      enabled: true,
      apiKey: "test-key",
      sessionFactory: async () => session,
    });

    const result = await provider.discover({
      context,
      useCase: "GitHub issues",
    });
    expect(execute).toHaveBeenCalledWith("COMPOSIO_SEARCH_TOOLS", {
      queries: [{ use_case: "GitHub issues" }],
      session: { generate_id: true },
    });
    expect(result.ok).toBe(true);
  });

  it("executes only the broker-provided tool id and arguments", async () => {
    const execute = vi.fn().mockResolvedValue({
      successful: true,
      data: { id: 1 },
    });
    const provider = new ComposioProvider({
      enabled: true,
      apiKey: "test-key",
      sessionFactory: async () => ({ execute }),
    });

    await provider.execute({
      context,
      toolId: "GITHUB_CREATE_ISSUE",
      arguments: { title: "Test" },
    });
    expect(execute).toHaveBeenCalledWith("GITHUB_CREATE_ISSUE", {
      title: "Test",
    });
  });

  it("never returns provider exception text that could contain credentials", async () => {
    const provider = new ComposioProvider({
      enabled: true,
      apiKey: "test-key",
      sessionFactory: async () => ({
        execute: vi.fn().mockRejectedValue(new Error("bad key test-key")),
      }),
    });

    const discovery = await provider.discover({
      context,
      useCase: "GitHub issues",
    });
    const execution = await provider.execute({
      context,
      toolId: "GITHUB_CREATE_ISSUE",
      arguments: { title: "Test" },
    });

    expect(discovery.error).toBe("Composio discovery failed");
    expect(execution.error).toBe("Composio execution failed");
    expect(discovery.error).not.toContain("test-key");
    expect(execution.error).not.toContain("test-key");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  lease: undefined as
    | { projectId: number; userId: number; executionId: number }
    | undefined,
  write: vi.fn(async () => undefined),
}));
vi.mock("../services/buildExecutionLease.js", () => ({
  currentBuildExecutionLease: () => mock.lease,
}));
vi.mock("../services/build-event-store.js", () => ({
  appendBuildEvent: mock.write,
}));
import { recordProviderUsageForCurrentBuild } from "../services/buildProviderUsage.js";

beforeEach(() => {
  mock.lease = undefined;
  mock.write.mockClear();
});

describe("per-build provider telemetry is evidence, not fabricated billing", () => {
  it("does not attribute non-build activity to another user's project", async () => {
    expect(
      await recordProviderUsageForCurrentBuild({
        provider: "test",
        model: "mock",
        succeeded: true,
      }),
    ).toBe(false);
    expect(mock.write).not.toHaveBeenCalled();
  });

  it("records a running build's observed tokens without personal prompt data", async () => {
    mock.lease = { projectId: 13, userId: 8, executionId: 2 };
    expect(
      await recordProviderUsageForCurrentBuild({
        provider: "test-provider",
        model: "test-model",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        succeeded: true,
      }),
    ).toBe(true);
    expect(mock.write).toHaveBeenCalledWith(
      13,
      "provider_usage",
      expect.objectContaining({
        userId: 8,
        executionId: 2,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsdCents: null,
        costVerified: false,
      }),
    );
  });

  it("records missing usage as unknown rather than zero-cost proof", async () => {
    mock.lease = { projectId: 1, userId: 2, executionId: 3 };
    await recordProviderUsageForCurrentBuild({
      provider: "test",
      model: "unknown-usage",
      totalTokens: -1,
      succeeded: false,
    });
    expect(mock.write).toHaveBeenCalledWith(
      1,
      "provider_usage",
      expect.objectContaining({
        promptTokens: null,
        totalTokens: null,
        costUsdCents: null,
        costVerified: false,
      }),
    );
  });
});

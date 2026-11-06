import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("records failed HTTP provider attempts as unknown costs", () => {
    const code = readFileSync(resolve(process.cwd(), "src/_core/llm.ts"), "utf8");
    const path = code.slice(code.indexOf("const errorText = await response.text();", code.indexOf("export async function invokeLLM(")), code.indexOf("const detail =", code.indexOf("export async function invokeLLM(")));
    expect(path).toContain("recordProviderUsageForCurrentBuild");
    expect(path).toContain("succeeded: false");
    expect(path).not.toContain("costUsdCents: 0");
  });


  it("records cost-unknown evidence for every retryable transport attempt", () => {
    const code = readFileSync(resolve(process.cwd(), "src/_core/llm.ts"), "utf8");
    const transportStart = code.indexOf("const fetchWithBackoff = async (");
    const transportEnd = code.indexOf("function orderProviders(", transportStart);
    const transport = code.slice(transportStart, transportEnd);
    expect(transport).toContain("onRetry?: () => Promise<void>");
    expect(transport).toContain("if (onRetry)");
    const retryCallbacks = transport.match(/await onRetry\(\)/g) ?? [];
    expect(retryCallbacks).toHaveLength(2);
    expect(transport.indexOf("await onRetry()")).toBeLessThan(
      transport.indexOf("after status")
    );
    const invoke = code.slice(code.indexOf("export async function invokeLLM("));
    expect(invoke).toContain("Each HTTP/network retry may incur a charge");
    expect(invoke).toContain("recordProviderUsageForCurrentBuild({");
    expect(invoke).toContain("succeeded: false");
  });

  it("preserves cost evidence when an in-flight provider request is aborted", () => {
    const code = readFileSync(resolve(process.cwd(), "src/_core/llm.ts"), "utf8");
    const invoke = code.slice(code.indexOf("export async function invokeLLM("));
    const abort = invoke.slice(invoke.indexOf("if (\n        signal?.aborted ||"));
    const end = abort.indexOf("const msg = err instanceof Error");
    expect(end).toBeGreaterThan(0);
    const abortedRequest = abort.slice(0, end);
    expect(abortedRequest).toContain("Aborting a request does not prove");
    expect(abortedRequest).toContain("recordProviderUsageForCurrentBuild({");
    expect(abortedRequest).toContain("succeeded: false");
    expect(abortedRequest.indexOf("recordProviderUsageForCurrentBuild({"))
      .toBeLessThan(abortedRequest.indexOf("throw err;"));
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const state = vi.hoisted(() => ({
  lease: undefined as
    | undefined
    | {
        userId: number;
        projectId: number;
        executionId: number;
      },
  current: vi.fn(async () => undefined),
  reserve: vi.fn(async () => "reserved" as "reserved" | "duplicate"),
  release: vi.fn(async () => undefined),
  settle: vi.fn(async () => undefined),
  dispatched: vi.fn(async () => ({
    value: "mock-provider-result",
    verifiedCents: 75,
  })),
}));
vi.mock("../services/buildExecutionLease.js", () => ({
  currentBuildExecutionLease: () => state.lease,
  assertCurrentBuildLease: state.current,
}));
vi.mock("../services/providerSpendLedger.js", () => ({
  reserveProviderSpend: state.reserve,
  releaseProviderSpend: state.release,
  settleProviderSpend: state.settle,
}));
vi.mock("../lib/providerCostEnvelope.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/providerCostEnvelope.js")>();
  return {
    ...actual,
    assertProviderPricesConfirmed: (envelope: CostEnvelope, now?: Date) => {
      actual.maximumProviderEnvelopeCents(envelope, now);
      if (envelope.priceSnapshotSource !== "provider_confirmed") {
        throw new Error("Provider prices remain provisional");
      }
      if (
        envelope.attempts.some(
          (attempt) =>
            attempt.provider !== "mock" || attempt.model !== "mock-1",
        )
      ) {
        throw new Error("Untrusted mocked provider rate");
      }
    },
  };
});
import { runReservedProviderOperation } from "../services/guardedProviderOperation.js";
import type { CostEnvelope } from "../lib/providerCostEnvelope.js";
const now = new Date("2026-11-06T00:00:00Z");
const envelope = (): CostEnvelope => ({
  attempts: [
    {
      provider: "mock",
      model: "mock-1",
      maxInputTokens: 1000000,
      maxOutputTokens: 1000000,
      inputUsdMicrosPerMillionTokens: 1000000,
      outputUsdMicrosPerMillionTokens: 1000000,
      fixedRequestCents: 0,
    },
  ],
  externalRuntimeStorageEgressCents: 0,
  priceSnapshotValidUntil: "2026-11-07T00:00:00Z",
  priceSnapshotSource: "provider_confirmed",
});
const options = () => ({
  operationId: "mock_call_123",
  envelope: envelope(),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  state.lease = { userId: 5, projectId: 11, executionId: 17 };
  state.reserve.mockResolvedValue("reserved");
  state.release.mockResolvedValue(undefined);
  state.dispatched.mockResolvedValue({
    value: "mock-provider-result",
    verifiedCents: 75,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pre-dispatch monetary guard with test-only price fixture", () => {
  it("checks lease, prices and credits before dispatch", () => {
    const wrapper = readFileSync(
      resolve(process.cwd(), "src/services/guardedProviderOperation.ts"),
      "utf8",
    );
    expect(wrapper).not.toContain(
      "assertCustomerComputeLaunchCertified(false)",
    );
    expect(
      wrapper.indexOf("const lease = currentBuildExecutionLease()"),
    ).toBeLessThan(
      wrapper.indexOf("assertProviderPricesConfirmed(options.envelope)"),
    );
    expect(
      wrapper.indexOf("assertProviderPricesConfirmed(options.envelope)"),
    ).toBeLessThan(wrapper.indexOf("await reserveProviderSpend({"));
    expect(wrapper.indexOf("await reserveProviderSpend({")).toBeLessThan(
      wrapper.indexOf("const result = await invoke()"),
    );
  });

  it("reserves verified maximum before attempting a paid call", async () => {
    expect(
      await runReservedProviderOperation(options(), state.dispatched),
    ).toBe("mock-provider-result");
    expect(state.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        projectId: 11,
        executionId: 17,
        maximumCents: 200,
      }),
    );
    expect(state.current).toHaveBeenCalledTimes(2);
    expect(state.dispatched).toHaveBeenCalledTimes(1);
    expect(state.settle).toHaveBeenCalledWith(5, "mock_call_123", 75);
    expect(state.settle.mock.invocationCallOrder[0]).toBeGreaterThan(
      state.dispatched.mock.invocationCallOrder[0],
    );
  });
  it("does not dispatch without a build lease or with stale lease", async () => {
    state.lease = undefined;
    await expect(
      runReservedProviderOperation(options(), state.dispatched),
    ).rejects.toThrow(/lease/);
    expect(state.reserve).not.toHaveBeenCalled();
    state.lease = { userId: 5, projectId: 11, executionId: 17 };
    state.current.mockRejectedValueOnce(new Error("revoked lease"));
    await expect(
      runReservedProviderOperation(options(), state.dispatched),
    ).rejects.toThrow(/revoked/);
    expect(state.dispatched).not.toHaveBeenCalled();
  });
  it("releases a reservation when the lease is lost before dispatch", async () => {
    state.current
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("revoked after reservation"));
    await expect(
      runReservedProviderOperation(options(), state.dispatched),
    ).rejects.toThrow(/revoked after reservation/);
    expect(state.reserve).toHaveBeenCalledTimes(1);
    expect(state.release).toHaveBeenCalledWith(5, "mock_call_123");
    expect(state.dispatched).not.toHaveBeenCalled();
  });
  it("rejects price gaps, expired price data and duplicate reservations", async () => {
    const provisional = options();
    provisional.envelope.priceSnapshotSource = "provisional";
    await expect(
      runReservedProviderOperation(provisional, state.dispatched),
    ).rejects.toThrow(/Provider prices remain provisional/);
    const expired = options();
    vi.setSystemTime(new Date("2026-11-08T00:00:00Z"));
    await expect(
      runReservedProviderOperation(expired, state.dispatched),
    ).rejects.toThrow(/expired/);
    vi.setSystemTime(now);
    state.reserve.mockResolvedValueOnce("duplicate");
    await expect(
      runReservedProviderOperation(options(), state.dispatched),
    ).rejects.toThrow(/Duplicate/);
    expect(state.dispatched).not.toHaveBeenCalled();
  });
  it("never auto-releases a reservation after an uncertain provider failure", async () => {
    state.dispatched.mockRejectedValueOnce(new Error("network timeout"));
    await expect(
      runReservedProviderOperation(options(), state.dispatched),
    ).rejects.toThrow(/timeout/);
    expect(state.reserve).toHaveBeenCalledTimes(1);
    expect(state.settle).not.toHaveBeenCalled();
  });
  it("does not report success when the verified charge cannot be settled", async () => {
    state.settle.mockRejectedValueOnce(new Error("settlement failed"));
    await expect(
      runReservedProviderOperation(options(), state.dispatched),
    ).rejects.toThrow(/settlement failed/);
    expect(state.dispatched).toHaveBeenCalledTimes(1);
  });
});

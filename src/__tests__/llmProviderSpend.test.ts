import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// prettier-ignore
const state = vi.hoisted(() => ({
  operation: vi.fn(async (
    _options: unknown,
    invoke: () => Promise<{ value: Response; verifiedCents: number }>,
  ) => (await invoke()).value),
}));
vi.mock("../services/guardedProviderOperation.js", () => ({
  runReservedProviderOperation: state.operation,
}));

import { dispatchCostedLlmAttempt } from "../services/llmProviderSpend.js";

const originalCatalog = process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON;
const rate = {
  provider: "test-provider",
  model: "test-model",
  inputUsdMicrosPerMillionTokens: 1000000,
  outputUsdMicrosPerMillionTokens: 2000000,
  fixedRequestCents: 1,
  reviewedAt: "2026-11-01T00:00:00Z",
  validUntil: "2099-01-01T00:00:00Z",
  sourceUrl: "https://example.com/reviewed-provider-price",
};

const input = () => ({
  provider: "test-provider",
  model: "test-model",
  maxInputTokens: 200,
  maxOutputTokens: 100,
  externalRuntimeStorageEgressCents: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON = JSON.stringify([rate]);
});

afterEach(() => {
  if (originalCatalog === undefined)
    delete process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON;
  else process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON = originalCatalog;
});

// prettier-ignore
describe("real LLM attempt monetary reservations", () => {
  it("verifies reviewed provider prices and reserves before dispatch", async () => {
    const dispatch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
        { status: 200 },
      ),
    );
    const result = await dispatchCostedLlmAttempt(input(), dispatch);
    expect(result.ok).toBe(true);
    expect(state.operation).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
    const [rawOptions] = state.operation.mock.calls[0];
    const options = rawOptions as {
      operationId: string;
      envelope: { attempts: Array<{ provider: string }>; priceSnapshotSource: string };
    };
    expect(options.operationId).toMatch(/^llm_[a-f0-9]{32}$/);
    expect(options.envelope.attempts[0].provider).toBe("test-provider");
    expect(options.envelope.priceSnapshotSource).toBe("provider_confirmed");
  });

  it("rejects unpriced providers without dispatch", async () => {
    await expect(
      dispatchCostedLlmAttempt({ ...input(), model: "unknown" }, vi.fn()),
    ).rejects.toThrow(/reviewed/);
    expect(state.operation).not.toHaveBeenCalled();
  });

  it("leaves uncertain provider charges unresolved without reporting success", async () => {
    const unsuccessful = await dispatchCostedLlmAttempt(
      input(),
      async () => new Response("unavailable", { status: 503 }),
    );
    expect(unsuccessful.status).toBe(503);
    expect(state.operation).toHaveBeenCalledOnce();
    // The core guard retains this reservation when verifiedCents is null.
    await expect(
      dispatchCostedLlmAttempt(
        input(),
        async () => new Response(JSON.stringify({}), { status: 200 }),
      ),
    ).rejects.toThrow(/usage missing/);
  });

  it("keeps non-success HTTP attempts reserved for a separately authorised retry", async () => {
    const response = await dispatchCostedLlmAttempt(
      input(),
      async () => new Response("rate limited", { status: 429 }),
    );
    expect(response.status).toBe(429);
    expect(state.operation).toHaveBeenCalledOnce();
    const [, execute] = state.operation.mock.calls[0];
    const outcome = await execute();
    expect(outcome.verifiedCents).toBeNull();
  });

  it("does not accept a missing runtime cost ceiling", async () => {
    await expect(
      dispatchCostedLlmAttempt(
        { ...input(), externalRuntimeStorageEgressCents: 0 },
        vi.fn(),
      ),
    ).rejects.toThrow(/ceiling/);
    expect(state.operation).not.toHaveBeenCalled();
  });

  it("ensures the build LLM transport routes guarded requests through the reserved dispatcher", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/_core/llm.ts"),
      "utf8",
    );
    expect(source).toContain("dispatchCostedLlmAttempt(");
    expect(source).toContain("throw new RetryUsageEvidenceError(error)");
    expect(source).toContain("maxInputTokens");
    expect(source).toContain("APPFORGE_LLM_RUNTIME_MAX_CENTS");
  });
});

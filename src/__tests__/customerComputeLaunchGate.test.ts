import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listConfiguredLlmProviders } from "../lib/llmProviders.js";
import {
  assertCustomerComputeLaunchCertified,
  CUSTOMER_COMPUTE_NOT_CERTIFIED,
  customerComputeLaunchCertified,
} from "../services/customerComputeLaunchGate.js";

afterEach(() => vi.unstubAllEnvs());

// prettier-ignore
describe("customer builds use real priced-provider readiness, not a blanket production stop", () => {
  it("admits production builds when a currently configured provider is cost-reviewed", () => {
    vi.stubEnv("GROQ_API_KEY", "unit-test-only");
    vi.stubEnv("APPFORGE_LLM_RUNTIME_MAX_CENTS", "15");
    const provider = listConfiguredLlmProviders().find((item) => item.id === "groq");
    expect(provider).toBeDefined();
    vi.stubEnv("APPFORGE_PROVIDER_PRICE_CATALOG_JSON", JSON.stringify([{
      provider: "groq",
      model: provider!.defaultModel,
      inputUsdMicrosPerMillionTokens: 1000000,
      outputUsdMicrosPerMillionTokens: 1000000,
      fixedRequestCents: 1,
      sourceUrl: "https://example.org/rate-review",
      reviewedAt: "2026-11-01T00:00:00Z",
      validUntil: "2099-01-01T00:00:00Z",
    }]));
    expect(customerComputeLaunchCertified("production")).toBe(true);
    expect(() => assertCustomerComputeLaunchCertified(false, "production")).not.toThrow();
  });

  it("refuses unpriced or uncapped requests, including owner operations", () => {
    vi.stubEnv("APPFORGE_PROVIDER_PRICE_CATALOG_JSON", "");
    vi.stubEnv("APPFORGE_LLM_RUNTIME_MAX_CENTS", "");
    expect(customerComputeLaunchCertified("production")).toBe(false);
    expect(() => assertCustomerComputeLaunchCertified(false, "production")).toThrow(
      CUSTOMER_COMPUTE_NOT_CERTIFIED,
    );
    expect(() => assertCustomerComputeLaunchCertified(true, "production")).toThrow();
  });

  it("supports offline qualification while disallowing unknown runtime identities", () => {
    expect(() => assertCustomerComputeLaunchCertified(false, "test")).not.toThrow();
    expect(() => assertCustomerComputeLaunchCertified(false, "development")).not.toThrow();
    for (const env of ["", "staging", "preview", "qa", "Production"]) {
      expect(() => assertCustomerComputeLaunchCertified(false, env)).toThrow();
    }
  });

  it("keeps the request and worker cost-readiness checks before customer AI generation", () => {
    for (const file of [
      "src/routes/generate.ts",
      "src/routers/projects.ts",
      "src/services/build-worker.ts",
    ]) {
      expect(readFileSync(resolve(process.cwd(), file), "utf8")).toContain(
        "assertCustomerComputeLaunchCertified(",
      );
    }
    const llm = readFileSync(resolve(process.cwd(), "src/_core/llm.ts"), "utf8");
    expect(llm).toContain("dispatchCostedLlmAttempt(");
    expect(llm).toContain("!currentBuildExecutionLease()");
  });
});

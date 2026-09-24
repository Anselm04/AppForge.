import { describe, expect, it } from "vitest";
import {
  enrichProductContract,
  mergeContractEnrichment,
} from "../contractEnrichment.js";
import { buildProductContract } from "../productContract.js";

const base = buildProductContract(
  "CRM for plumbers with Stripe billing and team accounts",
);

describe("LLM contract enrichment (validated, additive, with deterministic fallback)", () => {
  it("falls back to the deterministic contract when no model is available", async () => {
    const result = await enrichProductContract(base, { modelCall: null });
    expect(result.source).toBe("prompt_deterministic");
    expect(result.fallbackReason).toBe("no_llm_provider");
    expect(result.contract).toBe(base);
  });

  it("merges schema-valid additions with new sequential requirement ids", async () => {
    const result = await enrichProductContract(base, {
      modelCall: async () =>
        JSON.stringify({
          additionalRequirements: [
            {
              text: "Dispatch board showing each plumber's jobs for the day",
              category: "workflow",
              priority: "must",
            },
          ],
          dataModels: ["Job"],
          userRoles: ["dispatcher"],
        }),
    });
    expect(result.source).toBe("prompt_deterministic_llm_enriched");
    const added = result.contract.functionalRequirements.at(-1);
    expect(added?.id).toBe(
      `REQ-${String(base.functionalRequirements.length + 1).padStart(3, "0")}`,
    );
    expect(added?.text).toMatch(/Dispatch board/);
    expect(result.contract.dataModels).toContain("Job");
    expect(result.contract.userRoles).toContain("dispatcher");
    expect(result.contract.contractDerivation).toBe(
      "prompt_deterministic_llm_enriched",
    );
    // Fixed fields are untouched.
    expect(result.contract.productType).toBe(base.productType);
    expect(result.contract.selectedTechnologyStack).toBe(
      base.selectedTechnologyStack,
    );
    expect(result.contract.functionalRequirements.slice(0, -1)).toEqual(
      base.functionalRequirements,
    );
  });

  it("rejects responses that try to change fixed fields or break the schema", async () => {
    for (const raw of [
      JSON.stringify({ productType: "game" }),
      JSON.stringify({ dataModels: ["not pascal case"] }),
      "no json here",
    ]) {
      const result = await enrichProductContract(base, {
        modelCall: async () => raw,
      });
      expect(result.source).toBe("prompt_deterministic");
      expect(result.fallbackReason).toMatch(/^llm_enrichment_failed/);
      expect(result.contract).toBe(base);
    }
  });

  it("falls back when the model times out or throws", async () => {
    const slow = await enrichProductContract(base, {
      modelCall: () => new Promise(() => undefined),
      timeoutMs: 20,
    });
    expect(slow.fallbackReason).toMatch(/timed out/);
    const failing = await enrichProductContract(base, {
      modelCall: async () => {
        throw new Error("provider 500");
      },
    });
    expect(failing.fallbackReason).toMatch(/provider 500/);
    expect(failing.contract).toBe(base);
  });

  it("does not duplicate existing requirements", () => {
    const merged = mergeContractEnrichment(base, {
      additionalRequirements: [
        {
          text: base.functionalRequirements[0].text,
          category: "workflow",
          priority: "must",
        },
      ],
      targetUsers: [],
      userRoles: [],
      coreWorkflows: [],
      dataModels: [],
      integrations: [],
      securityRequirements: [],
    });
    expect(merged.functionalRequirements).toHaveLength(
      base.functionalRequirements.length,
    );
  });
});

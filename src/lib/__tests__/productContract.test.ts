import { describe, expect, it } from "vitest";
import { buildProductContract, classifyProductType, selectProductStack } from "../productContract.js";

describe("product contract", () => {
  it("classifies products beyond games", () => {
    expect(classifyProductType("Build a subscription CRM with team accounts")).toBe("saas");
    expect(classifyProductType("Create an AI assistant that researches documents")).toBe("agent");
    expect(classifyProductType("Build a checkout store for handmade products")).toBe("ecommerce");
  });

  it("selects a runtime from product intent", () => {
    expect(selectProductStack("Build a browser game with levels")).toBe("phaser-html5");
    expect(selectProductStack("Build a REST API for invoices")).toBe("api-service");
    expect(selectProductStack("Build a Chrome extension for saving links")).toBe("chrome-extension");
  });

  it("creates requirements and monetization evidence", () => {
    const contract = buildProductContract("Build a paid AI fitness coach with subscriptions and progress tracking");
    expect(contract.productType).toBe("agent");
    expect(contract.productFamilies).toContain("ai");
    expect(contract.productFamilies).toContain("billing");
    expect(contract.monetizationRequested).toBe(true);
    expect(contract.requirements.every((requirement) => /^REQ-\\d{3}$/.test(requirement.id))).toBe(true);
  });
});

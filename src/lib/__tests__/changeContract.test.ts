import { describe, expect, it } from "vitest";
import {
  createChangeContract,
  validateChangeContract,
} from "../changeContract.js";

const original = {
  productType: "booking-app",
  platforms: ["web"],
  requirements: ["customers can book tables"],
};

describe("ChangeContract", () => {
  it("anchors changes to the original ProductContract", () => {
    const contract = createChangeContract({
      projectId: 12,
      originalProductContract: original,
      request: "Add deposits and cancellation rules",
      additions: ["booking deposit"],
      changes: ["cancellation policy"],
      removals: [],
    });
    expect(contract.originalProductContractHash).toMatch(/^[a-f0-9]{64}$/);
    expect(contract.request).toContain("deposits");
  });

  it("requires impact decisions for data, API, UI, platform, billing, permissions, security and rollback", () => {
    const contract = createChangeContract({
      projectId: 12,
      originalProductContract: original,
      request: "Add deposits",
      additions: ["deposit"],
      changes: [],
      removals: [],
    });
    expect(Object.keys(contract.impacts).sort()).toEqual(
      [
        "api",
        "billing",
        "data",
        "permissions",
        "platform",
        "rollback",
        "security",
        "ui",
      ].sort(),
    );
    expect(validateChangeContract(contract).valid).toBe(true);
  });

  it("fails closed when rollback is marked safe without a recovery strategy", () => {
    const contract = createChangeContract({
      projectId: 12,
      originalProductContract: original,
      request: "Remove a customer field",
      additions: [],
      changes: [],
      removals: ["customer field"],
    });
    contract.impacts.rollback = { level: "breaking", safe: true, strategy: "" };
    expect(validateChangeContract(contract).valid).toBe(false);
  });

  it("fails closed when a removal is marked rollback-safe without recorded safety evidence", () => {
    const contract = createChangeContract({
      projectId: 12,
      originalProductContract: original,
      request: "Remove a customer field",
      additions: [],
      changes: [],
      removals: ["customer field"],
    });
    contract.impacts.rollback = {
      level: "compatible",
      safe: true,
      strategy: "Restore the previous validated artifact.",
    };

    const result = validateChangeContract(contract);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Destructive removals cannot be marked rollback-safe without recorded safety evidence.",
    );
  });
});

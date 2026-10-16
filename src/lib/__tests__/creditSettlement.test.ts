import { describe, expect, it } from "vitest";
import { decideCreditSettlement } from "../creditSettlement.js";

describe("build credit settlement", () => {
  it.each([
    "early_failure",
    "provider_outage",
    "internal_defect",
    "timeout",
    "interruption",
    "duplicate",
  ] as const)("does not unfairly charge AppForge/provider failure: %s", (kind) => {
    const decision = decideCreditSettlement({
      kind,
      usefulWorkDelivered: false,
      creditsReserved: 4,
      creditsCharged: 0,
      customerCaused: false,
    });
    expect(["released", "refunded", "not_charged"]).toContain(decision.outcome);
    expect(decision.customerFault).toBe(false);
  });

  it("does not automatically refund invalid customer credentials after material work", () => {
    const decision = decideCreditSettlement({
      kind: "invalid_customer_credentials",
      usefulWorkDelivered: true,
      creditsReserved: 0,
      creditsCharged: 2,
      customerCaused: true,
    });
    expect(decision.outcome).toBe("charged");
  });

  it("uses an idempotency key for every adjustment", () => {
    const decision = decideCreditSettlement({
      kind: "duplicate",
      usefulWorkDelivered: false,
      creditsReserved: 3,
      creditsCharged: 0,
      customerCaused: false,
      buildRef: "build-55",
    });
    expect(decision.idempotencyKey).toContain("build-55");
  });
});

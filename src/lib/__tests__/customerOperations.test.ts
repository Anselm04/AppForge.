import { describe, expect, it } from "vitest";
import {
  buildFailureExplanation,
  createSupportCase,
} from "../customerOperations.js";

describe("customer operations", () => {
  it("creates support cases with complete operational fields", () => {
    const support = createSupportCase({
      userId: 7,
      projectId: 12,
      buildRef: "build-44",
      severity: "SEV-3",
      category: "build-failure",
      customerSummary: "Build stopped during deployment",
    });
    expect(support.caseRef).toMatch(/^CASE-/);
    expect(support.status).toBe("open");
    expect(support.internalNotes).toEqual([]);
    expect(support.billingAdjustment).toBeNull();
  });

  it("explains failure and credit treatment without exposing internals", () => {
    const message = buildFailureExplanation({
      kind: "provider_outage",
      creditOutcome: "refunded",
      retryable: true,
    });
    expect(message.customerMessage).toMatch(/provider/i);
    expect(message.creditMessage).toMatch(/restored/i);
    expect(message.canRetry).toBe(true);
    expect(JSON.stringify(message)).not.toMatch(/stack|token|secret/i);
  });
});

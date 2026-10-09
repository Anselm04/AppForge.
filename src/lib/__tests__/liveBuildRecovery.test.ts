import { describe, expect, it } from "vitest";
import { canRetryPlanning } from "../buildRecovery.js";
import { buildActivityLabel } from "../buildStatus.js";

describe("live interrupted planning recovery", () => {
  const interrupted = {
    status: "paused",
    pauseReason: "retry_after_error",
    buildStage: "researching",
    productPlan: null,
  };
  it("lets a real early interruption retry planning before there is a plan to approve", () => {
    expect(canRetryPlanning(interrupted)).toBe(true);
    expect(
      canRetryPlanning({ ...interrupted, buildStage: "architecture" }),
    ).toBe(true);
  });
  it("never uses planning retry to bypass generation approval or cancellation", () => {
    expect(canRetryPlanning({ ...interrupted, productPlan: {} })).toBe(false);
    expect(canRetryPlanning({ ...interrupted, buildStage: "generating" })).toBe(
      false,
    );
    expect(canRetryPlanning({ ...interrupted, buildStage: null })).toBe(false);
    expect(
      canRetryPlanning({ ...interrupted, pauseReason: "user_cancelled" }),
    ).toBe(false);
    expect(
      canRetryPlanning({ ...interrupted, pauseReason: "credits_exhausted" }),
    ).toBe(false);
    expect(canRetryPlanning({ ...interrupted, status: "running" })).toBe(false);
  });
  it("shows paused and failed states rather than claiming work is running", () => {
    expect(buildActivityLabel(interrupted)).toBe("Paused — action required");
    expect(
      buildActivityLabel({
        status: "paused",
        pauseReason: "approval_required",
      }),
    ).toBe("Waiting for your approval");
    expect(buildActivityLabel({ status: "failed" })).toBe("Build failed");
    expect(buildActivityLabel({ status: "pending" })).toBe("Queued");
    expect(
      buildActivityLabel({ status: "running", buildStage: "researching" }),
    ).toBe("Researching");
    expect(buildActivityLabel({ status: "validated" })).toBe(
      "Validated production candidate",
    );
    expect(buildActivityLabel({ status: "production-certified" })).toBe(
      "Production certified",
    );
  });
});

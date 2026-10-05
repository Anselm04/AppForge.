import { describe, expect, it, vi } from "vitest";
import { evaluateWatchdogTransition } from "../capabilities/watchdog.js";

const healthy = {
  provider: "composio",
  state: "healthy" as const,
  reason: "ok",
  failureCount: 0,
  anomalyCount: 0,
  updatedAt: new Date().toISOString(),
};

describe("capability watchdog", () => {
  it("keeps normal success healthy", () => {
    const next = evaluateWatchdogTransition(healthy, {
      outcome: "success",
      reason: "ok",
    });
    expect(next.state).toBe("healthy");
  });

  it("restricts after repeated provider failures", () => {
    const next = evaluateWatchdogTransition(
      { ...healthy, failureCount: 2 },
      { outcome: "provider_failure", reason: "upstream 503" },
    );
    expect(next.state).toBe("restricted");
    expect(next.failureCount).toBe(3);
  });

  it("quarantines cross-project or protected-boundary attempts immediately", () => {
    const next = evaluateWatchdogTransition(healthy, {
      outcome: "security_violation",
      reason: "Cross-project protected AppForge source access attempt",
    });
    expect(next.state).toBe("quarantined");
  });

  it("disables on confirmed critical integrity compromise", () => {
    const next = evaluateWatchdogTransition(healthy, {
      outcome: "security_violation",
      reason: "confirmed credential exfiltration integrity compromise",
    });
    expect(next.state).toBe("disabled");
  });
});

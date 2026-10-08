import { describe, expect, it } from "vitest";
import {
  currentBuildAttemptEvents,
  isRecoverableBuildPause,
} from "../buildRecovery.js";

describe("saved build recovery", () => {
  it("permits only known recoverable worker pauses", () => {
    for (const reason of [
      "retry_after_error",
      "agent_timeout",
      "still_building",
      "still_building_soft_ceiling_8",
    ]) {
      expect(isRecoverableBuildPause("paused", reason)).toBe(true);
      expect(isRecoverableBuildPause("running", reason)).toBe(false);
    }
    for (const reason of [
      null,
      "user_cancelled",
      "approval_required",
      "credits_exhausted",
      "missing_ai_keys",
      "still_building_unknown",
    ]) {
      expect(isRecoverableBuildPause("paused", reason)).toBe(false);
    }
  });

  it("starts replay at the latest durable resume boundary", () => {
    const events = [
      { event: "agent", payload: { message: "old logs" } },
      { event: "pause", payload: { reason: "retry_after_error" } },
      { event: "error", payload: { message: "old error" } },
      { event: "build_resume", payload: {} },
      { event: "agent", payload: { message: "new work" } },
    ];
    expect(currentBuildAttemptEvents(events)).toEqual(events.slice(3));
    expect(events).toHaveLength(5);
    expect(
      currentBuildAttemptEvents([
        ...events,
        { event: "build_resume", payload: {} },
      ]),
    ).toHaveLength(1);
    expect(currentBuildAttemptEvents(events.slice(0, 3))).toEqual(
      events.slice(0, 3),
    );
  });
});

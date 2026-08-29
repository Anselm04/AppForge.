import { describe, expect, it } from "vitest";
import {
  PLATFORM_FEATURE_MATRIX,
  appforgeExclusiveCount,
  capabilitySummary,
  scorePlatform,
} from "../lib/platformComparison.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";

describe("platform comparison", () => {
  it("tracks world-leader extension studios", () => {
    expect(PLATFORM_FEATURE_MATRIX.length).toBeGreaterThanOrEqual(27);
    expect(PLATFORM_FEATURE_MATRIX.some((r) => r.id === "game_studio")).toBe(
      true,
    );
    expect(
      PLATFORM_FEATURE_MATRIX.filter(
        (r) => r.category === "World-leader extensions",
      ),
    ).toHaveLength(10);
  });

  it("lists all build capabilities", () => {
    expect(capabilitySummary()).toHaveLength(BUILD_CAPABILITY_IDS.length);
  });

  it("scores AppForge ahead on creative verticals", () => {
    const af = scorePlatform("appforge");
    const bolt = scorePlatform("bolt");
    expect(af.full).toBeGreaterThan(bolt.full);
    expect(appforgeExclusiveCount()).toBeGreaterThan(5);
  });
});

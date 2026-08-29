import { describe, expect, it } from "vitest";
import {
  PLATFORM_FEATURE_MATRIX,
  appforgeExclusiveCount,
  capabilitySummary,
  scorePlatform,
} from "../lib/platformComparison.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";

describe("platform comparison", () => {
  it("tracks features across competitors", () => {
    expect(PLATFORM_FEATURE_MATRIX.length).toBeGreaterThan(10);
    expect(
      PLATFORM_FEATURE_MATRIX.some((r) => r.id === "architecture_bim"),
    ).toBe(true);
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

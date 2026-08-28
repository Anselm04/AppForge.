import { describe, expect, it } from "vitest";
import {
  APPFORGE_BUILD_BOUNDARIES,
  APPFORGE_BUILD_PURPOSE,
  buildPurposePrompt,
  buildPurposeSummary,
} from "../lib/buildPurpose.js";
import { capabilityHintsForPipeline } from "../agents/capabilityHints.js";

describe("build purpose", () => {
  it("defines purpose and five boundary categories", () => {
    expect(APPFORGE_BUILD_PURPOSE).toContain("full coverage");
    expect(APPFORGE_BUILD_BOUNDARIES).toHaveLength(5);
    expect(APPFORGE_BUILD_BOUNDARIES.map((b) => b.id)).toEqual([
      "illegal",
      "harmful",
      "sexual",
      "discrimination",
      "deception",
    ]);
  });

  it("buildPurposePrompt includes boundaries for agents", () => {
    const prompt = buildPurposePrompt();
    expect(prompt).toContain("APPFORGE BUILD PURPOSE");
    expect(prompt).toContain("Sexually explicit");
    expect(prompt).toContain("legitimate request");
  });

  it("buildPurposeSummary is concise for UI", () => {
    expect(buildPurposeSummary().length).toBeLessThan(700);
    expect(buildPurposeSummary()).toContain("legitimate");
  });

  it("injects purpose into pipeline even without capabilities", () => {
    const hints = capabilityHintsForPipeline([]);
    expect(hints).toContain("APPFORGE BUILD PURPOSE");
  });
});

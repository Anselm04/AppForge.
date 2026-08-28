import { describe, expect, it } from "vitest";
import { detectBimClashes } from "../lib/architectureClashCheck.js";
import { checkAccessibilityCompliance } from "../lib/architectureComplianceCheck.js";
import {
  ARCHITECTURE_JURISDICTIONS,
  resolveUnits,
} from "../lib/architectureStandards.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";

describe("architecture studio", () => {
  it("registers architecture capability", () => {
    expect(BUILD_CAPABILITY_IDS).toContain("architecture");
    expect(BUILD_CAPABILITY_IDS).toHaveLength(9);
  });

  it("resolves units by jurisdiction", () => {
    expect(resolveUnits("US")).toBe("imperial");
    expect(resolveUnits("NZ")).toBe("metric");
    expect(resolveUnits("US", "metric")).toBe("metric");
  });

  it("has jurisdiction metadata for all regions", () => {
    expect(ARCHITECTURE_JURISDICTIONS.US.buildingCode).toContain("IBC");
    expect(ARCHITECTURE_JURISDICTIONS.NZ.planningAuthority).toContain(
      "Territorial",
    );
  });

  it("detects BIM clashes between structural and MEP", () => {
    const result = detectBimClashes([
      {
        id: "beam-1",
        discipline: "structural",
        type: "beam",
        x: 0,
        y: 0,
        z: 2,
        width: 5,
        height: 0.5,
        depth: 0.3,
      },
      {
        id: "duct-1",
        discipline: "mechanical",
        type: "duct",
        x: 2,
        y: 0,
        z: 2,
        width: 2,
        height: 0.4,
        depth: 0.4,
      },
    ]);
    expect(result.criticalCount).toBeGreaterThan(0);
    expect(result.clashes[0]?.severity).toBe("critical");
  });

  it("checks accessibility door widths", () => {
    const result = checkAccessibilityCompliance({
      rooms: [
        { id: "1", name: "Entry", type: "entrance", doorWidthMm: 700 },
        { id: "2", name: "Hall", type: "corridor", doorWidthMm: 900 },
      ],
      corridorWidthMm: 1500,
      egressDoorCount: 2,
    });
    expect(result.failures.some((f) => f.includes("Entry"))).toBe(true);
    expect(result.passed.some((p) => p.includes("Hall"))).toBe(true);
  });
});

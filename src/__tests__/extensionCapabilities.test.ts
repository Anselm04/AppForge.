import { describe, expect, it } from "vitest";
import {
  EXTENSION_CAPABILITY_IDS,
  EXTENSION_STUDIOS,
  EXTENSION_GENERATE_PROCEDURE,
  attachPrefixForKind,
} from "../lib/extensionCapabilities.js";
import { assertExtensionProcedureCoverage } from "../routers/extensionProcedures.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";
import { PLATFORM_FEATURE_MATRIX } from "../lib/platformComparison.js";

describe("extension capabilities", () => {
  it("registers all extension IDs in build capabilities", () => {
    for (const id of EXTENSION_CAPABILITY_IDS) {
      expect(BUILD_CAPABILITY_IDS).toContain(id);
    }
    expect(BUILD_CAPABILITY_IDS).toHaveLength(19);
  });

  it("wires generate procedures for every extension studio", () => {
    expect(assertExtensionProcedureCoverage()).toBe(true);
    for (const id of EXTENSION_CAPABILITY_IDS) {
      expect(EXTENSION_GENERATE_PROCEDURE[id]).toBeTruthy();
      expect(EXTENSION_STUDIOS[id].attachPrefix).toBe(attachPrefixForKind(id));
    }
  });

  it("tracks world-leader extension rows in platform comparison", () => {
    const extensionRows = PLATFORM_FEATURE_MATRIX.filter(
      (r) => r.category === "World-leader extensions",
    );
    expect(extensionRows).toHaveLength(10);
    expect(extensionRows.every((r) => r.appforge === "studio")).toBe(true);
  });
});

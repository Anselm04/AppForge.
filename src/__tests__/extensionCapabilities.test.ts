import { describe, expect, it } from "vitest";
import {
  EXTENSION_CAPABILITY_IDS,
  EXTENSION_STUDIOS,
  EXTENSION_GENERATE_PROCEDURE,
  attachPrefixForKind,
} from "../lib/extensionCapabilities.js";
import {
  assertExtensionProcedureCoverage,
  parseExtensionPlanJson,
  validateExtensionPlan,
} from "../routers/extensionProcedures.js";
import {
  BUILD_CAPABILITIES,
  BUILD_CAPABILITY_IDS,
} from "../lib/buildCapabilities.js";
import { PLATFORM_FEATURE_MATRIX } from "../lib/platformComparison.js";

describe("extension capabilities", () => {
  it("registers all extension IDs in build capabilities", () => {
    for (const id of EXTENSION_CAPABILITY_IDS) {
      expect(BUILD_CAPABILITY_IDS).toContain(id);
    }
    expect(BUILD_CAPABILITY_IDS).toHaveLength(19);
  });

  it("uses tech stacks supported by the main autonomous pipeline", () => {
    expect(BUILD_CAPABILITIES.game.suggestedStack).toBe("phaser-html5");
    expect(BUILD_CAPABILITIES.mobile.suggestedStack).toBe("react-native-expo");
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

  it("accepts structured JSON even when wrapped in model prose", () => {
    expect(
      parseExtensionPlanJson(
        'Here is the plan:\n{"framework":"expo","platforms":["ios"]}',
      ),
    ).toEqual({ framework: "expo", platforms: ["ios"] });
  });

  it("fails closed when an extension generator returns malformed output", () => {
    expect(() => parseExtensionPlanJson("not-json")).toThrow(
      "AI returned an invalid structured extension plan.",
    );
    expect(() => parseExtensionPlanJson("   ")).toThrow(
      "AI returned an empty extension plan.",
    );
  });

  it("rejects incomplete mobile, game, and collaboration plans", () => {
    expect(() =>
      validateExtensionPlan("mobile", {
        framework: "expo",
        appName: "Example",
        platforms: ["ios"],
      }),
    ).toThrow("AI returned an invalid mobile extension plan.");

    expect(() =>
      validateExtensionPlan("game", {
        title: "Example",
        engine: "phaser",
      }),
    ).toThrow("AI returned an invalid game extension plan.");

    expect(() =>
      validateExtensionPlan("collab", {
        roomId: "room-1",
        transport: "websocket",
      }),
    ).toThrow("AI returned an invalid collab extension plan.");
  });

  it("accepts guarded mobile, game, and collaboration plans", () => {
    expect(
      validateExtensionPlan("mobile", {
        framework: "expo",
        appName: "Example",
        bundleId: "com.example.app",
        platforms: ["ios", "android"],
        storeListing: {
          title: "Example",
          subtitle: "Built with AppForge",
          description: "A production-ready application.",
          keywords: ["appforge"],
        },
        icons: [{ size: 1024, purpose: "app-store" }],
        permissions: [],
        buildCommands: ["npx expo export"],
      }).framework,
    ).toBe("expo");

    expect(
      validateExtensionPlan("game", {
        title: "Example Game",
        engine: "phaser",
        genre: "arcade",
        mechanics: ["movement"],
        scenes: [{ id: "main", name: "Main", entities: [] }],
        assets: [],
        webglPreview: {
          playerControls: "Arrow keys",
          winCondition: "Reach the goal",
        },
        buildSteps: ["npm run build"],
      }).engine,
    ).toBe("phaser");

    expect(
      validateExtensionPlan("collab", {
        roomId: "room-1",
        transport: "websocket",
        roles: [{ id: "editor", permissions: ["edit"] }],
        syncedArtifacts: ["project"],
        presenceEvents: ["join", "leave"],
        conflictStrategy: "CRDT",
        cursors: true,
        versionHistory: true,
      }).versionHistory,
    ).toBe(true);
  });
});

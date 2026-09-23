import { describe, expect, it } from "vitest";
import {
  STACK_ADAPTERS,
  assertStackSupportsProduct,
  getStackAdapter,
  isStructuralOnlyStack,
  normalizeStackId,
} from "../stackAdapters.js";
import { getStackScaffold } from "../../services/stackScaffolds.js";
import {
  buildProductContract,
  withSelectedTechnologyStack,
} from "../productContract.js";

describe("technology stack adapters", () => {
  it("covers every required product-factory adapter family", () => {
    const ids = new Set(STACK_ADAPTERS.map((adapter) => adapter.id));
    for (const id of [
      "react-node",
      "static-html",
      "next-node",
      "phaser-html5",
      "three-js-3d",
      "react-native-expo",
      "flutter-firebase",
      "electron-react",
      "tauri-rust",
      "api-service",
      "ai-agent-node",
      "chrome-extension",
      "browser-automation",
      "data-visualization",
      "python-service",
      "node-service",
    ]) {
      expect(ids.has(id), `missing adapter ${id}`).toBe(true);
    }
  });

  it("stores stack-specific entrypoint/build/runtime/preview/deploy/artifact metadata", () => {
    for (const adapter of STACK_ADAPTERS) {
      expect(adapter.entrypoints.length).toBeGreaterThan(0);
      expect(adapter.dependencyManifest.length).toBeGreaterThan(0);
      expect(adapter.projectStructure.length).toBeGreaterThan(0);
      expect(adapter.previewMode.length).toBeGreaterThan(0);
      expect(adapter.runtime.length).toBeGreaterThan(0);
      expect(adapter.artifactKind.length).toBeGreaterThan(0);
      expect(adapter.deploymentTargets.length).toBeGreaterThan(0);
    }
  });

  it("normalizes explicit aliases without silently changing unknown stacks to React", () => {
    expect(normalizeStackId("Next.js")).toBe("next-node");
    expect(normalizeStackId("Flutter")).toBe("flutter-firebase");
    expect(() => normalizeStackId("mystery-framework")).toThrow(
      /Unsupported technology stack/,
    );
  });

  it("rejects an explicit stack that is incompatible with the product contract", () => {
    const contract = buildProductContract("Build a mobile app for field staff");
    expect(() =>
      withSelectedTechnologyStack(contract, "next-node"),
    ).toThrow(/does not support product type mobile_app/);
  });

  it("preserves a compatible explicit stack in canonical form", () => {
    const contract = buildProductContract("Build a website for a design studio");
    const updated = withSelectedTechnologyStack(contract, "Next.js");
    expect(updated.selectedTechnologyStack).toBe("next-node");
    expect(updated.originalPrompt).toBe(contract.originalPrompt);
  });

  it("marks native structural outputs explicitly", () => {
    expect(isStructuralOnlyStack("flutter-firebase")).toBe(true);
    expect(isStructuralOnlyStack("react-native-expo")).toBe(true);
    expect(isStructuralOnlyStack("electron-react")).toBe(true);
    expect(isStructuralOnlyStack("tauri-rust")).toBe(true);
    expect(isStructuralOnlyStack("chrome-extension")).toBe(true);
    expect(isStructuralOnlyStack("react-node")).toBe(false);
  });

  it("never substitutes a React web scaffold for non-web stacks", () => {
    const api = getStackScaffold("api-service");
    expect(api["src/server.ts"]).toContain("express");
    expect(api["src/App.tsx"]).toBeUndefined();

    const agent = getStackScaffold("ai-agent-node");
    expect(agent["src/index.ts"]).toContain("express");
    expect(agent["src/App.tsx"]).toBeUndefined();

    const extension = getStackScaffold("chrome-extension");
    expect(extension["manifest.json"]).toContain('"manifest_version": 3');
    expect(extension["src/App.tsx"]).toBeUndefined();

    const flutter = getStackScaffold("flutter-firebase");
    expect(flutter["lib/main.dart"]).toContain("MaterialApp");
    expect(flutter["src/App.tsx"]).toBeUndefined();
  });

  it("enforces product compatibility through the adapter registry", () => {
    expect(assertStackSupportsProduct("phaser-html5", "game").id).toBe(
      "phaser-html5",
    );
    expect(() =>
      assertStackSupportsProduct("phaser-html5", "api"),
    ).toThrow(/does not support product type api/);
  });

  it("exposes adapter metadata for runtime decisions", () => {
    const api = getStackAdapter("api-service");
    expect(api.runtime).toBe("node");
    expect(api.previewMode).toBe("service");
    expect(api.buildCommand).toBe("npm run build");
    expect(api.startCommand).toBe("npm run start");
    expect(api.outputDirectory).toBe("dist");
  });
});

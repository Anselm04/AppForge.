import { describe, expect, it } from "vitest";
import {
  ADAPTER_CAPABILITY_STATES,
  evaluateAdapterPromotion,
  stateRank,
} from "../adapterSdk.js";
import {
  EXTERNAL_TECHNOLOGY_ADAPTERS,
  getExternalTechnologyAdapter,
  listAdaptersByCategory,
} from "../externalTechnologyAdapters.js";

describe("external technology adapter registry", () => {
  it("has a unique id for every adapter", () => {
    const ids = EXTERNAL_TECHNOLOGY_ADAPTERS.map((adapter) => adapter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the categories named in the universal builder specification", () => {
    const categories = new Set(
      EXTERNAL_TECHNOLOGY_ADAPTERS.map((adapter) => adapter.category),
    );
    for (const category of [
      "game_engine",
      "mobile_toolchain",
      "desktop_toolchain",
      "content_tool",
      "database",
      "cloud_platform",
      "compiler_runtime",
      "ai_provider",
      "deployment_target",
      "hardware_toolchain",
    ]) {
      expect(categories.has(category as never), category).toBe(true);
    }
  });

  it("includes named example technologies from the specification", () => {
    for (const id of [
      "unreal-engine",
      "unity-engine",
      "godot-engine",
      "flutter-sdk",
      "xcode-apple-toolchain",
      "android-sdk-gradle",
      "blender",
    ]) {
      expect(getExternalTechnologyAdapter(id), id).toBeTruthy();
    }
  });

  it("never claims a state without evidence that justifies it", () => {
    for (const adapter of EXTERNAL_TECHNOLOGY_ADAPTERS) {
      if (adapter.state === "unsupported") continue;
      // Re-derive the highest state the adapter's own evidence actually
      // supports and require it to match (or exceed) the claimed state.
      let highestJustified =
        "unsupported" as (typeof ADAPTER_CAPABILITY_STATES)[number];
      for (const candidate of ADAPTER_CAPABILITY_STATES) {
        const result = evaluateAdapterPromotion(
          "unsupported",
          candidate,
          adapter.evidence,
        );
        if (result.ok && stateRank(candidate) > stateRank(highestJustified)) {
          highestJustified = candidate;
        }
      }
      expect(
        stateRank(adapter.state),
        `${adapter.id} claims ${adapter.state} but evidence only justifies ${highestJustified}`,
      ).toBeLessThanOrEqual(stateRank(highestJustified));
    }
  });

  it("never claims production-certified without a reproducible build", () => {
    for (const adapter of EXTERNAL_TECHNOLOGY_ADAPTERS) {
      if (adapter.state === "production-certified") {
        expect(adapter.evidence.reproducibleBuild, adapter.id).toBe(true);
      }
    }
  });

  it("requires credential isolation metadata whenever authentication is required", () => {
    for (const adapter of EXTERNAL_TECHNOLOGY_ADAPTERS) {
      if (adapter.authentication.required) {
        expect(adapter.authentication.credentialIsolation, adapter.id).not.toBe(
          "not_applicable",
        );
      }
    }
  });

  it("filters by category", () => {
    const engines = listAdaptersByCategory("game_engine");
    expect(engines.length).toBeGreaterThanOrEqual(3);
    expect(engines.every((adapter) => adapter.category === "game_engine")).toBe(
      true,
    );
  });
});

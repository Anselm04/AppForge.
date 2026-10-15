import { describe, expect, it } from "vitest";
import { stateRank } from "../adapterSdk.js";
import {
  PRODUCT_CAPABILITY_ADAPTERS,
  getProductCapabilityAdapter,
  listProductCapabilitiesForPlatform,
} from "../productCapabilityAdapters.js";

const REQUIRED_NATIVE_CAPABILITIES = [
  "push_notifications",
  "speech_recognition",
  "text_to_speech",
  "siri_app_intents",
  "android_voice_actions",
  "camera",
  "photos",
  "microphone",
  "audio",
  "gps_location",
  "background_location",
  "bluetooth",
  "biometrics",
  "deep_links",
  "file_access",
  "sharing",
  "contacts",
  "calendar",
  "widgets",
  "live_activities",
  "background_jobs",
  "scheduling",
] as const;

describe("product capability adapters", () => {
  it("defines every native capability required by the product-factory programme", () => {
    const ids = PRODUCT_CAPABILITY_ADAPTERS.map((adapter) => adapter.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of REQUIRED_NATIVE_CAPABILITIES) {
      expect(getProductCapabilityAdapter(id), id).toBeTruthy();
    }
  });

  it("keeps unproven native capabilities at discovered instead of over-promoting them", () => {
    for (const adapter of PRODUCT_CAPABILITY_ADAPTERS) {
      expect(stateRank(adapter.state), adapter.id).toBeLessThanOrEqual(
        stateRank("discovered"),
      );
      expect(adapter.evidence.discovered, adapter.id).toBe(true);
      expect(adapter.evidence.runtimeVerified, adapter.id).not.toBe(true);
      expect(adapter.evidence.behavioralVerified, adapter.id).not.toBe(true);
    }
  });

  it("records the complete reusable implementation and evidence contract", () => {
    for (const adapter of PRODUCT_CAPABILITY_ADAPTERS) {
      expect(adapter.supportedPlatforms.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.dependencies, adapter.id).toBeDefined();
      expect(adapter.permissions, adapter.id).toBeDefined();
      expect(adapter.nativeConfiguration.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.credentialRequirements, adapter.id).toBeDefined();
      expect(adapter.provisioning.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.installSteps.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.buildRequirements.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.runtimeTests.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.behavioralTests.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.failureDetection.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.securityBoundaries.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.limitations.length, adapter.id).toBeGreaterThan(0);
      expect(adapter.evidenceRequirements.length, adapter.id).toBeGreaterThan(
        0,
      );
    }
  });

  it("filters capabilities by actual supported platform", () => {
    const ios = listProductCapabilitiesForPlatform("ios");
    const android = listProductCapabilitiesForPlatform("android");
    expect(ios.some((adapter) => adapter.id === "siri_app_intents")).toBe(true);
    expect(ios.some((adapter) => adapter.id === "android_voice_actions")).toBe(
      false,
    );
    expect(
      android.some((adapter) => adapter.id === "android_voice_actions"),
    ).toBe(true);
    expect(android.some((adapter) => adapter.id === "live_activities")).toBe(
      false,
    );
  });
});

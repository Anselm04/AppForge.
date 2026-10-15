import { describe, expect, it } from "vitest";
import { resolveIntakeContract } from "../productContract.js";
import { deriveRequestedProductCapabilities } from "../nativeCapabilitySelection.js";

const GOLDEN_PRODUCT_PROMPT = [
  "Build an iPhone and Android restaurant table availability app.",
  "Users sign up and sign in, save restaurant watches in a database, choose preferred dates, time ranges and party sizes,",
  "monitor authorized reservation-provider API availability in the background on a recurring schedule,",
  "receive push notifications with deep links when a match appears, use hands-free voice commands with spoken replies,",
  "and only book a table after the user explicitly confirms.",
  "Charge $9.99 per month through Stripe with server-authoritative paid entitlements.",
  "Include analytics, privacy and terms, a secure backend, source export, and deployment configuration.",
].join(" ");

describe("Golden Product normal AppForge intake", () => {
  it("selects the flagship Flutter + Node path from a normal nontechnical full-stack mobile request", () => {
    const intake = resolveIntakeContract(GOLDEN_PRODUCT_PROMPT);
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;

    expect(intake.productContract.productType).toBe("mobile_app");
    expect(intake.productContract.selectedTechnologyStack).toBe("flutter-node");
    expect(intake.productContract.secondaryCapabilities).toEqual(
      expect.arrayContaining([
        "authentication",
        "database",
        "billing",
        "analytics",
        "notifications",
        "external_integrations",
        "deployment",
      ]),
    );
    expect(intake.productContract.monetizationRequirements.join("\n")).toMatch(
      /9\.99|subscription|stripe/i,
    );

    const nativeCapabilities = deriveRequestedProductCapabilities(
      intake.productContract,
    );
    expect(nativeCapabilities).toEqual(
      expect.arrayContaining([
        "push_notifications",
        "deep_links",
        "speech_recognition",
        "text_to_speech",
        "microphone",
        "background_jobs",
        "scheduling",
      ]),
    );
  });

  it("does not require the customer to name Flutter or Node to obtain the backend-capable flagship stack", () => {
    expect(GOLDEN_PRODUCT_PROMPT).not.toMatch(/flutter|node(?:\.js|js)?/i);
  });
});

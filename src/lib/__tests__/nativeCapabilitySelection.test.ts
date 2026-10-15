import { describe, expect, it } from "vitest";
import { resolveIntakeContract } from "../productContract.js";
import { deriveRequestedProductCapabilities } from "../productCapabilityAdapters.js";

const GOLDEN_PRODUCT_PROMPT =
  "Build a premium iPhone and Android application where users can enter restaurants they want to visit, preferred dates, time ranges and party sizes. Monitor legitimate and authorised reservation availability sources. When a matching table becomes available, send the user a push notification and support hands-free voice interaction. The app should be able to tell the user that a table became available and ask whether they want it booked. The user can answer by voice such as 'book it' or 'pass'. A reservation must only happen after the required user confirmation. Include secure user accounts, authentication, database persistence, background availability monitoring, notifications, voice interaction, $9.99 monetization according to the configured business model, payments, entitlement handling, account/subscription management, attractive professional graphics and branding, analytics, privacy/terms scaffolding, a marketing landing page, backend services, security, deployment configuration, source export and production release artifacts.";

describe("native capability selection", () => {
  it("derives the Golden Product native execution needs from the canonical contract", () => {
    const intake = resolveIntakeContract(GOLDEN_PRODUCT_PROMPT);
    if (!intake.ok) throw new Error(intake.message);

    const capabilities = deriveRequestedProductCapabilities(
      intake.productContract,
    );

    expect(capabilities).toEqual(
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

  it("does not invent native capabilities for an unrelated ordinary website", () => {
    const intake = resolveIntakeContract(
      "Build a responsive company website with an about page and contact form.",
    );
    if (!intake.ok) throw new Error(intake.message);

    expect(deriveRequestedProductCapabilities(intake.productContract)).toEqual(
      [],
    );
  });

  it("expands explicit device behavior into the minimum safe supporting capabilities", () => {
    const intake = resolveIntakeContract(
      "Build an iPhone and Android app that listens for a spoken command, reads the response aloud, and opens the matching screen when a push notification is tapped.",
    );
    if (!intake.ok) throw new Error(intake.message);

    const capabilities = deriveRequestedProductCapabilities(
      intake.productContract,
    );
    expect(capabilities).toEqual(
      expect.arrayContaining([
        "push_notifications",
        "deep_links",
        "speech_recognition",
        "text_to_speech",
        "microphone",
      ]),
    );
  });
});

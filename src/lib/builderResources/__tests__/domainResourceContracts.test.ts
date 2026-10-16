import { describe, expect, it } from "vitest";
import { BUILD_CAPABILITY_IDS } from "../../buildCapabilities.js";
import {
  CAPABILITY_DOMAIN_CONTRACTS,
  educationResourceSchema,
  fintechResourceSchema,
  healthcareResourceSchema,
  localizationResourceSchema,
  mobileResourceSchema,
  voiceResourceSchema,
} from "../domainResourceContracts.js";
import { SUBSTANTIAL_DOMAIN_RESOURCES } from "../substantialDomainResources.js";

describe("substantive domain resource contracts", () => {
  it("provides a real validation contract for every existing build capability", () => {
    expect(Object.keys(CAPABILITY_DOMAIN_CONTRACTS).sort()).toEqual(
      [...BUILD_CAPABILITY_IDS].sort(),
    );
    for (const capability of BUILD_CAPABILITY_IDS) {
      expect(
        CAPABILITY_DOMAIN_CONTRACTS[capability].safeParse({}).success,
      ).toBe(false);
    }
  });

  it("registers every domain contract as a source-backed internal domain pack", () => {
    expect(SUBSTANTIAL_DOMAIN_RESOURCES).toHaveLength(
      BUILD_CAPABILITY_IDS.length,
    );
    for (const capability of BUILD_CAPABILITY_IDS) {
      const resource = SUBSTANTIAL_DOMAIN_RESOURCES.find(
        (candidate) => candidate.identity.category === capability,
      );
      expect(resource?.identity.resourceType).toBe("domain_pack");
      expect(resource?.implementation.sourcePaths).toContain(
        "src/lib/builderResources/domainResourceContracts.ts",
      );
      expect(resource?.implementation.requiresLiveLibraryAtRuntime).toBe(false);
    }
  });

  it("validates education roles, progress, assessment and scheduling", () => {
    expect(
      educationResourceSchema.safeParse({
        organizations: true,
        roles: ["student", "instructor", "guardian"],
        course: {
          id: "course-1",
          title: "Carving",
          curriculumTags: ["art"],
          moduleIds: ["module-1"],
        },
        modules: [
          { id: "module-1", title: "Foundations", lessonIds: ["lesson-1"] },
        ],
        lessons: [
          {
            id: "lesson-1",
            title: "Tools",
            mediaAssetIds: [],
            accessibleTranscriptRequired: true,
          },
        ],
        enrollment: {
          enrollmentId: "enroll-1",
          learnerId: "user-1",
          courseId: "course-1",
          status: "active",
        },
        assessment: {
          questionBankId: "bank-1",
          gradingMode: "mixed",
          attemptsAllowed: 2,
        },
        progress: { completionPercent: 25, completedLessonIds: [] },
        schedule: [
          {
            id: "session-1",
            startsAt: "2026-10-16T01:00:00.000Z",
            endsAt: "2026-10-16T02:00:00.000Z",
            instructorId: "teacher-1",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("requires server-oriented fintech idempotency, reconciliation and review data", () => {
    expect(
      fintechResourceSchema.safeParse({
        products: [
          {
            id: "pro",
            name: "Pro",
            priceModel: "subscription",
            currency: "NZD",
          },
        ],
        ledgerAccounts: [
          { id: "cash", code: "1000", name: "Cash", type: "asset" },
          { id: "income", code: "4000", name: "Revenue", type: "income" },
        ],
        ledgerEntries: [
          {
            id: "entry-1",
            debitAccountId: "cash",
            creditAccountId: "income",
            amountMinor: 999,
            currency: "NZD",
            idempotencyKey: "evt-1",
          },
        ],
        entitlements: [
          { id: "ent-1", userId: "user-1", productId: "pro", active: true },
        ],
        webhookLedger: [
          {
            providerEventId: "evt-1",
            receivedAt: "2026-10-16T00:00:00.000Z",
            processedAt: null,
          },
        ],
        reconciliation: { required: true, cadence: "daily" },
        kycFields: ["legalName"],
        regulatoryReviewRequired: true,
      }).success,
    ).toBe(true);
  });

  it("models healthcare consent, tenant boundaries, audit and privacy safeguards", () => {
    expect(
      healthcareResourceSchema.safeParse({
        roles: ["patient", "provider"],
        sensitiveDataClasses: ["health-record"],
        consent: [
          {
            id: "consent-1",
            subjectId: "patient-1",
            purpose: "care",
            granted: true,
            at: "2026-10-16T00:00:00.000Z",
          },
        ],
        appointments: [
          {
            id: "appt-1",
            patientId: "patient-1",
            providerId: "provider-1",
            startsAt: "2026-10-17T00:00:00.000Z",
            status: "scheduled",
          },
        ],
        audit: [
          {
            id: "audit-1",
            actorId: "provider-1",
            action: "read",
            resourceId: "record-1",
            at: "2026-10-16T00:00:00.000Z",
          },
        ],
        retention: { days: 365, deletionReviewRequired: true },
        notificationPrivacy: { sensitiveContentAllowed: false },
        tenantBoundary: { tenantId: "clinic-1", enforced: true },
        complianceReviewRequired: true,
      }).success,
    ).toBe(true);
  });

  it("models mobile permissions, offline behavior, deep links, notification preferences and accessibility", () => {
    expect(
      mobileResourceSchema.safeParse({
        framework: "flutter",
        navigation: [{ route: "/account", protected: true }],
        permissions: [
          { capability: "camera", rationale: "Scan receipt", required: false },
        ],
        secureStorage: true,
        offlineCache: { enabled: true, conflictPolicy: "server-version-wins" },
        deepLinks: [{ pattern: "app://booking/:id", route: "/booking/:id" }],
        notifications: { push: true, local: true, preferences: true },
        lifecycleHooks: ["resume", "pause"],
        accessibility: {
          screenReaderLabels: true,
          textScaling: true,
          reducedMotion: true,
        },
        localization: true,
        store: {
          bundleId: "com.example.app",
          displayName: "Example",
          iconAssetId: null,
          splashAssetId: null,
        },
      }).success,
    ).toBe(true);
  });

  it("forbids unrestricted always-listening voice configuration", () => {
    const valid = voiceResourceSchema.safeParse({
      speechInput: {
        enabled: true,
        locales: ["en-NZ"],
        confidenceThreshold: 0.8,
      },
      tts: { enabled: true, voiceId: null, interruptible: true },
      confirmation: {
        requiredForActions: ["book"],
        cancelIntents: ["cancel", "pass"],
      },
      activation: { mode: "user-initiated", alwaysListening: false },
      transcript: { persist: false, retentionDays: 0, sensitive: true },
      siriAppIntents: true,
      androidVoiceActions: true,
    });
    expect(valid.success).toBe(true);
    expect(
      voiceResourceSchema.safeParse({
        ...(valid.success ? valid.data : {}),
        activation: { mode: "user-initiated", alwaysListening: true },
      }).success,
    ).toBe(false);
  });

  it("validates locale fallback, formatting, RTL and accessible language selection", () => {
    expect(
      localizationResourceSchema.safeParse({
        defaultLocale: "en-NZ",
        supportedLocales: ["en-NZ", "ar"],
        fallbackLocale: "en-NZ",
        rtlLocales: ["ar"],
        namespaces: ["common"],
        keys: { common: { hello: "Hello" } },
        formatting: {
          dates: true,
          times: true,
          numbers: true,
          currencies: true,
          pluralization: true,
        },
        lazyLoading: true,
        persistedSelection: true,
        accessibleSelector: true,
      }).success,
    ).toBe(true);
  });
});

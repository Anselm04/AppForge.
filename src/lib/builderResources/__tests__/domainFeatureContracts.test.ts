import { describe, expect, it } from "vitest";
import { BUILD_CAPABILITY_IDS } from "../../buildCapabilities.js";
import {
  DOMAIN_FEATURE_CONTRACTS,
  domainFeatureIds,
  validateDomainFeaturePack,
} from "../domainFeatureContracts.js";

const CRITICAL_FEATURES = {
  web_search: [
    "official-documentation-search",
    "api-documentation-search",
    "security-advisory-research",
    "citation-provenance",
    "source-conflict-detection",
    "research-cache",
  ],
  graphics: [
    "design-tokens",
    "responsive-layouts",
    "accessible-color-contrast",
    "configurable-design-families",
    "image-asset-pipeline",
  ],
  video: [
    "storyboard-model",
    "timeline-model",
    "captions",
    "transitions",
    "export-manifest",
    "media-player-component",
  ],
  music: [
    "audio-player",
    "waveform-hooks",
    "lyric-display",
    "simple-sequencing",
    "narration-integration",
    "rights-metadata",
  ],
  marketing: [
    "lead-capture",
    "newsletter-signup",
    "seo-metadata",
    "sitemap-generation",
    "email-campaign-structures",
    "consent-cookie-hooks",
  ],
  ar: [
    "camera-permission-flow",
    "webxr-bootstrap",
    "hit-testing",
    "3d-viewer-fallback",
    "scene-lifecycle",
    "device-capability-checks",
  ],
  education: [
    "course-model",
    "assessment-engine",
    "grading-gradebook",
    "assignments-submissions",
    "guardian-parent-roles",
    "school-organization-tenancy",
  ],
  patent: [
    "invention-description-schema",
    "novelty-analysis-structure",
    "prior-art-research-workflow",
    "claims-workspace",
    "jurisdiction-configuration",
    "attorney-review-checkpoints",
  ],
  architecture: [
    "zoning-research",
    "floor-plan-data-model",
    "bim-entity-model",
    "clash-detection",
    "construction-documents",
    "rfis",
    "handover",
    "approvals",
  ],
  game: [
    "game-loop",
    "input-abstraction",
    "physics-hooks",
    "collision",
    "save-load",
    "multiplayer-hooks",
    "deterministic-test-harness",
  ],
  cad: [
    "dimensions",
    "mesh-metadata",
    "assemblies",
    "gltf-glb-pipeline",
    "threejs-preview",
    "tolerances",
    "bom-concepts",
  ],
  legal: [
    "privacy-policy",
    "terms",
    "nda",
    "data-processing-terms",
    "acceptable-use-policy",
    "jurisdiction-metadata",
  ],
  fintech: [
    "subscriptions",
    "entitlements",
    "webhook-processing",
    "idempotency",
    "ledger-abstractions",
    "refunds",
    "reconciliation",
    "payment-failure-handling",
    "kyc-field-structures",
  ],
  healthcare: [
    "consent",
    "access-control-patterns",
    "sensitive-data-boundaries",
    "audit-logs",
    "encryption-requirements",
    "secure-messaging",
    "notification-privacy",
    "clinic-tenant-boundaries",
  ],
  mobile: [
    "flutter-support",
    "android-support",
    "ios-support",
    "secure-token-storage",
    "api-client",
    "offline-cache",
    "deep-linking",
    "push-notifications",
    "background-jobs",
    "biometrics",
    "app-lifecycle",
    "mobile-accessibility",
    "crash-reporting",
    "mobile-packaging",
    "release-configuration",
  ],
  voice: [
    "speech-input",
    "tts-output",
    "conversational-confirmation",
    "interruption-handling",
    "cancellation",
    "confidence-thresholds",
    "transcript-storage-rules",
    "siri-app-intents",
    "android-voice-actions",
  ],
  data: [
    "relational-schema-patterns",
    "kpi-framework",
    "data-tables",
    "sorting",
    "pagination",
    "scheduled-reports",
    "etl-hooks",
    "realtime-updates",
    "row-level-ownership",
  ],
  localization: [
    "translation-key-architecture",
    "locale-detection",
    "fallback-locale",
    "currency-formatting",
    "pluralization",
    "rtl",
    "lazy-locale-loading",
    "accessible-language-selection",
  ],
  collab: [
    "rooms",
    "presence",
    "collaborative-editing",
    "optimistic-updates",
    "conflict-resolution",
    "version-history",
    "websocket-abstraction",
    "offline-recovery",
    "event-ordering",
    "shared-assets",
  ],
} as const;

describe("substantive Builder Resource domain feature contracts", () => {
  it("covers every existing AppForge capability category with machine-readable contracts", () => {
    expect(Object.keys(DOMAIN_FEATURE_CONTRACTS).sort()).toEqual(
      [...BUILD_CAPABILITY_IDS].sort(),
    );

    for (const capability of BUILD_CAPABILITY_IDS) {
      const pack = validateDomainFeaturePack(
        capability,
        DOMAIN_FEATURE_CONTRACTS[capability],
      );
      expect(pack.features.length).toBeGreaterThanOrEqual(10);
      expect(new Set(pack.features.map((item) => item.featureId)).size).toBe(
        pack.features.length,
      );
      for (const item of pack.features) {
        expect(item.configurationKeys.length).toBeGreaterThan(0);
        expect(item.adaptationHooks.length).toBeGreaterThan(0);
        expect(item.testObligations.length).toBeGreaterThan(0);
        expect(item.securityObligations.length).toBeGreaterThan(0);
      }
    }
  });

  it("preserves the critical requested feature set instead of category-name placeholders", () => {
    for (const capability of BUILD_CAPABILITY_IDS) {
      const actual = new Set(domainFeatureIds(capability));
      for (const required of CRITICAL_FEATURES[capability]) {
        expect(actual.has(required), `${capability}:${required}`).toBe(true);
      }
    }
  });
});

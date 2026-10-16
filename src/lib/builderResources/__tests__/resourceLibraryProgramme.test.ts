import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALL_BUILDER_RESOURCES,
  builderResourceLibraryCounts,
  createBuilderResourceLibraryRegistry,
} from "../builderResourceLibrary.js";
import { composeBuilderResources } from "../resourceComposition.js";
import { answerBuilderResourceDiscoveryQuestion } from "../resourceDiscovery.js";
import { benchmarkMetadataFirstRetrieval } from "../resourcePerformance.js";
import {
  assertPromotionCandidateSanitized,
  prepareResourcePromotionCandidate,
} from "../resourcePromotion.js";

function resources(ids: string[]) {
  const registry = createBuilderResourceLibraryRegistry();
  const byId = new Map(
    registry.list().map((resource) => [resource.identity.resourceId, resource]),
  );
  return ids.map((id) => {
    const resource = byId.get(id);
    if (!resource) throw new Error(`missing test resource ${id}`);
    return resource;
  });
}

describe("Builder Resource Library programme", () => {
  it("is substantial, private, versioned and entirely export-independent", () => {
    const counts = builderResourceLibraryCounts();
    expect(counts.total).toBeGreaterThan(50);
    expect(counts.byType.module).toBeGreaterThan(10);
    expect(counts.byType.domain_pack).toBeGreaterThan(19);
    for (const resource of ALL_BUILDER_RESOURCES) {
      expect(resource.identity.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(resource.governance.allowedUse).toContain("internal-generation");
      expect(resource.implementation.requiresLiveLibraryAtRuntime).toBe(false);
    }
  });

  it("does not claim stronger maturity than recorded evidence permits", () => {
    for (const resource of ALL_BUILDER_RESOURCES) {
      if (resource.governance.maturityState === "production-certified") {
        expect(resource.evidence.adapterEvidence.reproducibleBuild).toBe(true);
        expect(resource.evidence.adapterEvidence.behavioralVerified).toBe(true);
        expect(resource.evidence.adapterEvidence.securityScanVerified).toBe(
          true,
        );
      }
    }
  });

  it("references repository-owned source paths rather than marketing-only names", () => {
    const missing = ALL_BUILDER_RESOURCES.flatMap((resource) =>
      resource.implementation.sourcePaths
        .filter((path) => !existsSync(path))
        .map((path) => `${resource.identity.resourceId}:${path}`),
    );
    expect(missing).toEqual([]);
  });

  it("answers machine-readable discovery questions with maturity and evidence", () => {
    const auth = answerBuilderResourceDiscoveryQuestion({
      capability: "authentication",
      technologyStack: "flutter-node",
      platform: "android",
    });
    expect(auth.available).toBe(true);
    expect(auth.candidates[0]?.resourceId).toBeTruthy();
    expect(auth.candidates[0]?.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(auth.candidates[0]?.maturity).toBeTruthy();
  });

  it("uses metadata-first retrieval rather than loading the entire private warehouse", () => {
    const benchmark = benchmarkMetadataFirstRetrieval({
      registry: createBuilderResourceLibraryRegistry(),
      query: { requiredCapabilities: ["authentication"] },
      limit: 1,
      now: (() => {
        let tick = 0;
        return () => tick++;
      })(),
    });
    expect(benchmark.catalogSize).toBeGreaterThan(50);
    expect(benchmark.resourceContentLoads).toBe(1);
    expect(benchmark.avoidedContentLoads).toBe(
      benchmark.catalogSize - benchmark.resourceContentLoads,
    );
    expect(benchmark.avoidedLoadPercent).toBeGreaterThan(90);
  });
});

describe("required cross-resource compositions", () => {
  const combinations: Array<[string, string[]]> = [
    ["AUTH + BILLING", ["core.authentication", "core.billing"]],
    [
      "AUTH + MULTITENANCY",
      ["core.authentication", "core.authorization", "core.database"],
    ],
    ["AUTH + REALTIME", ["core.authentication", "capability.collab"]],
    ["BILLING + WEBHOOKS", ["core.billing", "core.webhooks"]],
    ["MOBILE + PUSH", ["capability.mobile", "core.notifications"]],
    ["MOBILE + VOICE", ["capability.mobile", "capability.voice"]],
    [
      "BOOKING + JOBS + PUSH",
      ["core.database", "core.background-jobs", "core.notifications"],
    ],
    [
      "EDUCATION + VIDEO + AR",
      ["capability.education", "capability.video", "capability.ar"],
    ],
    [
      "MARKETPLACE + PAYMENTS + MESSAGING",
      ["core.authentication", "core.billing", "capability.collab"],
    ],
    [
      "FINTECH + AUDIT + SECURITY",
      ["capability.fintech", "core.observability", "core.security"],
    ],
    [
      "HEALTHCARE + ACCESS + AUDIT",
      ["capability.healthcare", "core.authorization", "core.observability"],
    ],
    ["GAME + INPUT + SAVE", ["capability.game", "core.storage"]],
    [
      "LOCALIZATION + RTL + FORMS",
      ["capability.localization", "design.controls"],
    ],
  ];

  for (const [name, ids] of combinations) {
    it(`composes ${name} without hidden conflicts`, () => {
      const composition = composeBuilderResources(resources(ids));
      expect(
        composition.conflicts,
        JSON.stringify(composition.conflicts),
      ).toEqual([]);
      expect(composition.ok).toBe(true);
    });
  }
});

describe("safe promotion from successful customer builds", () => {
  it("never automatically promotes and blocks secrets or identifiable customer content", () => {
    const template = ALL_BUILDER_RESOURCES[0];
    if (!template) throw new Error("catalog unexpectedly empty");
    const candidate = prepareResourcePromotionCandidate({
      generalizedFiles: {
        "src/resource.ts": "export const token = 'sk_live_ABC123456789';",
      },
      proposedManifest: template,
    });
    expect(candidate.automaticPromotionAllowed).toBe(false);
    expect(candidate.scan.safe).toBe(false);
    expect(() => assertPromotionCandidateSanitized(candidate)).toThrow(
      /sanitization findings/i,
    );
  });

  it("allows a sanitized candidate to proceed only to human/review gates", () => {
    const template = ALL_BUILDER_RESOURCES[0];
    if (!template) throw new Error("catalog unexpectedly empty");
    const candidate = prepareResourcePromotionCandidate({
      generalizedFiles: {
        "src/resource.ts":
          "export function validate(value: string) { return value.trim(); }",
      },
      proposedManifest: template,
    });
    expect(candidate.scan.safe).toBe(true);
    expect(candidate.requiredReviews).toContain("license-review");
    expect(candidate.requiredReviews).toContain("security-review");
    expect(() => assertPromotionCandidateSanitized(candidate)).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  detectResearchClaimConflicts,
  isResearchCacheFresh,
  rankResearchSources,
  summarizeResearchEvidence,
  type ResearchSourceRecord,
} from "../researchResource.js";

const official: ResearchSourceRecord = {
  url: "https://docs.example.test/sdk",
  title: "Official SDK docs",
  authority: "official",
  retrievedAt: "2026-10-16T00:00:00.000Z",
  publishedAt: "2026-10-15T00:00:00.000Z",
  claims: ["SDK supports Android 16"],
  provenanceHash: "official-hash",
};

const community: ResearchSourceRecord = {
  url: "https://community.example.test/thread",
  title: "Community thread",
  authority: "community",
  retrievedAt: "2026-10-16T00:00:00.000Z",
  publishedAt: "2026-10-16T00:00:00.000Z",
  claims: ["SDK does not support Android 16"],
  provenanceHash: "community-hash",
};

describe("research Builder Resource", () => {
  it("prefers authoritative official sources without discarding freshness metadata", () => {
    expect(
      rankResearchSources([community, official], "2026-10-16T12:00:00.000Z")[0]
        ?.url,
    ).toBe(official.url);
    expect(
      summarizeResearchEvidence({
        sources: [official],
        now: "2026-10-16T00:00:00.000Z",
      }).freshness[0]?.ageDays,
    ).toBe(1);
  });

  it("detects conflicting source claims instead of silently picking one", () => {
    expect(detectResearchClaimConflicts([official, community])).toEqual([
      expect.objectContaining({
        sourceUrls: [community.url, official.url].sort(),
        variants: [
          "SDK does not support Android 16",
          "SDK supports Android 16",
        ].sort(),
      }),
    ]);
  });

  it("uses explicit research-cache expiry rather than hard-coding stale answers", () => {
    const entry = {
      key: "sdk-compatibility",
      value: { supported: true },
      retrievedAt: "2026-10-16T00:00:00.000Z",
      expiresAt: "2026-10-17T00:00:00.000Z",
      sourceUrls: [official.url],
    };
    expect(isResearchCacheFresh(entry, "2026-10-16T12:00:00.000Z")).toBe(true);
    expect(isResearchCacheFresh(entry, "2026-10-17T00:00:00.000Z")).toBe(false);
  });
});

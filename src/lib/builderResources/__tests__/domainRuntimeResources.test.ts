import { describe, expect, it } from "vitest";
import {
  ResearchResultCache,
  aggregateNumbers,
  appendIdempotentLedgerEntry,
  authorizeHealthRecordAccess,
  buildBillOfMaterials,
  buildCampaignAttribution,
  buildCaptionCues,
  buildMobilePermissionPlan,
  buildSeoMetadata,
  buildVideoTimeline,
  chooseArExperience,
  convertCadLength,
  courseProgressPercent,
  createHealthAuditEvent,
  deserializeGameState,
  detectBimClashes,
  detectResearchClaimConflicts,
  evaluateVoiceCommand,
  gradeAssessment,
  isRtlLocale,
  mergeDesignTokens,
  orderCollaborationEvents,
  paginateRows,
  playlistDurationMs,
  rankResearchSources,
  reduceGameState,
  renderLegalScaffold,
  resolveDeepLink,
  resolveLastWriteWins,
  revisePatentWorkspace,
  sequenceAudioTracks,
  serializeGameState,
  translateWithFallback,
} from "../domainRuntimeResources.js";

describe("substantive reusable domain runtime resources", () => {
  it("ranks research evidence, detects conflict and expires cached evidence", () => {
    const sources = [
      {
        url: "https://community.example/a",
        authority: "community" as const,
        publishedAt: "2026-10-01T00:00:00.000Z",
        claim: "SDK supports Android",
      },
      {
        url: "https://official.example/docs",
        authority: "official" as const,
        publishedAt: "2026-09-01T00:00:00.000Z",
        claim: "SDK does not support Android",
      },
    ];
    expect(rankResearchSources(sources)[0]?.authority).toBe("official");
    expect(detectResearchClaimConflicts(sources)).toHaveLength(1);
    const cache = new ResearchResultCache<string>();
    cache.set("sdk", "fresh", 100, 1_000);
    expect(cache.get("sdk", 1_050)).toBe("fresh");
    expect(cache.get("sdk", 1_101)).toBeNull();
  });

  it("adapts design tokens and responsive layout without imposing one style", () => {
    const tokens = mergeDesignTokens(
      {
        spacing: { sm: 8 },
        typography: { body: "Inter" },
        radius: { card: 8 },
        colors: { surface: "#fff" },
      },
      { typography: { body: "System" }, radius: { card: 20 } },
    );
    expect(tokens.typography.body).toBe("System");
    expect(tokens.radius.card).toBe(20);
    expect(tokens.spacing.sm).toBe(8);
  });

  it("builds deterministic video timelines and caption cues", () => {
    const scenes = [
      { id: "s1", durationMs: 1_000, caption: "Hello" },
      { id: "s2", durationMs: 500 },
    ];
    expect(buildVideoTimeline(scenes)[1]).toMatchObject({
      startMs: 1_000,
      endMs: 1_500,
    });
    expect(buildCaptionCues(scenes)).toEqual([
      { sceneId: "s1", startMs: 0, endMs: 1_000, text: "Hello" },
    ]);
  });

  it("sequences audio and calculates playlist duration", () => {
    const tracks = [
      { id: "a", durationMs: 1_000, bpm: 120 },
      { id: "b", durationMs: 500, key: "C" },
    ];
    expect(sequenceAudioTracks(tracks)[1]?.startMs).toBe(1_000);
    expect(playlistDurationMs(tracks)).toBe(1_500);
  });

  it("builds reusable marketing SEO and campaign attribution", () => {
    expect(
      buildSeoMetadata({
        title: "Product",
        description: "Useful product",
        canonicalUrl: "https://example.test/product",
      }).openGraph.url,
    ).toBe("https://example.test/product");
    expect(
      buildCampaignAttribution({
        source: "newsletter",
        medium: "email",
        campaign: "launch",
      }),
    ).toMatchObject({ utm_source: "newsletter", utm_campaign: "launch" });
  });

  it("falls AR back safely when platform capabilities are unavailable", () => {
    expect(
      chooseArExperience({
        cameraGranted: false,
        webXrSupported: true,
        modelViewerSupported: true,
      }),
    ).toBe("3d-viewer");
    expect(
      chooseArExperience({
        cameraGranted: false,
        webXrSupported: false,
        modelViewerSupported: false,
      }),
    ).toBe("static-fallback");
  });

  it("calculates education progress and assessment outcomes", () => {
    expect(
      courseProgressPercent({
        lessonIds: ["l1", "l2", "l3", "l4"],
        completedLessonIds: ["l1", "l4", "unknown"],
      }),
    ).toBe(50);
    expect(
      gradeAssessment({ earnedPoints: 8, possiblePoints: 10, passPercent: 70 }),
    ).toEqual({ percent: 80, passed: true });
  });

  it("versions patent workspaces and preserves qualified review gates", () => {
    const revised = revisePatentWorkspace(
      {
        revision: 2,
        specification: "v2",
        claims: ["claim 1"],
        figureReferences: ["FIG-1"],
        reviewRequired: true,
      },
      { specification: "v3" },
    );
    expect(revised.revision).toBe(3);
    expect(revised.reviewRequired).toBe(true);
  });

  it("detects simple BIM bounding-box clashes", () => {
    expect(
      detectBimClashes([
        { id: "duct", min: [0, 0, 0], max: [2, 2, 2] },
        { id: "beam", min: [1, 1, 1], max: [3, 3, 3] },
        { id: "wall", min: [10, 10, 10], max: [11, 11, 11] },
      ]),
    ).toEqual([{ leftId: "duct", rightId: "beam" }]);
  });

  it("provides deterministic game state and save/load behavior", () => {
    const state = reduceGameState(
      { score: 0, level: 1, inventory: [], paused: false },
      { type: "inventory-add", item: "key" },
    );
    const scored = reduceGameState(state, { type: "score", points: 20 });
    expect(deserializeGameState(serializeGameState(scored))).toEqual({
      score: 20,
      level: 1,
      inventory: ["key"],
      paused: false,
    });
  });

  it("converts CAD units and produces deterministic BOMs", () => {
    expect(convertCadLength(1, "m", "mm")).toBe(1_000);
    expect(
      buildBillOfMaterials([
        { partNumber: "A", quantity: 2 },
        { partNumber: "A", quantity: 3 },
        { partNumber: "B", quantity: 1 },
      ]),
    ).toEqual([
      { partNumber: "A", quantity: 5 },
      { partNumber: "B", quantity: 1 },
    ]);
  });

  it("renders editable legal scaffolds with mandatory qualified-review metadata", () => {
    expect(
      renderLegalScaffold({
        jurisdiction: "NZ",
        documentType: "privacy-policy",
        sections: [{ heading: "Data", body: "Describe processing." }],
      }).qualifiedReviewRequired,
    ).toBe(true);
  });

  it("deduplicates fintech ledger events by idempotency key", () => {
    const entry = {
      id: "ledger-1",
      idempotencyKey: "evt-1",
      debitAccountId: "cash",
      creditAccountId: "revenue",
      amountMinor: 999,
      currency: "NZD",
    };
    const once = appendIdempotentLedgerEntry([], entry);
    expect(
      appendIdempotentLedgerEntry(once, { ...entry, id: "ledger-2" }),
    ).toEqual(once);
  });

  it("enforces healthcare tenant boundaries and emits immutable audit events", () => {
    expect(
      authorizeHealthRecordAccess({
        role: "provider",
        action: "read",
        rules: [{ role: "provider", action: "read", allowed: true }],
        subjectTenantId: "clinic-a",
        actorTenantId: "clinic-b",
      }),
    ).toEqual({ allowed: false, reason: "tenant-boundary" });
    expect(
      createHealthAuditEvent({
        actorId: "provider-1",
        action: "read",
        resourceId: "record-1",
        at: "2026-10-16T00:00:00.000Z",
      }).immutable,
    ).toBe(true);
  });

  it("orders mobile permission requests and resolves deep links", () => {
    expect(
      buildMobilePermissionPlan([
        { capability: "camera", required: false, rationale: "Scan receipt" },
        { capability: "location", required: true, rationale: "Find venue" },
      ])[0]?.capability,
    ).toBe("location");
    expect(
      resolveDeepLink("app://booking/42", [
        { pattern: /^app:\/\/booking\//, route: "/booking/:id" },
      ]),
    ).toBe("/booking/:id");
  });

  it("requires confirmation for sensitive voice actions and ignores weak recognition", () => {
    expect(
      evaluateVoiceCommand({
        intent: "book",
        confidence: 0.95,
        threshold: 0.8,
        confirmationRequiredIntents: ["book"],
      }),
    ).toEqual({ action: "confirm", intent: "book" });
    expect(
      evaluateVoiceCommand({
        intent: "book",
        confidence: 0.2,
        threshold: 0.8,
        confirmationRequiredIntents: ["book"],
      }).action,
    ).toBe("ignore");
  });

  it("paginates and aggregates reusable BI data", () => {
    expect(paginateRows([1, 2, 3, 4, 5], 2, 2)).toEqual({
      rows: [3, 4],
      page: 2,
      pageSize: 2,
      total: 5,
      pages: 3,
    });
    expect(aggregateNumbers([10, 20, 30], "average")).toBe(20);
  });

  it("uses locale fallback and RTL-language matching", () => {
    expect(
      translateWithFallback({
        bundle: { "en-NZ": { hello: "Hello" }, ar: {} },
        locale: "ar",
        fallbackLocale: "en-NZ",
        key: "hello",
      }),
    ).toBe("Hello");
    expect(isRtlLocale("ar-NZ", ["ar", "he"])).toBe(true);
  });

  it("orders realtime events deterministically and resolves last-write-wins", () => {
    const events = [
      { eventId: "e2", logicalClock: 2, actorId: "b", value: "second" },
      { eventId: "e1", logicalClock: 1, actorId: "a", value: "first" },
    ];
    expect(
      orderCollaborationEvents(events).map((event) => event.eventId),
    ).toEqual(["e1", "e2"]);
    expect(resolveLastWriteWins(events)?.value).toBe("second");
  });
});

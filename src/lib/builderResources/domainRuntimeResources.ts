export type ResearchSource = {
  url: string;
  authority: "official" | "primary" | "community" | "unknown";
  publishedAt?: string | null;
  claim: string;
};

const AUTHORITY_SCORE: Record<ResearchSource["authority"], number> = {
  official: 4,
  primary: 3,
  community: 2,
  unknown: 1,
};

export function rankResearchSources(
  sources: readonly ResearchSource[],
  nowMs = Date.now(),
): ResearchSource[] {
  return [...sources].sort((left, right) => {
    const authority = AUTHORITY_SCORE[right.authority] - AUTHORITY_SCORE[left.authority];
    if (authority !== 0) return authority;
    const leftAge = left.publishedAt
      ? Math.max(0, nowMs - Date.parse(left.publishedAt))
      : Number.POSITIVE_INFINITY;
    const rightAge = right.publishedAt
      ? Math.max(0, nowMs - Date.parse(right.publishedAt))
      : Number.POSITIVE_INFINITY;
    if (leftAge !== rightAge) return leftAge - rightAge;
    return left.url.localeCompare(right.url);
  });
}

export function detectResearchClaimConflicts(
  sources: readonly ResearchSource[],
): Array<{ urls: string[]; claims: string[] }> {
  const normalized = new Map<string, ResearchSource[]>();
  for (const source of sources) {
    const subject = source.claim
      .toLowerCase()
      .replace(/\b(?:is|are|was|were|supports?|does|doesn't|not|yes|no)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const entries = normalized.get(subject) ?? [];
    entries.push(source);
    normalized.set(subject, entries);
  }
  return [...normalized.values()]
    .filter((entries) => new Set(entries.map((entry) => entry.claim.toLowerCase())).size > 1)
    .map((entries) => ({
      urls: entries.map((entry) => entry.url).sort(),
      claims: [...new Set(entries.map((entry) => entry.claim))].sort(),
    }));
}

export class ResearchResultCache<T> {
  private readonly values = new Map<
    string,
    { value: T; storedAt: number; ttlMs: number }
  >();

  set(key: string, value: T, ttlMs: number, nowMs = Date.now()): void {
    if (ttlMs <= 0) throw new Error("Research cache TTL must be positive");
    this.values.set(key, { value, storedAt: nowMs, ttlMs });
  }

  get(key: string, nowMs = Date.now()): T | null {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (nowMs - entry.storedAt > entry.ttlMs) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }
}

export type DesignTokens = {
  spacing: Record<string, number>;
  typography: Record<string, string>;
  radius: Record<string, number>;
  colors: Record<string, string>;
};

export function mergeDesignTokens(
  base: DesignTokens,
  overrides: Partial<{ [K in keyof DesignTokens]: Partial<DesignTokens[K]> }>,
): DesignTokens {
  return {
    spacing: { ...base.spacing, ...overrides.spacing },
    typography: { ...base.typography, ...overrides.typography },
    radius: { ...base.radius, ...overrides.radius },
    colors: { ...base.colors, ...overrides.colors },
  };
}

export function responsiveColumnCount(widthPx: number): 1 | 2 | 3 | 4 {
  if (widthPx < 640) return 1;
  if (widthPx < 960) return 2;
  if (widthPx < 1280) return 3;
  return 4;
}

export type VideoScene = {
  id: string;
  durationMs: number;
  caption?: string;
};

export function buildVideoTimeline(scenes: readonly VideoScene[]): Array<
  VideoScene & { startMs: number; endMs: number }
> {
  let cursor = 0;
  return scenes.map((scene) => {
    if (scene.durationMs <= 0) throw new Error("Scene duration must be positive");
    const startMs = cursor;
    cursor += scene.durationMs;
    return { ...scene, startMs, endMs: cursor };
  });
}

export function buildCaptionCues(scenes: readonly VideoScene[]) {
  return buildVideoTimeline(scenes)
    .filter((scene) => Boolean(scene.caption?.trim()))
    .map((scene) => ({
      sceneId: scene.id,
      startMs: scene.startMs,
      endMs: scene.endMs,
      text: scene.caption!.trim(),
    }));
}

export type AudioTrack = {
  id: string;
  durationMs: number;
  bpm?: number | null;
  key?: string | null;
};

export function sequenceAudioTracks(tracks: readonly AudioTrack[]) {
  let cursor = 0;
  return tracks.map((track) => {
    if (track.durationMs < 0) throw new Error("Track duration cannot be negative");
    const startMs = cursor;
    cursor += track.durationMs;
    return { ...track, startMs, endMs: cursor };
  });
}

export function playlistDurationMs(tracks: readonly AudioTrack[]): number {
  return tracks.reduce((total, track) => total + Math.max(0, track.durationMs), 0);
}

export type SeoMetadataInput = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string | null;
};

export function buildSeoMetadata(input: SeoMetadataInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || !description) throw new Error("SEO title and description are required");
  return {
    title,
    description,
    canonical: input.canonicalUrl,
    openGraph: {
      title,
      description,
      url: input.canonicalUrl,
      image: input.imageUrl ?? null,
    },
  };
}

export function buildCampaignAttribution(input: {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}) {
  return {
    utm_source: input.source,
    utm_medium: input.medium,
    utm_campaign: input.campaign,
    ...(input.content ? { utm_content: input.content } : {}),
  };
}

export function chooseArExperience(input: {
  cameraGranted: boolean;
  webXrSupported: boolean;
  modelViewerSupported: boolean;
}): "ar" | "3d-viewer" | "static-fallback" {
  if (input.cameraGranted && input.webXrSupported) return "ar";
  if (input.modelViewerSupported) return "3d-viewer";
  return "static-fallback";
}

export function courseProgressPercent(input: {
  lessonIds: readonly string[];
  completedLessonIds: readonly string[];
}): number {
  if (input.lessonIds.length === 0) return 0;
  const lessons = new Set(input.lessonIds);
  const complete = new Set(
    input.completedLessonIds.filter((lessonId) => lessons.has(lessonId)),
  );
  return Math.round((complete.size / lessons.size) * 100);
}

export function gradeAssessment(input: {
  earnedPoints: number;
  possiblePoints: number;
  passPercent: number;
}) {
  if (input.possiblePoints <= 0) throw new Error("Assessment must have possible points");
  const percent = Math.max(
    0,
    Math.min(100, (input.earnedPoints / input.possiblePoints) * 100),
  );
  return { percent, passed: percent >= input.passPercent };
}

export type PatentWorkspaceRevision = {
  revision: number;
  specification: string;
  claims: string[];
  figureReferences: string[];
  reviewRequired: true;
};

export function revisePatentWorkspace(
  current: PatentWorkspaceRevision,
  patch: Partial<Pick<PatentWorkspaceRevision, "specification" | "claims" | "figureReferences">>,
): PatentWorkspaceRevision {
  return {
    revision: current.revision + 1,
    specification: patch.specification ?? current.specification,
    claims: [...(patch.claims ?? current.claims)],
    figureReferences: [...(patch.figureReferences ?? current.figureReferences)],
    reviewRequired: true,
  };
}

export type Box3 = {
  id: string;
  min: [number, number, number];
  max: [number, number, number];
};

function boxesIntersect(left: Box3, right: Box3): boolean {
  return left.min.every(
    (value, axis) => value < right.max[axis] && left.max[axis] > right.min[axis],
  );
}

export function detectBimClashes(boxes: readonly Box3[]) {
  const clashes: Array<{ leftId: string; rightId: string }> = [];
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      if (boxesIntersect(boxes[leftIndex], boxes[rightIndex])) {
        clashes.push({
          leftId: boxes[leftIndex].id,
          rightId: boxes[rightIndex].id,
        });
      }
    }
  }
  return clashes;
}

export type GameState = {
  score: number;
  level: number;
  inventory: string[];
  paused: boolean;
};

export type GameAction =
  | { type: "score"; points: number }
  | { type: "level-up" }
  | { type: "inventory-add"; item: string }
  | { type: "pause"; paused: boolean };

export function reduceGameState(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "score":
      return { ...state, score: state.score + action.points };
    case "level-up":
      return { ...state, level: state.level + 1 };
    case "inventory-add":
      return { ...state, inventory: [...state.inventory, action.item] };
    case "pause":
      return { ...state, paused: action.paused };
  }
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(serialized: string): GameState {
  const parsed = JSON.parse(serialized) as Partial<GameState>;
  if (
    typeof parsed.score !== "number" ||
    typeof parsed.level !== "number" ||
    !Array.isArray(parsed.inventory) ||
    typeof parsed.paused !== "boolean"
  ) {
    throw new Error("Invalid saved game state");
  }
  return parsed as GameState;
}

const MILLIMETERS_PER_UNIT = {
  mm: 1,
  cm: 10,
  m: 1_000,
  in: 25.4,
  ft: 304.8,
} as const;

export type CadUnit = keyof typeof MILLIMETERS_PER_UNIT;

export function convertCadLength(
  value: number,
  from: CadUnit,
  to: CadUnit,
): number {
  return (value * MILLIMETERS_PER_UNIT[from]) / MILLIMETERS_PER_UNIT[to];
}

export function buildBillOfMaterials(
  components: readonly { partNumber: string; quantity: number }[],
) {
  const quantities = new Map<string, number>();
  for (const component of components) {
    if (component.quantity <= 0) throw new Error("BOM quantities must be positive");
    quantities.set(
      component.partNumber,
      (quantities.get(component.partNumber) ?? 0) + component.quantity,
    );
  }
  return [...quantities.entries()]
    .map(([partNumber, quantity]) => ({ partNumber, quantity }))
    .sort((left, right) => left.partNumber.localeCompare(right.partNumber));
}

export type LegalScaffold = {
  jurisdiction: string;
  documentType: string;
  sections: Array<{ heading: string; body: string }>;
  qualifiedReviewRequired: true;
};

export function renderLegalScaffold(input: {
  jurisdiction: string;
  documentType: string;
  sections: Array<{ heading: string; body: string }>;
}): LegalScaffold {
  if (!input.jurisdiction.trim() || !input.documentType.trim()) {
    throw new Error("Legal scaffold requires jurisdiction and document type");
  }
  return {
    jurisdiction: input.jurisdiction.trim(),
    documentType: input.documentType.trim(),
    sections: input.sections.map((section) => ({
      heading: section.heading.trim(),
      body: section.body,
    })),
    qualifiedReviewRequired: true,
  };
}

export type LedgerEntry = {
  id: string;
  idempotencyKey: string;
  debitAccountId: string;
  creditAccountId: string;
  amountMinor: number;
  currency: string;
};

export function appendIdempotentLedgerEntry(
  entries: readonly LedgerEntry[],
  entry: LedgerEntry,
): LedgerEntry[] {
  if (entry.amountMinor <= 0) throw new Error("Ledger amount must be positive");
  const duplicate = entries.find(
    (candidate) => candidate.idempotencyKey === entry.idempotencyKey,
  );
  if (duplicate) return [...entries];
  return [...entries, { ...entry }];
}

export type HealthAccessRule = {
  role: string;
  action: "read" | "write" | "delete";
  allowed: boolean;
};

export function authorizeHealthRecordAccess(input: {
  role: string;
  action: HealthAccessRule["action"];
  rules: readonly HealthAccessRule[];
  subjectTenantId: string;
  actorTenantId: string;
}) {
  if (input.subjectTenantId !== input.actorTenantId) {
    return { allowed: false, reason: "tenant-boundary" } as const;
  }
  const rule = input.rules.find(
    (candidate) =>
      candidate.role === input.role && candidate.action === input.action,
  );
  return rule?.allowed
    ? ({ allowed: true, reason: "role-policy" } as const)
    : ({ allowed: false, reason: "role-policy" } as const);
}

export function createHealthAuditEvent(input: {
  actorId: string;
  action: string;
  resourceId: string;
  at: string;
}) {
  return { ...input, immutable: true as const };
}

export type MobilePermissionRequest = {
  capability: string;
  required: boolean;
  rationale: string;
};

export function buildMobilePermissionPlan(
  requests: readonly MobilePermissionRequest[],
) {
  return [...requests]
    .filter((request) => request.rationale.trim().length > 0)
    .sort((left, right) => Number(right.required) - Number(left.required));
}

export function resolveDeepLink(
  url: string,
  routes: readonly { pattern: RegExp; route: string }[],
): string | null {
  const match = routes.find((candidate) => candidate.pattern.test(url));
  return match?.route ?? null;
}

export type VoiceCommandDecision =
  | { action: "ignore"; reason: "low-confidence" }
  | { action: "confirm"; intent: string }
  | { action: "execute"; intent: string };

export function evaluateVoiceCommand(input: {
  intent: string;
  confidence: number;
  threshold: number;
  confirmationRequiredIntents: readonly string[];
}): VoiceCommandDecision {
  if (input.confidence < input.threshold) {
    return { action: "ignore", reason: "low-confidence" };
  }
  if (input.confirmationRequiredIntents.includes(input.intent)) {
    return { action: "confirm", intent: input.intent };
  }
  return { action: "execute", intent: input.intent };
}

export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): { rows: T[]; page: number; pageSize: number; total: number; pages: number } {
  if (page < 1 || pageSize < 1) throw new Error("Pagination values must be positive");
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page,
    pageSize,
    total: rows.length,
    pages: Math.ceil(rows.length / pageSize),
  };
}

export function aggregateNumbers(
  values: readonly number[],
  mode: "sum" | "average" | "min" | "max",
): number | null {
  if (values.length === 0) return null;
  if (mode === "sum") return values.reduce((total, value) => total + value, 0);
  if (mode === "average") {
    return values.reduce((total, value) => total + value, 0) / values.length;
  }
  if (mode === "min") return Math.min(...values);
  return Math.max(...values);
}

export type TranslationBundle = Record<string, Record<string, string>>;

export function translateWithFallback(input: {
  bundle: TranslationBundle;
  locale: string;
  fallbackLocale: string;
  key: string;
}): string | null {
  return (
    input.bundle[input.locale]?.[input.key] ??
    input.bundle[input.fallbackLocale]?.[input.key] ??
    null
  );
}

export function isRtlLocale(locale: string, rtlLocales: readonly string[]): boolean {
  const language = locale.toLowerCase().split("-")[0];
  return rtlLocales.some(
    (candidate) => candidate.toLowerCase().split("-")[0] === language,
  );
}

export type CollaborationEvent<T = unknown> = {
  eventId: string;
  logicalClock: number;
  actorId: string;
  value: T;
};

export function orderCollaborationEvents<T>(
  events: readonly CollaborationEvent<T>[],
): CollaborationEvent<T>[] {
  return [...events].sort((left, right) => {
    if (left.logicalClock !== right.logicalClock) {
      return left.logicalClock - right.logicalClock;
    }
    const actor = left.actorId.localeCompare(right.actorId);
    if (actor !== 0) return actor;
    return left.eventId.localeCompare(right.eventId);
  });
}

export function resolveLastWriteWins<T>(
  events: readonly CollaborationEvent<T>[],
): CollaborationEvent<T> | null {
  return orderCollaborationEvents(events).at(-1) ?? null;
}

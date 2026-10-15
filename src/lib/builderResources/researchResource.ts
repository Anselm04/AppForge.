export type ResearchAuthority =
  "official" | "primary" | "secondary" | "community";

export type ResearchSourceRecord = {
  url: string;
  title: string;
  authority: ResearchAuthority;
  retrievedAt: string;
  publishedAt: string | null;
  claims: string[];
  provenanceHash: string;
};

const AUTHORITY_SCORE: Record<ResearchAuthority, number> = {
  official: 400,
  primary: 300,
  secondary: 200,
  community: 100,
};

export function rankResearchSources(
  sources: readonly ResearchSourceRecord[],
  nowIso: string,
): ResearchSourceRecord[] {
  const now = Date.parse(nowIso);
  return [...sources].sort((left, right) => {
    const score = (source: ResearchSourceRecord) => {
      const published = source.publishedAt
        ? Date.parse(source.publishedAt)
        : Date.parse(source.retrievedAt);
      const ageDays =
        Number.isFinite(published) && Number.isFinite(now)
          ? Math.max(0, (now - published) / 86_400_000)
          : 3650;
      const freshness = Math.max(0, 100 - Math.min(100, ageDays));
      return AUTHORITY_SCORE[source.authority] + freshness;
    };
    const scoreDelta = score(right) - score(left);
    return scoreDelta !== 0 ? scoreDelta : left.url.localeCompare(right.url);
  });
}

export type ResearchClaimConflict = {
  normalizedClaim: string;
  sourceUrls: string[];
  variants: string[];
};

function claimKey(claim: string): string {
  return claim
    .toLowerCase()
    .replace(
      /\b(?:does|do|did|is|are|was|were|not|no|never|unsupported|supported|supports?|supporting|support)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function detectResearchClaimConflicts(
  sources: readonly ResearchSourceRecord[],
): ResearchClaimConflict[] {
  const groups = new Map<
    string,
    { variants: Set<string>; sourceUrls: Set<string> }
  >();
  for (const source of sources) {
    for (const claim of source.claims) {
      const key = claimKey(claim);
      if (!key) continue;
      const group = groups.get(key) ?? {
        variants: new Set<string>(),
        sourceUrls: new Set<string>(),
      };
      group.variants.add(claim.trim());
      group.sourceUrls.add(source.url);
      groups.set(key, group);
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.variants.size > 1)
    .map(([normalizedClaim, group]) => ({
      normalizedClaim,
      sourceUrls: [...group.sourceUrls].sort(),
      variants: [...group.variants].sort(),
    }))
    .sort((left, right) =>
      left.normalizedClaim.localeCompare(right.normalizedClaim),
    );
}

export type ResearchCacheEntry<T> = {
  key: string;
  value: T;
  retrievedAt: string;
  expiresAt: string;
  sourceUrls: string[];
};

export function isResearchCacheFresh<T>(
  entry: ResearchCacheEntry<T>,
  nowIso: string,
): boolean {
  const now = Date.parse(nowIso);
  const expires = Date.parse(entry.expiresAt);
  return Number.isFinite(now) && Number.isFinite(expires) && now < expires;
}

export function summarizeResearchEvidence(input: {
  sources: readonly ResearchSourceRecord[];
  now: string;
}): {
  rankedSources: ResearchSourceRecord[];
  conflicts: ResearchClaimConflict[];
  freshness: Array<{ url: string; ageDays: number | null }>;
} {
  const now = Date.parse(input.now);
  return {
    rankedSources: rankResearchSources(input.sources, input.now),
    conflicts: detectResearchClaimConflicts(input.sources),
    freshness: input.sources.map((source) => {
      const timestamp = Date.parse(source.publishedAt ?? source.retrievedAt);
      return {
        url: source.url,
        ageDays:
          Number.isFinite(now) && Number.isFinite(timestamp)
            ? Math.max(0, (now - timestamp) / 86_400_000)
            : null,
      };
    }),
  };
}

export type OpportunityRecommendation =
  "BUILD" | "VALIDATE_MORE" | "DO_NOT_BUILD";

export type ConfidenceLevel = "high" | "medium" | "low";

export type OpportunityScores = {
  demand: number;
  monetization: number;
  differentiation: number;
  marketingReach: number;
  competition: number;
};

export type EvidenceBackedItem = {
  text: string;
  evidence: number[];
};

export type MonetizationOption = EvidenceBackedItem & {
  model: string;
  rationale: string;
};

export type PublishingReadiness = {
  web: string[];
  apple: string[];
  googlePlay: string[];
};

export type MarketingHandoff = {
  audience: string;
  positioning: string;
  hooks: string[];
  pains: string[];
  differentiators: string[];
  monetization: string[];
};

export type MarketIntelligenceAnalysis = {
  summary: EvidenceBackedItem;
  positioning: EvidenceBackedItem;
  customerPains: EvidenceBackedItem[];
  featureGaps: EvidenceBackedItem[];
  marketingHooks: EvidenceBackedItem[];
  monetization: MonetizationOption[];
  risks: EvidenceBackedItem[];
  scores: OpportunityScores;
  confidence: ConfidenceLevel;
  buildBrief: string;
  audience: string;
};

export type MarketIntelligenceSource = {
  id: number;
  title: string;
  url: string;
  snippet: string;
  source: string;
};

export type MarketIntelligenceReport = MarketIntelligenceAnalysis & {
  score: number;
  recommendation: OpportunityRecommendation;
  publishingReadiness: PublishingReadiness;
  marketingHandoff: MarketingHandoff;
  sources: MarketIntelligenceSource[];
  researchedAt: string;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calculateOpportunityScore(scores: OpportunityScores): number {
  const demand = clampScore(scores.demand);
  const monetization = clampScore(scores.monetization);
  const differentiation = clampScore(scores.differentiation);
  const marketingReach = clampScore(scores.marketingReach);
  const competition = clampScore(scores.competition);

  return Math.round(
    demand * 0.3 +
      monetization * 0.2 +
      differentiation * 0.2 +
      marketingReach * 0.15 +
      (100 - competition) * 0.15,
  );
}

export function recommendOpportunity(score: number): OpportunityRecommendation {
  const bounded = clampScore(score);
  if (bounded >= 70) return "BUILD";
  if (bounded >= 40) return "VALIDATE_MORE";
  return "DO_NOT_BUILD";
}

export function sanitizeEvidenceRefs(
  refs: number[],
  allowedSourceIds: ReadonlySet<number>,
): number[] {
  const seen = new Set<number>();
  return refs.filter((ref) => {
    if (!Number.isInteger(ref) || !allowedSourceIds.has(ref) || seen.has(ref)) {
      return false;
    }
    seen.add(ref);
    return true;
  });
}

export function sanitizeAnalysisEvidence(
  analysis: MarketIntelligenceAnalysis,
  sourceIds: ReadonlySet<number>,
): MarketIntelligenceAnalysis {
  const sanitizeItem = (item: EvidenceBackedItem): EvidenceBackedItem => ({
    ...item,
    evidence: sanitizeEvidenceRefs(item.evidence, sourceIds),
  });

  return {
    ...analysis,
    summary: sanitizeItem(analysis.summary),
    positioning: sanitizeItem(analysis.positioning),
    customerPains: analysis.customerPains.map(sanitizeItem),
    featureGaps: analysis.featureGaps.map(sanitizeItem),
    marketingHooks: analysis.marketingHooks.map(sanitizeItem),
    monetization: analysis.monetization.map((item) => ({
      ...item,
      evidence: sanitizeEvidenceRefs(item.evidence, sourceIds),
    })),
    risks: analysis.risks.map(sanitizeItem),
    scores: {
      demand: clampScore(analysis.scores.demand),
      monetization: clampScore(analysis.scores.monetization),
      differentiation: clampScore(analysis.scores.differentiation),
      marketingReach: clampScore(analysis.scores.marketingReach),
      competition: clampScore(analysis.scores.competition),
    },
  };
}

export function publishingReadinessForIdea(
  buildBrief: string,
): PublishingReadiness {
  const mobileIntent =
    /\b(ios|iphone|ipad|android|mobile|flutter|react native)\b/i.test(
      buildBrief,
    );

  return {
    web: [
      "Production build passes tests and security checks",
      "Public privacy policy and terms are live",
      "Production analytics, error monitoring, and support contact are configured",
      "Custom domain and TLS are verified",
    ],
    apple: mobileIntent
      ? [
          "Apple Developer membership is active",
          "Bundle ID, signing certificates, and provisioning are valid",
          "App Store Connect record, privacy disclosures, screenshots, and metadata are complete",
          "Release build is uploaded and passes App Store validation",
          "Human/App Review approval is still required before public availability",
        ]
      : [
          "Generate an iOS-capable product before preparing App Store submission",
        ],
    googlePlay: mobileIntent
      ? [
          "Google Play developer account is verified",
          "Application ID and Android signing key are configured",
          "Play Console listing, Data safety form, screenshots, and metadata are complete",
          "Signed Android App Bundle passes Play validation",
          "Google review/rollout requirements are still required before public availability",
        ]
      : [
          "Generate an Android-capable product before preparing Google Play submission",
        ],
  };
}

export function createMarketingHandoff(
  analysis: MarketIntelligenceAnalysis,
): MarketingHandoff {
  return {
    audience: analysis.audience,
    positioning: analysis.positioning.text,
    hooks: analysis.marketingHooks.map((item) => item.text),
    pains: analysis.customerPains.map((item) => item.text),
    differentiators: analysis.featureGaps.map((item) => item.text),
    monetization: analysis.monetization.map(
      (item) => `${item.model}: ${item.rationale}`,
    ),
  };
}

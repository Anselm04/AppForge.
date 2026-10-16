import type { CapabilityEvidence } from "./publicCapabilityClaims.js";

export type FeatureId =
  | "orchestrator"
  | "live-preview"
  | "deploy"
  | "database-wizard"
  | "templates"
  | "version-history"
  | "collaboration"
  | "analytics"
  | "billing"
  | "integrations"
  | "onboarding-assistant"
  | "changelog"
  | "shortcuts"
  | "health-scanner"
  | "cost-forecast"
  | "template-suggest"
  | "feedback-board"
  | "senior-dev"
  | "revenue-readiness";

export type FeatureMeta = {
  id: FeatureId;
  icon: string;
  i18nKey: string;
  appRoute?: string;
  category: "build" | "ship" | "team" | "grow" | "discover";
  evidence: CapabilityEvidence;
  evidenceRef: string;
};

const reviewed = (
  state: NonNullable<CapabilityEvidence["runtime"]>,
): CapabilityEvidence => ({
  adapter: state,
  resource: state,
  runtime: state,
  platform: state,
  regressionHealthy: true,
});

/**
 * Public feature evidence is deliberately conservative. These entries are not
 * marketing promises: claim rendering takes the least mature evidence
 * dimension and fails closed if any required dimension is missing. Production
 * wording requires production-certified evidence, never mere route presence.
 */
export const PLATFORM_FEATURES: FeatureMeta[] = [
  {
    id: "orchestrator",
    icon: "⚡",
    i18nKey: "features.orchestrator",
    appRoute: "/app/new",
    category: "build",
    evidence: reviewed("verified"),
    evidenceRef: "ProductContract/ProductPlan builder pipeline tests",
  },
  {
    id: "live-preview",
    icon: "👁",
    i18nKey: "features.livePreview",
    appRoute: "/build",
    category: "build",
    evidence: reviewed("runnable"),
    evidenceRef: "authenticated build runtime and preview path",
  },
  {
    id: "deploy",
    icon: "🚀",
    i18nKey: "features.deploy",
    appRoute: "/dashboard",
    category: "ship",
    evidence: reviewed("deployable"),
    evidenceRef: "deployment workflows and deployment evidence model",
  },
  {
    id: "database-wizard",
    icon: "🗄",
    i18nKey: "features.databaseWizard",
    appRoute: "/dashboard",
    category: "ship",
    evidence: reviewed("buildable"),
    evidenceRef: "database agent and migration safety foundation",
  },
  {
    id: "templates",
    icon: "📦",
    i18nKey: "features.templates",
    appRoute: "/templates",
    category: "build",
    evidence: reviewed("verified"),
    evidenceRef: "Builder Resource Library and template marketplace tests",
  },
  {
    id: "onboarding-assistant",
    icon: "✨",
    i18nKey: "features.onboardingAssistant",
    category: "discover",
    evidence: reviewed("structural"),
    evidenceRef: "feature structure present; end-to-end route not certified",
  },
  {
    id: "health-scanner",
    icon: "🛡",
    i18nKey: "features.healthScanner",
    category: "discover",
    evidence: reviewed("structural"),
    evidenceRef: "health/readiness primitives present; public workflow not certified",
  },
  {
    id: "feedback-board",
    icon: "💬",
    i18nKey: "features.feedbackBoard",
    category: "discover",
    evidence: reviewed("experimental"),
    evidenceRef: "public feedback workflow not production-certified",
  },
];

export function featurePath(id: FeatureId): string {
  return `/features/${id}`;
}

export function getFeature(id: FeatureId): FeatureMeta | undefined {
  return PLATFORM_FEATURES.find((f) => f.id === id);
}

export const SIDEBAR_GROUPS = [
  {
    key: "sidebar.build",
    ids: ["orchestrator", "live-preview", "templates"] as FeatureId[],
  },
  {
    key: "sidebar.discover",
    ids: [
      "onboarding-assistant",
      "health-scanner",
      "feedback-board",
    ] as FeatureId[],
  },
];

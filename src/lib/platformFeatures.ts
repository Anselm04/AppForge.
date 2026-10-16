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
  evidenceFresh: true,
  quarantined: false,
  versionMatches: true,
});

/**
 * Public feature evidence is deliberately conservative. These entries are not
 * marketing promises: claim rendering takes the least mature evidence
 * dimension and fails closed if any required dimension is missing. Production
 * wording requires production-certified evidence, never mere route presence.
 * reviewed() also records that the evidence is current, non-quarantined and
 * belongs to the advertised version; claim resolution fails closed when those
 * facts are absent or later regress.
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
    evidenceRef:
      "health/readiness primitives present; public workflow not certified",
  },
  {
    id: "feedback-board",
    icon: "💬",
    i18nKey: "features.feedbackBoard",
    category: "discover",
    evidence: reviewed("experimental"),
    evidenceRef: "public feedback workflow not production-certified",
  },
  {
    id: "version-history",
    icon: "🕘",
    i18nKey: "features.versionHistory",
    appRoute: "/dashboard",
    category: "ship",
    evidence: reviewed("verified"),
    evidenceRef: "snapshot persistence and rollback tests",
  },
  {
    id: "collaboration",
    icon: "👥",
    i18nKey: "features.collaboration",
    category: "team",
    evidence: reviewed("structural"),
    evidenceRef: "collaboration structures present; public workflow not certified",
  },
  {
    id: "analytics",
    icon: "📈",
    i18nKey: "features.analytics",
    appRoute: "/dashboard",
    category: "grow",
    evidence: reviewed("structural"),
    evidenceRef: "analytics integrations present; customer workflow not certified",
  },
  {
    id: "billing",
    icon: "💳",
    i18nKey: "features.billing",
    appRoute: "/pricing",
    category: "grow",
    evidence: reviewed("verified"),
    evidenceRef: "Stripe entitlement and webhook contract tests",
  },
  {
    id: "integrations",
    icon: "🔌",
    i18nKey: "features.integrations",
    appRoute: "/dashboard",
    category: "ship",
    evidence: reviewed("structural"),
    evidenceRef: "adapter registry; each integration keeps its own maturity",
  },
  {
    id: "changelog",
    icon: "📋",
    i18nKey: "features.changelog",
    category: "discover",
    evidence: reviewed("structural"),
    evidenceRef: "feature structure present; customer route not certified",
  },
  {
    id: "shortcuts",
    icon: "⌨️",
    i18nKey: "features.shortcuts",
    category: "discover",
    evidence: reviewed("structural"),
    evidenceRef: "feature structure present; customer route not certified",
  },
  {
    id: "cost-forecast",
    icon: "🧮",
    i18nKey: "features.costForecast",
    category: "grow",
    evidence: reviewed("structural"),
    evidenceRef: "cost estimation primitives present; public workflow not certified",
  },
  {
    id: "template-suggest",
    icon: "🧩",
    i18nKey: "features.templateSuggest",
    appRoute: "/templates",
    category: "build",
    evidence: reviewed("buildable"),
    evidenceRef: "Builder Resource Library selector and template foundations",
  },
  {
    id: "senior-dev",
    icon: "🧑‍💻",
    i18nKey: "features.seniorDev",
    appRoute: "/dashboard",
    category: "build",
    evidence: reviewed("buildable"),
    evidenceRef: "senior developer task model and agent workflow",
  },
  {
    id: "revenue-readiness",
    icon: "💰",
    i18nKey: "features.revenueReadiness",
    appRoute: "/dashboard",
    category: "grow",
    evidence: reviewed("buildable"),
    evidenceRef: "revenue readiness checks and billing foundations",
  },
];

export function featurePath(id: FeatureId): string {
  return `/features/${id}`;
}

export function getFeature(id: string): FeatureMeta | undefined {
  return PLATFORM_FEATURES.find((feature) => feature.id === id);
}

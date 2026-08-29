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
};

export const PLATFORM_FEATURES: FeatureMeta[] = [
  { id: "orchestrator", icon: "⚡", i18nKey: "features.orchestrator", appRoute: "/app/new", category: "build" },
  { id: "live-preview", icon: "👁", i18nKey: "features.livePreview", appRoute: "/build", category: "build" },
  { id: "deploy", icon: "🚀", i18nKey: "features.deploy", appRoute: "/dashboard", category: "ship" },
  { id: "database-wizard", icon: "🗄", i18nKey: "features.databaseWizard", appRoute: "/dashboard", category: "ship" },
  { id: "templates", icon: "📦", i18nKey: "features.templates", appRoute: "/templates", category: "build" },
  { id: "onboarding-assistant", icon: "✨", i18nKey: "features.onboardingAssistant", appRoute: "/onboarding", category: "discover" },
  { id: "health-scanner", icon: "🛡", i18nKey: "features.healthScanner", appRoute: "/app/health", category: "discover" },
  { id: "feedback-board", icon: "💬", i18nKey: "features.feedbackBoard", appRoute: "/feedback", category: "discover" },
];

export function featurePath(id: FeatureId): string {
  return `/features/${id}`;
}

export function getFeature(id: FeatureId): FeatureMeta | undefined {
  return PLATFORM_FEATURES.find((f) => f.id === id);
}

export const SIDEBAR_GROUPS = [
  { key: "sidebar.build", ids: ["orchestrator", "live-preview", "templates"] as FeatureId[] },
  { key: "sidebar.discover", ids: ["onboarding-assistant", "health-scanner", "feedback-board"] as FeatureId[] },
];

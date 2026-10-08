import { Link, Navigate, useParams } from "react-router-dom";
import { useLocale } from "../i18n/LocaleContext.js";
import {
  getFeature,
  type FeatureId,
  type FeatureMeta,
} from "../lib/platformFeatures.js";
import { isKnownAppRoute } from "../lib/appRoutes.js";
import { GlassCard } from "../design-system/GlassCard.js";

const CATEGORY_LABEL_KEY: Record<FeatureMeta["category"], string> = {
  build: "sidebar.build",
  ship: "sidebar.ship",
  team: "sidebar.team",
  grow: "sidebar.insights",
  discover: "sidebar.discover",
};

export function FeatureDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLocale();

  const feature = getFeature(id as FeatureId);
  if (!feature) return <Navigate to="/discover" replace />;

  const base = feature.i18nKey;

  /**
   * Copy is authored per feature and some entries only define title/hero, so
   * optional sections are rendered only when the translated string exists
   * (the i18n lookup returns the key itself when a key is missing).
   */
  const optional = (key: string, vars?: Record<string, string | number>) => {
    const value = t(key, vars);
    return value === key ? undefined : value;
  };

  const steps = [1, 2, 3]
    .map((n) => optional(`${base}.step${n}`))
    .filter((value): value is string => Boolean(value));
  const bestPractices = [1, 2, 3]
    .map((n) => optional(`${base}.best${n}`))
    .filter((value): value is string => Boolean(value));
  const personas = [1, 2]
    .map((n) => ({
      title: optional(`${base}.persona${n}Title`),
      body: optional(`${base}.persona${n}Body`),
    }))
    .filter((persona): persona is { title: string; body: string } =>
      Boolean(persona.title && persona.body),
    );

  const primaryDestination =
    feature.appRoute && isKnownAppRoute(feature.appRoute)
      ? feature.appRoute
      : "/app/new";

  return (
    <div className="bg-forge-mesh">
      <div className="forge-container forge-section">
        <Link
          to="/discover"
          className="mb-8 inline-block text-sm font-medium text-forge-cyan hover:underline"
        >
          ← {t("discover.title")}
        </Link>

        <header className="mb-12 max-w-3xl">
          <span className="forge-badge mb-5">
            <span className="text-base" aria-hidden="true">
              {feature.icon}
            </span>
            {t("features.badge")}
          </span>
          <h1 className="forge-h1 mb-4">{t(`${base}.title`)}</h1>
          <p className="forge-body mb-8">{t(`${base}.hero`)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={primaryDestination}
              className="forge-btn-gold inline-flex h-11 items-center px-5 text-sm"
            >
              {t("features.tryIt")}
            </Link>
            <Link
              to="/pricing"
              className="forge-ghost-btn inline-flex h-11 items-center px-5 text-sm"
            >
              {t("features.viewPricing")}
            </Link>
            <span className="text-xs uppercase tracking-[0.18em] text-forge-text-muted">
              {t(CATEGORY_LABEL_KEY[feature.category])}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {steps.length > 0 && (
            <GlassCard hover={false} padding="lg">
              <h2 className="forge-h3 mb-3">{t("features.howItWorks")}</h2>
              {optional(`${base}.howIntro`) && (
                <p className="mb-4 text-sm text-forge-text-muted">
                  {optional(`${base}.howIntro`)}
                </p>
              )}
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-forge-cyan">
                      {t("features.step", { n: index + 1 })}
                    </span>
                    <span className="text-forge-text-primary">{step}</span>
                  </li>
                ))}
              </ol>
            </GlassCard>
          )}

          {bestPractices.length > 0 && (
            <GlassCard hover={false} padding="lg">
              <h2 className="forge-h3 mb-3">{t("features.bestResults")}</h2>
              {optional(`${base}.bestIntro`) && (
                <p className="mb-4 text-sm text-forge-text-muted">
                  {optional(`${base}.bestIntro`)}
                </p>
              )}
              <ul className="space-y-3">
                {bestPractices.map((tip) => (
                  <li
                    key={tip}
                    className="flex gap-3 text-sm text-forge-text-primary"
                  >
                    <span aria-hidden="true" className="text-forge-cyan">
                      ✓
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {personas.length > 0 && (
            <GlassCard hover={false} padding="lg">
              <h2 className="forge-h3 mb-3">{t("features.whoItsFor")}</h2>
              {optional(`${base}.whoIntro`) && (
                <p className="mb-4 text-sm text-forge-text-muted">
                  {optional(`${base}.whoIntro`)}
                </p>
              )}
              <div className="space-y-4">
                {personas.map((persona) => (
                  <div key={persona.title}>
                    <p className="text-sm font-semibold text-forge-text-primary">
                      {persona.title}
                    </p>
                    <p className="text-sm text-forge-text-muted">
                      {persona.body}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {optional(`${base}.demoIntro`) && (
            <GlassCard hover={false} padding="lg">
              <h2 className="forge-h3 mb-3">{t("features.interactive")}</h2>
              <p className="mb-4 text-sm text-forge-text-muted">
                {optional(`${base}.demoIntro`)}
              </p>
              <Link
                to="/templates"
                className="text-sm font-medium text-forge-cyan hover:underline"
              >
                {t("features.tryIt")}
              </Link>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

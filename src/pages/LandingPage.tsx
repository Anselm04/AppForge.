import { Link } from "react-router-dom";
import { PageMeta } from "../components/layout/PageMeta.js";
import { LogoMark } from "../components/brand/LogoMark.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Section } from "../design-system/Section.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PLATFORM_FEATURES, featurePath } from "../lib/platformFeatures.js";
import { publicClaimForEvidence } from "../lib/publicCapabilityClaims.js";

const LANDING_PLANS = [
  {
    key: "free",
    nameKey: "pricing.freeName",
    descriptionKey: "pricing.freeDesc",
    price: "$0",
    featureKeys: ["pricing.freeF1", "pricing.freeF2", "pricing.freeF3"],
  },
  {
    key: "starter",
    nameKey: "pricing.starterName",
    descriptionKey: "pricing.starterDesc",
    price: "$49",
    featureKeys: [
      "pricing.starterF1",
      "pricing.starterF2",
      "pricing.starterF3",
    ],
  },
  {
    key: "builder",
    nameKey: "pricing.builderName",
    descriptionKey: "pricing.builderDesc",
    price: "$149",
    featureKeys: [
      "pricing.builderF1",
      "pricing.builderF2",
      "pricing.builderF3",
    ],
  },
  {
    key: "studio",
    nameKey: "pricing.studioName",
    descriptionKey: "pricing.studioDesc",
    price: "$399",
    featureKeys: [
      "pricing.studioF1",
      "pricing.studioF2",
      "pricing.studioF3",
    ],
  },
  {
    key: "enterprise",
    nameKey: "pricing.enterpriseName",
    descriptionKey: "pricing.enterpriseDesc",
    price: "$1,499",
    featureKeys: [
      "pricing.enterpriseF1",
      "pricing.enterpriseF2",
      "pricing.enterpriseF3",
    ],
  },
] as const;

export function LandingPage() {
  const { t } = useLocale();
  return (
    <>
      <PageMeta
        title={t("landing.metaTitle")}
        description={t("landing.metaDesc")}
      />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forge-mesh" />
        <div className="forge-container forge-section text-center relative">
          <LogoMark size="hero" showTile glow className="mx-auto mb-8" />
          <h1 className="forge-h1 max-w-3xl mx-auto">
            {t("landing.heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-forge-text-muted max-w-2xl mx-auto">
            {t("landing.heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/app/new">
              <Button size="lg">{t("landing.ctaPrimary")}</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" size="lg">
                {t("landing.ctaSecondary")}
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <Section
        id="features"
        title={t("landing.featuresTitle")}
        subtitle={t("landing.featuresSubtitle")}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORM_FEATURES.slice(0, 9).map((f) => {
            const claim = publicClaimForEvidence(f.evidence);
            return (
              <Link key={f.id} to={featurePath(f.id)}>
                <GlassCard className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-2xl">{f.icon}</span>
                    <span className="forge-badge text-xs">
                      {claim.customerLabel}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">
                    {t(`${f.i18nKey}.title`)}
                  </h3>
                  <p className="mt-2 text-sm text-forge-text-muted">
                    {t(`${f.i18nKey}.hero`)}
                  </p>
                  {!claim.canPromise && (
                    <p className="mt-3 text-xs text-forge-text-muted">
                      {claim.explanation}
                    </p>
                  )}
                </GlassCard>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        id="pricing"
        title={t("landing.pricingTitle")}
        subtitle="See the standard monthly price, included build allowance, and compute credits before you start."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {LANDING_PLANS.map((plan) => (
            <GlassCard key={plan.key} className="flex h-full flex-col" hover>
              <h3 className="text-lg font-semibold text-forge-text-primary">
                {t(plan.nameKey)}
              </h3>
              <p className="mt-2 min-h-10 text-sm text-forge-text-muted">
                {t(plan.descriptionKey)}
              </p>
              <div className="mt-5">
                <span className="text-3xl font-bold text-forge-text-primary">
                  {plan.price}
                </span>
                <span className="text-sm text-forge-text-muted">
                  {t("pricing.perMonth")}
                </span>
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-forge-text-muted">
                {plan.featureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2">
                    <span className="mt-0.5 text-forge-cyan">✓</span>
                    <span>{t(featureKey)}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="mt-8" hover={false}>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="forge-badge inline-flex text-xs">
                NO HIDDEN BUILD-COST SURPRISES
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-forge-text-primary">
                What your plan covers — and what complex builds can realistically
                require
              </h3>
              <p className="mt-3 text-sm leading-6 text-forge-text-muted">
                Your subscription includes a monthly build allowance and compute
                credits. A standard full build currently reserves {BUILD_CREDIT_COST}{" "}
                credits when it starts. Straightforward products are designed to fit
                the normal build flow, but not every product requires the same amount
                of work.
              </p>
              <p className="mt-3 text-sm leading-6 text-forge-text-muted">
                More complex products can require extra build iterations, additional
                AI work, specialist or Senior Dev sessions, larger integrations, or
                more compute than a standard build. In those cases you may need extra
                credit top-ups or a higher plan. We tell you this upfront so the price
                of the subscription is not mistaken for a promise that every possible
                product can be completed within the included monthly credits.
              </p>
            </div>
            <div className="rounded-2xl border border-forge-border bg-forge-bg/40 p-5">
              <p className="font-semibold text-forge-text-primary">
                Our pricing promise
              </p>
              <ul className="mt-4 space-y-3 text-sm text-forge-text-muted">
                <li>
                  • Standard plan prices and included credits are shown before you
                  subscribe.
                </li>
                <li>
                  • Extra credits are optional top-ups at the published rate — not a
                  hidden automatic charge.
                </li>
                <li>
                  • If you run out of credits, AppForge pauses the work so you decide
                  whether to top up, upgrade, or stop.
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/pricing">
              <Button>{t("landing.viewPlans")}</Button>
            </Link>
            <Link to="/pricing#credits">
              <Button variant="secondary">View credit top-ups</Button>
            </Link>
          </div>
        </GlassCard>
      </Section>
    </>
  );
}

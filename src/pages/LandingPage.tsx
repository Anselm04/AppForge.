import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BuildPromptComposer } from "../components/BuildPromptComposer.js";
import { LogoLockup } from "../components/brand/LogoMark.js";
import { PageMeta } from "../components/layout/PageMeta.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Section } from "../design-system/Section.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PLATFORM_FEATURES, featurePath } from "../lib/platformFeatures.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import { readPromptDraft, writePromptDraft } from "../lib/promptDraft.js";
import { publicClaimForEvidence } from "../lib/publicCapabilityClaims.js";

const LANDING_PLANS = [
  {
    key: "free",
    nameKey: "pricing.freeName",
    descriptionKey: "pricing.freeDesc",
    price: "$0",
    featureKeys: [
      "pricing.freeF1",
      "pricing.freeF2",
      "pricing.freeF3",
      "pricing.freeF4",
    ],
  },
  {
    key: "starter",
    nameKey: "pricing.starterName",
    descriptionKey: "pricing.starterDesc",
    price: "$79",
    featureKeys: [
      "pricing.starterF1",
      "pricing.starterF2",
      "pricing.starterF3",
      "pricing.starterF4",
      "pricing.starterF5",
      "pricing.starterF6",
    ],
  },
  {
    key: "builder",
    nameKey: "pricing.builderName",
    descriptionKey: "pricing.builderDesc",
    price: "$199",
    featureKeys: [
      "pricing.builderF1",
      "pricing.builderF2",
      "pricing.builderF3",
      "pricing.builderF4",
      "pricing.builderF5",
      "pricing.builderF6",
    ],
  },
  {
    key: "studio",
    nameKey: "pricing.studioName",
    descriptionKey: "pricing.studioDesc",
    price: "$499",
    featureKeys: [
      "pricing.studioF1",
      "pricing.studioF2",
      "pricing.studioF3",
      "pricing.studioF4",
      "pricing.studioF5",
      "pricing.studioF6",
    ],
  },
  {
    key: "enterprise",
    nameKey: "pricing.enterpriseName",
    descriptionKey: "pricing.enterpriseDesc",
    price: "$2,499+",
    featureKeys: [
      "pricing.enterpriseF1",
      "pricing.enterpriseF2",
      "pricing.enterpriseF3",
      "pricing.enterpriseF4",
      "pricing.enterpriseF5",
      "pricing.enterpriseF6",
    ],
  },
] as const;

const BUILD_SUGGESTIONS = [
  "Build a booking app for my business",
  "Create a customer portal with subscriptions",
  "Make a mobile app and web dashboard",
] as const;

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Describe it",
    body: "Type or speak what you want in normal language.",
  },
  {
    number: "02",
    title: "AppForge builds",
    body: "AppForge plans, builds, and checks your project.",
  },
  {
    number: "03",
    title: "Preview and refine",
    body: "See your generated project in the build workspace and ask for changes.",
  },
  {
    number: "04",
    title: "Publish when ready",
    body: "Deploy or export when your project is ready. App-store releases need additional checks.",
  },
] as const;

const LANDING_MARGIN_DISCLOSURE =
  "PROPOSED USD pricing for owner review only. Compute usage must be metered and capped before launch; no unlimited customer use. Actual build costs depend on the approved product scope and extra work requires a separate quote.";

export function LandingPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(() => readPromptDraft());

  const handlePromptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;
    writePromptDraft(cleanPrompt);
    navigate("/signup?next=/");
  };

  return (
    <>
      <PageMeta
        title={t("landing.metaTitle")}
        description={t("landing.metaDesc")}
      />

      <section className="relative overflow-hidden border-b border-forge-border">
        <div className="absolute inset-0 bg-forge-mesh" aria-hidden="true" />
        <div className="forge-container relative py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <LogoLockup size="lg" className="mb-7" />
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-forge-gold">
              Your idea. Your next product.
            </p>
            <h1 className="forge-h1 mx-auto max-w-3xl">
              Build the product you have in mind. Just describe it.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-forge-text-muted sm:text-lg">
              Turn your idea into an app, website, or business tool. Start with
              your own words, then preview, refine, and make it yours.
            </p>
          </div>

          <div className="mx-auto mt-9 max-w-3xl text-start sm:mt-11">
            <BuildPromptComposer
              value={prompt}
              onChange={(value) => {
                const next = value.slice(0, PROMPT_MAX_CHARS);
                setPrompt(next);
                writePromptDraft(next);
              }}
              onSubmit={handlePromptSubmit}
              submitLabel="Build with AppForge"
              placeholder="Describe your idea. Who is it for, and what should it help them do?"
              suggestions={BUILD_SUGGESTIONS}
              maxLength={PROMPT_MAX_CHARS}
              helperText="Your idea is saved in this session. Create an account when you are ready to build."
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-forge-text-muted">
            <span>Type or speak your idea</span>
            <span>Keep your source code</span>
            <Link
              to="/pricing"
              className="font-semibold text-forge-text-primary underline decoration-forge-gold/50 underline-offset-4 hover:text-forge-gold"
            >
              See pricing before you build
            </Link>
          </div>
        </div>
      </section>

      <section
        className="border-b border-forge-border bg-forge-surface"
        aria-label="From idea to launch"
      >
        <div className="forge-container py-10 sm:py-12">
          <ol className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step) => (
              <li key={step.number} className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-forge-border bg-forge-bg text-xs font-semibold text-forge-gold">
                  {step.number}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-forge-text-primary">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-forge-text-muted">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Section
        id="features"
        title="Power underneath. Simplicity on top."
        subtitle="Start with an idea. Explore the tools as your product grows."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_FEATURES.slice(0, 6).map((feature) => {
            const claim = publicClaimForEvidence(feature.evidence);
            return (
              <Link key={feature.id} to={featurePath(feature.id)}>
                <GlassCard className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-2xl">{feature.icon}</span>
                    <span className="forge-badge text-xs">
                      {claim.customerLabel}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">
                    {t(`${feature.i18nKey}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-forge-text-muted">
                    {t(`${feature.i18nKey}.hero`)}
                  </p>
                  {!claim.canPromise && (
                    <p className="mt-3 text-xs leading-5 text-forge-text-muted">
                      {claim.explanation}
                    </p>
                  )}
                </GlassCard>
              </Link>
            );
          })}
        </div>
        <div className="mt-7 text-center">
          <Link to="/discover">
            <Button variant="secondary">Explore AppForge capabilities</Button>
          </Link>
        </div>
      </Section>

      <Section
        id="pricing"
        title="Clear prices before you commit"
        subtitle="See the standard monthly price, included build allowance, compute credits, and full plan benefits before you start."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {LANDING_PLANS.map((plan) => {
            const featured = plan.key === "builder";
            return (
              <GlassCard
                key={plan.key}
                className={`relative flex h-full flex-col ${
                  featured ? "forge-gradient-border" : ""
                }`}
                hover
              >
                {featured && (
                  <span className="absolute -top-3 left-5 rounded-full bg-forge-gold px-3 py-1 text-[10px] font-semibold tracking-wider text-forge-bg">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="text-lg font-semibold text-forge-text-primary">
                  {t(plan.nameKey)}
                </h3>
                <p className="mt-2 min-h-10 text-sm leading-5 text-forge-text-muted">
                  {t(plan.descriptionKey)}
                </p>
                <div className="mt-5">
                  <span className="text-3xl font-bold text-forge-text-primary">
                    {plan.price}
                  </span>
                  <span className="text-sm text-forge-text-muted">
                    {t("pricing.perMonth")} USD
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
                <Link
                  to="/pricing"
                  className="mt-6 block"
                  aria-label={`View ${t(plan.nameKey)} plan`}
                >
                  <Button
                    variant={featured ? "primary" : "secondary"}
                    className="w-full"
                  >
                    View plan
                  </Button>
                </Link>
              </GlassCard>
            );
          })}
        </div>

        <GlassCard className="mt-8" hover={false}>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="forge-badge inline-flex text-xs">
                NO HIDDEN BUILD-COST SURPRISES
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-forge-text-primary">
                Know what your build can cost
              </h3>
              <p className="mt-3 text-sm leading-6 text-forge-text-muted">
                {LANDING_MARGIN_DISCLOSURE}
              </p>
              <p className="mt-3 text-sm leading-6 text-forge-text-muted">
                Your subscription includes a monthly build allowance and compute
                credits. A standard full build currently reserves{" "}
                {BUILD_CREDIT_COST} credits when it starts. Straightforward
                products are designed to fit the normal build flow, but not
                every product requires the same amount of work.
              </p>
              <p className="mt-3 text-sm leading-6 text-forge-text-muted">
                More complex products can require extra build iterations,
                additional AI work, specialist or Senior Dev sessions, larger
                integrations, or more compute than a standard build. If you run
                out of credits before your next monthly subscription payment,
                you must buy extra top-up credits separately to keep building
                right away. Otherwise your build pauses until new credits
                become available, or you choose an eligible higher plan.
                Subscriptions do not promise unlimited completed products.
              </p>
            </div>
            <div className="rounded-2xl border border-forge-border bg-forge-bg/50 p-5">
              <p className="font-semibold text-forge-text-primary">
                Our pricing promise
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-forge-text-muted">
                <li>
                  • Standard plan prices and included credits are shown before
                  you subscribe.
                </li>
                <li>
                  • Included credits are limited. You may need to buy extra
                  top-up credits between your monthly subscription payments.
                </li>
                <li>
                  • To continue immediately after running out, you must pay
                  separately for enough credits. Otherwise work pauses until
                  credits become available again.
                </li>
                <li>
                  • Top-ups are customer-approved purchases only: no hidden
                  charges and no automatic top-up payments.
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

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
    price: "$49",
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
    price: "$149",
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
    price: "$399",
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
    price: "$1,499",
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
    body: "Planning, code generation, review, and validation run through the existing production pipeline.",
  },
  {
    number: "03",
    title: "Preview and refine",
    body: "Open the real build workspace to see generated output and request changes.",
  },
  {
    number: "04",
    title: "Publish when ready",
    body: "Use the available deployment, export, and publishing-readiness tools when your product passes its gates.",
  },
] as const;

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

      <section className="relative overflow-hidden border-b border-forge-border/70">
        <div className="absolute inset-0 bg-forge-mesh" aria-hidden="true" />
        <div className="forge-container relative py-14 sm:py-18 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
            <div>
              <LogoLockup size="lg" className="mb-8" />
              <div className="forge-badge mb-5 inline-flex text-xs">
                IDEA → PRODUCT → PREVIEW → PUBLISH
              </div>
              <h1 className="forge-h1 max-w-3xl">
                Build the product you have in mind. Just describe it.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-forge-text-muted sm:text-lg">
                AppForge turns a plain-language idea into a working software
                project through its existing planning, building, review,
                preview, and delivery pipeline. No technical vocabulary required
                to get started.
              </p>

              <div className="mt-8 max-w-3xl">
                <BuildPromptComposer
                  value={prompt}
                  onChange={(value) => {
                    const next = value.slice(0, PROMPT_MAX_CHARS);
                    setPrompt(next);
                    writePromptDraft(next);
                  }}
                  onSubmit={handlePromptSubmit}
                  submitLabel="Build with AppForge"
                  placeholder="Describe what you want to build — an app, website, customer portal, SaaS product, game, tool, or something completely new…"
                  suggestions={BUILD_SUGGESTIONS}
                  maxLength={PROMPT_MAX_CHARS}
                  helperText="Your idea is saved in this session. Sign up or sign in only when you are ready to start the real build."
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-forge-text-muted">
                <span className="inline-flex items-center gap-2">
                  <span className="text-forge-cyan">✓</span> Type or speak
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-forge-cyan">✓</span> Keep your source
                  code
                </span>
                <Link
                  to="/pricing"
                  className="font-semibold text-forge-text-primary underline decoration-forge-gold/50 underline-offset-4 hover:text-forge-gold"
                >
                  See pricing before you build
                </Link>
              </div>
            </div>

            <GlassCard
              className="overflow-hidden border-forge-border/90 bg-forge-surface/90 p-0"
              hover={false}
            >
              <div className="flex items-center justify-between border-b border-forge-border px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-forge-text-primary">
                    What happens after you press Build
                  </p>
                  <p className="mt-1 text-xs text-forge-text-muted">
                    The real AppForge workflow — not a simulated demo
                  </p>
                </div>
                <span className="rounded-full border border-forge-border bg-forge-bg px-3 py-1 text-[11px] font-semibold text-forge-text-muted">
                  WORKFLOW
                </span>
              </div>

              <div className="space-y-1 p-4 sm:p-5">
                {WORKFLOW_STEPS.map((step) => (
                  <div
                    key={step.number}
                    className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl p-3 transition-colors hover:bg-forge-surface-hover/60"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-forge-border bg-forge-bg text-xs font-bold text-forge-gold">
                      {step.number}
                    </div>
                    <div>
                      <p className="font-semibold text-forge-text-primary">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-forge-text-muted">
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-forge-border bg-forge-bg/50 px-5 py-4">
                <p className="text-xs leading-5 text-forge-text-muted">
                  Once generated files are ready, AppForge&apos;s existing
                  secure live preview becomes available in the build workspace,
                  where you can inspect, design, refine, export, and deploy the
                  actual project.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <Section
        id="features"
        title="Power underneath. Simplicity on top."
        subtitle="AppForge keeps the advanced tools available without making customers learn them before they can build."
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
                className={`flex h-full flex-col ${
                  featured ? "forge-gradient-border bg-forge-gradient/5" : ""
                }`}
                hover
              >
                {featured && (
                  <span className="forge-badge mb-3 w-fit text-[10px]">
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
                <Link to="/pricing" className="mt-6 block">
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
                What your plan covers — and what complex builds can
                realistically require
              </h3>
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
                integrations, or more compute than a standard build. In those
                cases you may need extra credit top-ups or a higher plan. We
                tell you this upfront so the price of the subscription is not
                mistaken for a promise that every possible product can be
                completed within the included monthly credits.
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
                  • Extra credits are optional top-ups at the published rate —
                  not a hidden automatic charge.
                </li>
                <li>
                  • If you run out of credits, AppForge pauses the work so you
                  decide whether to top up, upgrade, or stop.
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

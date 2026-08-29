import { Link } from "react-router-dom";
import { PageMeta } from "../components/layout/PageMeta.js";
import { LogoMark } from "../components/brand/LogoMark.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Section } from "../design-system/Section.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { PLATFORM_FEATURES, featurePath } from "../lib/platformFeatures.js";

export function LandingPage() {
  const { t } = useLocale();
  const steps = [1, 2, 3] as const;
  const faqKeys = ["q1", "q2", "q3"] as const;
  return (
    <>
      <PageMeta title={t("landing.metaTitle")} description={t("landing.metaDesc")} />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forge-mesh" />
        <div className="forge-container forge-section text-center relative">
          <LogoMark size="hero" showTile glow className="mx-auto mb-8" />
          <h1 className="forge-h1 max-w-3xl mx-auto">{t("landing.heroTitle")}</h1>
          <p className="mt-6 text-lg text-forge-text-muted max-w-2xl mx-auto">{t("landing.heroSubtitle")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/app/new"><Button size="lg">{t("landing.ctaPrimary")}</Button></Link>
            <Link to="/pricing"><Button variant="secondary" size="lg">{t("landing.ctaSecondary")}</Button></Link>
          </div>
        </div>
      </section>
      <Section id="features" title={t("landing.featuresTitle")} subtitle={t("landing.featuresSubtitle")}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORM_FEATURES.slice(0, 9).map((f) => (
            <Link key={f.id} to={featurePath(f.id)}><GlassCard className="h-full"><span className="text-2xl">{f.icon}</span><h3 className="mt-3 font-semibold">{t(`${f.i18nKey}.title`)}</h3><p className="mt-2 text-sm text-forge-text-muted">{t(`${f.i18nKey}.hero`)}</p></GlassCard></Link>
          ))}
        </div>
      </Section>
    </>
  );
}

import { Link } from "react-router-dom";
import { useLocale } from "../i18n/LocaleContext.js";
import {
  PLATFORM_FEATURES,
  featurePath,
  type FeatureMeta,
} from "../lib/platformFeatures.js";
import { GlassCard } from "../design-system/GlassCard.js";

const CATEGORY_LABEL_KEY: Record<FeatureMeta["category"], string> = {
  build: "sidebar.build",
  ship: "sidebar.ship",
  team: "sidebar.team",
  grow: "sidebar.insights",
  discover: "sidebar.discover",
};

const CATEGORY_ORDER: FeatureMeta["category"][] = [
  "build",
  "ship",
  "team",
  "grow",
  "discover",
];

export function Discover() {
  const { t } = useLocale();

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    label: t(CATEGORY_LABEL_KEY[category]),
    features: PLATFORM_FEATURES.filter((f) => f.category === category),
  })).filter((group) => group.features.length > 0);

  return (
    <div className="bg-forge-mesh">
      <div className="forge-container forge-section">
        <header className="mb-12 max-w-2xl">
          <h1 className="forge-h1 mb-4">{t("discover.title")}</h1>
          <p className="forge-body">{t("discover.subtitle")}</p>
        </header>

        <div className="space-y-12">
          {groups.map((group) => (
            <section key={group.category}>
              <h2 className="forge-h3 mb-5">{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.features.map((feature) => (
                  <Link
                    key={feature.id}
                    to={featurePath(feature.id)}
                    className="block focus:outline-hidden focus-visible:ring-2 focus-visible:ring-forge-cyan/50 rounded-card"
                  >
                    <GlassCard className="h-full">
                      <span className="text-2xl" aria-hidden="true">
                        {feature.icon}
                      </span>
                      <h3 className="forge-h3 mt-3 mb-2">
                        {t(`${feature.i18nKey}.title`)}
                      </h3>
                      <p className="text-sm leading-relaxed text-forge-text-muted">
                        {t(`${feature.i18nKey}.hero`)}
                      </p>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link
            to="/templates"
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
        </div>
      </div>
    </div>
  );
}

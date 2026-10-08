import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { GlassCard } from "../design-system/GlassCard.js";

const SECTIONS = [
  { id: "account", to: "/account" },
  { id: "security", to: "/account" },
  { id: "billing", to: "/pricing" },
] as const;

const SECTION_BODY: Record<(typeof SECTIONS)[number]["id"], string> = {
  account: "Your sign-in email and password.",
  security: "Sign out other devices and review active sessions.",
  billing: "Plans, credits, and your Stripe billing portal.",
};

export function Settings() {
  const { t } = useLocale();
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });

  return (
    <div className="bg-forge-mesh">
      <div className="forge-container forge-section">
        <h1 className="forge-h1 mb-8">{t("settings.title")}</h1>

        <GlassCard hover={false} padding="lg" className="mb-8 max-w-xl">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">
                {t("settings.displayName")}
              </dt>
              <dd className="text-forge-text-primary">{me?.name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">{t("settings.email")}</dt>
              <dd className="text-forge-text-primary">{me?.email || "—"}</dd>
            </div>
          </dl>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <Link
              key={section.id}
              to={section.to}
              className="block rounded-card focus:outline-hidden focus-visible:ring-2 focus-visible:ring-forge-cyan/50"
            >
              <GlassCard className="h-full">
                <h2 className="forge-h3 mb-2">
                  {t(`settings.tabs.${section.id}`)}
                </h2>
                <p className="text-sm text-forge-text-muted">
                  {SECTION_BODY[section.id]}
                </p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

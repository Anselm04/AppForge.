import { Link } from "react-router-dom";
import { useLocale } from "../i18n/LocaleContext.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";

export function NotFound() {
  const { t } = useLocale();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-forge-mesh px-4 py-20">
      <div className="mx-auto max-w-lg text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-forge-cyan">
          404
        </p>
        <h1 className="forge-h2 mb-3">{t("notFound.title")}</h1>
        <p className="forge-body mb-8">{t("notFound.body")}</p>
        <GlassCard hover={false} padding="lg" className="text-left">
          <p className="mb-4 text-sm text-forge-text-muted">
            Popular destinations
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/">
              <Button>{t("notFound.home")}</Button>
            </Link>
            <Link to="/templates">
              <Button variant="secondary">{t("nav.dashboard")}</Button>
            </Link>
            <Link to="/help">
              <Button variant="secondary">{t("help.title")}</Button>
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

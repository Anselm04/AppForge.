import { Link, Outlet, useLocation } from "react-router-dom";
import { LogoLockup } from "../brand/LogoMark.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";
import { ThemeToggle } from "../ThemeToggle.js";
import { Button } from "../../design-system/Button.js";
import { useLocale } from "../../i18n/LocaleContext.js";
import { cn } from "../../lib/cn.js";
import { PLATFORM_FEATURES, featurePath } from "../../lib/platformFeatures.js";

export function MarketingLayout() {
  const { t } = useLocale();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-forge-bg bg-forge-mesh">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-forge-bg/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0 hover:opacity-90 transition-opacity">
            <LogoLockup size="sm" />
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-forge-text-muted">
            <Link
              to="/#features"
              className="hover:text-forge-text-primary transition-colors"
            >
              {t("landing.navFeatures")}
            </Link>
            <Link
              to="/pricing"
              className={cn(
                "hover:text-forge-text-primary transition-colors",
                pathname === "/pricing" && "text-forge-cyan",
              )}
            >
              {t("landing.navPricing")}
            </Link>
            <Link
              to="/discover"
              className={cn(
                "hover:text-forge-text-primary transition-colors",
                pathname === "/discover" && "text-forge-cyan",
              )}
            >
              {t("landing.navDiscover")}
            </Link>
            <Link
              to="/help"
              className="hover:text-forge-text-primary transition-colors"
            >
              {t("landing.navHelp")}
            </Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                {t("nav.login")}
              </Button>
            </Link>
            <Link to="/app/new">
              <Button size="sm">{t("landing.ctaPrimary")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/[0.06] bg-forge-surface/40">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <LogoLockup size="sm" />
            <p className="mt-4 text-sm text-forge-text-muted max-w-sm">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">
              {t("footer.product")}
            </h3>
            <ul className="space-y-2 text-sm text-forge-text-muted">
              {PLATFORM_FEATURES.slice(0, 5).map((f) => (
                <li key={f.id}>
                  <Link
                    to={featurePath(f.id)}
                    className="hover:text-forge-cyan transition-colors"
                  >
                    {t(`${f.i18nKey}.title`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">
              {t("footer.company")}
            </h3>
            <ul className="space-y-2 text-sm text-forge-text-muted">
              <li>
                <Link to="/about" className="hover:text-forge-cyan">
                  {t("footer.about")}
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-forge-cyan">
                  {t("footer.help")}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-forge-cyan">
                  {t("footer.pricing")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 border-t border-white/[0.06] text-xs text-forge-text-muted flex flex-wrap gap-4 justify-between">
          <span>© {new Date().getFullYear()} AppForge · TrillionAI Tech</span>
          <span>{t("footer.rights")}</span>
        </div>
      </footer>
    </div>
  );
}

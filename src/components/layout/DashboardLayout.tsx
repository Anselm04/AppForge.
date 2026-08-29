import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { LogoLockup } from "../brand/LogoMark.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";
import { ThemeToggle } from "../ThemeToggle.js";
import { CommandPalette } from "./CommandPalette.js";
import { useLocale } from "../../i18n/LocaleContext.js";
import { cn } from "../../lib/cn.js";
import {
  PLATFORM_FEATURES,
  SIDEBAR_GROUPS,
  featurePath,
  type FeatureId,
} from "../../lib/platformFeatures.js";

export function DashboardLayout() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex bg-forge-bg">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-white/[0.06] bg-forge-surface/95 backdrop-blur-xl transform transition-transform duration-forge lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-4 border-b border-white/[0.06]">
          <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>
            <LogoLockup size="sm" />
          </Link>
        </div>
        <nav className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-5rem)]">
          <Link
            to="/dashboard"
            className="block px-3 py-2 rounded-xl text-sm font-medium text-forge-text-primary hover:bg-white/[0.04]"
            onClick={() => setSidebarOpen(false)}
          >
            {t("nav.dashboard")}
          </Link>
          <Link
            to="/app/new"
            className="block px-3 py-2 rounded-xl text-sm font-medium bg-forge-gradient text-white mb-2"
            onClick={() => setSidebarOpen(false)}
          >
            + {t("landing.ctaPrimary")}
          </Link>
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="px-3 text-[10px] uppercase tracking-wider text-forge-text-muted mb-2">
                {t(group.key)}
              </div>
              <ul className="space-y-0.5">
                {group.ids.map((id: FeatureId) => {
                  const f = PLATFORM_FEATURES.find((x) => x.id === id)!;
                  return (
                    <li key={id}>
                      <Link
                        to={featurePath(id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-forge-text-muted hover:text-forge-text-primary hover:bg-white/[0.04] transition-colors"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span aria-hidden>{f.icon}</span>
                        {t(`${f.i18nKey}.title`)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <Link
            to="/studio"
            className="block px-3 py-2 rounded-xl text-sm text-forge-text-muted hover:bg-white/[0.04]"
            onClick={() => setSidebarOpen(false)}
          >
            {t("sidebar.studios")}
          </Link>
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/[0.06] bg-forge-bg/80 backdrop-blur-xl flex items-center gap-3 px-4">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04]"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex-1 max-w-md h-9 px-3 rounded-xl bg-forge-surface border border-white/[0.08] text-sm text-forge-text-muted text-left hover:border-forge-cyan/30 transition-colors"
          >
            {t("dashboard.searchPlaceholder")} ⌘K
          </button>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-white/[0.04] text-forge-text-muted"
            aria-label={t("dashboard.notifications")}
          >
            🔔
          </button>
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="h-8 w-8 rounded-full bg-forge-gradient text-xs font-bold"
            aria-label={t("dashboard.profile")}
          >
            AF
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

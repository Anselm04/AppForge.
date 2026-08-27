import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useNavigate } from "react-router-dom";
import { getSession, signOut } from "../lib/auth.js";
import { useLayoutMode, type LayoutMode } from "../lib/layout.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { useLocale } from "../i18n/LocaleContext.js";

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

const LAYOUT_OPTIONS: LayoutMode[] = ["auto", "phone", "desktop"];

function LayoutSwitcher({
  stacked,
  mode,
  setMode,
  t,
}: {
  stacked: boolean;
  mode: LayoutMode;
  setMode: (next: LayoutMode) => void;
  t: (key: string) => string;
}) {
  const labelFor = (value: LayoutMode) =>
    value === "auto" ? t("nav.layoutAuto") : value === "phone" ? t("nav.layoutPhone") : t("nav.layoutDesktop");

  return (
    <div className={stacked ? "w-full" : "shrink-0"} role="group" aria-label={t("nav.layout")}>
      {stacked && (
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t("nav.layout")}
        </p>
      )}
      <div
        className={
          stacked
            ? "grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
            : "inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800"
        }
      >
        {LAYOUT_OPTIONS.map((value) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(value)}
              className={
                stacked
                  ? `min-h-[44px] px-2 rounded-md text-sm font-semibold ${
                      selected
                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`
                  : `min-h-[32px] px-2 rounded-md text-xs font-semibold whitespace-nowrap ${
                      selected
                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`
              }
            >
              {labelFor(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type NavChromeProps = {
  stacked: boolean;
  isDark: boolean;
  toggleDark: () => void;
  isLoggedIn: boolean;
  isOwner: boolean;
  isPaid: boolean;
  isTrialing: boolean;
  tier: string;
  layoutMode: LayoutMode;
  setLayoutMode: (next: LayoutMode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  go: (path: string) => void;
  onLogout: () => void;
};

function NavChrome({
  stacked,
  isDark,
  toggleDark,
  isLoggedIn,
  isOwner,
  isPaid,
  isTrialing,
  tier,
  layoutMode,
  setLayoutMode,
  t,
  go,
  onLogout,
}: NavChromeProps) {
  const item = stacked
    ? "w-full min-h-[44px] px-3 py-2 rounded-lg text-start text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white";
  const darkBtn = stacked
    ? "w-full min-h-[44px] px-3 py-2 rounded-lg text-start hover:bg-slate-100 dark:hover:bg-slate-800"
    : "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg";
  const adminBtn = stacked
    ? "w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"
    : "bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold";
  const primaryBtn = stacked
    ? "w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
    : "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold";

  return (
    <>
      <LanguageSwitcher variant={stacked ? "panel" : "dropdown"} />

      <LayoutSwitcher stacked={stacked} mode={layoutMode} setMode={setLayoutMode} t={t} />

      <button type="button" onClick={toggleDark} className={darkBtn}>
        {isDark ? t("nav.light") : t("nav.dark")}
      </button>

      {isLoggedIn ? (
        <>
          {isOwner && (
            <button type="button" onClick={() => go("/admin")} className={adminBtn}>
              {t("nav.admin")}
            </button>
          )}

          <button type="button" onClick={() => go("/dashboard")} className={item}>
            {t("nav.dashboard")}
          </button>

          <button type="button" onClick={() => go("/editor")} className={item}>
            {t("nav.editor")}
          </button>

          {!isPaid && !isTrialing && (
            <button type="button" onClick={() => go("/pricing")} className={primaryBtn}>
              {t("nav.upgrade")}
            </button>
          )}

          {isTrialing && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 px-3 py-1 rounded-full font-semibold self-start">
              {t("nav.trial", { tier })}
            </span>
          )}

          {isPaid && !isTrialing && (
            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 px-3 py-1 rounded-full font-semibold capitalize self-start">
              {tier}
            </span>
          )}

          <button type="button" onClick={onLogout} className={item}>
            {t("nav.logout")}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => go("/login")} className={item}>
            {t("nav.login")}
          </button>
          <button type="button" onClick={() => go("/signup")} className={primaryBtn}>
            {t("nav.signUp")}
          </button>
        </>
      )}
    </>
  );
}

export function TopNav() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { mode: layoutMode, setMode: setLayoutMode, compact } = useLayoutMode();
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const { data: user, isSuccess: meReady } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
    enabled: !!user,
  });

  const logout = useMutation({
    mutationFn: async () => {
      signOut();
      await trpc.auth.logout.mutate();
    },
    onSuccess: () => {
      navigate("/");
    },
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  useEffect(() => {
    if (!compact) setMenuOpen(false);
  }, [compact]);

  useEffect(() => {
    if (meReady && !user && getSession()) {
      signOut();
    }
  }, [meReady, user]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      hamburgerRef.current?.focus();
    };
  }, [menuOpen]);

  const isPaid = subStatus?.isPaid ?? false;
  const tier = subStatus?.tier ?? "free";
  const isTrialing = subStatus?.isTrialing ?? false;
  // Valid session = auth.me returned a user. Stale localStorage is logged out.
  const isLoggedIn = !!user;
  const isOwner = !!user && !!user.isOwner;

  const closeMenu = () => setMenuOpen(false);
  const go = (path: string) => {
    closeMenu();
    navigate(path);
  };

  const chrome = {
    isDark,
    toggleDark: () => setIsDark((value) => !value),
    isLoggedIn,
    isOwner,
    isPaid,
    isTrialing,
    tier,
    layoutMode,
    setLayoutMode,
    t,
    go,
    onLogout: () => {
      closeMenu();
      logout.mutate();
    },
  };

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            closeMenu();
            navigate("/");
          }}
          className="flex items-center gap-2 text-2xl font-bold text-blue-600 hover:text-blue-700 shrink-0"
        >
          <img src="/appforge-logo-mark.png" alt="" width={40} height={40} className="h-8 w-8 md:h-10 md:w-10 rounded-lg object-contain" />
          AppForge
        </button>

        {!compact && (
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <NavChrome stacked={false} {...chrome} />
          </div>
        )}

        {compact && (
          <button
            ref={hamburgerRef}
            type="button"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        )}
      </div>

      {compact && menuOpen && (
        <div>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40"
            aria-label={t("nav.closeMenu")}
            onClick={closeMenu}
          />
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            className="fixed inset-y-0 end-0 z-[70] w-[min(20rem,86vw)] bg-white dark:bg-slate-900 shadow-xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <span className="flex items-center gap-2 text-lg font-bold text-blue-600">
                <img src="/appforge-logo-mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
                AppForge
              </span>
              <button
                ref={closeBtnRef}
                type="button"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t("nav.closeMenu")}
                onClick={closeMenu}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-2">
              <NavChrome stacked {...chrome} />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

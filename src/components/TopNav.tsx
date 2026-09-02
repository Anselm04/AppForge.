import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useNavigate } from "react-router-dom";
import { ensureFreshSession, getSession, signOut } from "../lib/auth.js";
import { useLayoutMode, type LayoutMode } from "../lib/layout.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { ThemeToggle } from "./ThemeToggle.js";
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
  stacked, mode, setMode, t,
}: {
  stacked: boolean; mode: LayoutMode; setMode: (next: LayoutMode) => void; t: (key: string) => string;
}) {
  const labelFor = (value: LayoutMode) =>
    value === "auto" ? t("nav.layoutAuto") : value === "phone" ? t("nav.layoutPhone") : t("nav.layoutDesktop");
  return (
    <div className={stacked ? "w-full" : "shrink-0"} role="group" aria-label={t("nav.layout")}>
      {stacked && (
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#6ec9d0]">{t("nav.layout")}</p>
      )}
      <div className={stacked ? "grid grid-cols-3 gap-1 p-1 bg-forge-surface border border-forge-border" : "inline-flex items-center gap-0.5 p-0.5 bg-forge-surface border border-forge-border"}>
        {LAYOUT_OPTIONS.map((value) => {
          const selected = mode === value;
          return (
            <button key={value} type="button" aria-pressed={selected} onClick={() => setMode(value)}
              className={stacked
                ? `min-h-[44px] px-2 text-sm font-medium ${selected ? "bg-[#c4a35a] text-[#140f08]" : "text-forge-text-muted hover:text-[color:var(--forge-heading)]"}`
                : `min-h-[32px] px-2 text-xs font-medium whitespace-nowrap ${selected ? "bg-[#c4a35a] text-[#140f08]" : "text-forge-text-muted hover:text-[color:var(--forge-heading)]"}`}
            >{labelFor(value)}</button>
          );
        })}
      </div>
    </div>
  );
}

type NavChromeProps = {
  stacked: boolean; isLoggedIn: boolean; isOwner: boolean; isPaid: boolean; isTrialing: boolean;
  tier: string; layoutMode: LayoutMode; setLayoutMode: (next: LayoutMode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  go: (path: string) => void; onLogout: () => void;
};

function NavChrome({ stacked, isLoggedIn, isOwner, isPaid, isTrialing, tier, layoutMode, setLayoutMode, t, go, onLogout }: NavChromeProps) {
  const item = stacked
    ? "w-full min-h-[44px] px-3 py-2 text-start text-forge-text-primary hover:bg-[rgba(196,163,90,0.08)] hover:text-[color:var(--forge-heading)]"
    : "text-forge-text-muted hover:text-[color:var(--forge-heading)] text-sm uppercase tracking-[0.08em]";
  const adminBtn = stacked
    ? "w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-semibold"
    : "bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm font-semibold";
  const primaryBtn = stacked ? "w-full min-h-[44px] forge-btn-gold px-4 py-2" : "forge-btn-gold px-4 py-2 text-xs";
  return (
    <>
      <LanguageSwitcher variant={stacked ? "panel" : "dropdown"} />
      <LayoutSwitcher stacked={stacked} mode={layoutMode} setMode={setLayoutMode} t={t} />
      <ThemeToggle stacked={stacked} />
      {isLoggedIn ? (
        <>
          {isOwner && (<button type="button" onClick={() => go("/admin")} className={adminBtn}>{t("nav.admin")}</button>)}
          <button type="button" onClick={() => go("/dashboard")} className={item}>{t("nav.dashboard")}</button>
          <button type="button" onClick={() => go("/templates")} className={item}>Templates</button>
          <button type="button" onClick={() => go("/editor")} className={item}>{t("nav.editor")}</button>
          <button type="button" onClick={() => go("/studio")} className={item}>Studio</button>
          {!isPaid && !isTrialing && (<button type="button" onClick={() => go("/pricing")} className={primaryBtn}>{t("nav.upgrade")}</button>)}
          {isTrialing && (<span className="text-xs bg-[rgba(196,163,90,0.15)] text-[color:var(--forge-heading)] border border-[rgba(196,163,90,0.35)] px-3 py-1 font-semibold self-start">{t("nav.trial", { tier })}</span>)}
          {isPaid && !isTrialing && (<span className="text-xs bg-[rgba(196,163,90,0.15)] text-[color:var(--forge-heading)] border border-[rgba(196,163,90,0.35)] px-3 py-1 font-semibold capitalize self-start">{tier}</span>)}
          <button type="button" onClick={onLogout} className={item}>{t("nav.logout")}</button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => go("/login")} className={item}>{t("nav.login")}</button>
          <button type="button" onClick={() => go("/signup")} className={primaryBtn}>{t("nav.signUp")}</button>
        </>
      )}
    </>
  );
}

export function TopNav() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { mode: layoutMode, setMode: setLayoutMode, compact } = useLayoutMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const refreshAttempted = useRef(false);
  const { data: user, isSuccess: meReady } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });
  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
    enabled: !!user,
  });
  const logout = useMutation({
    mutationFn: async () => { signOut(); await trpc.auth.logout.mutate(); },
    onSuccess: () => { navigate("/"); },
  });
  useEffect(() => { if (!compact) setMenuOpen(false); }, [compact]);
  useEffect(() => {
    if (!meReady || user) return;
    if (!getSession()) return;
    if (refreshAttempted.current) return;
    refreshAttempted.current = true;
    let cancelled = false;
    void (async () => {
      const next = await ensureFreshSession();
      if (cancelled) return;
      if (next) { await queryClient.invalidateQueries({ queryKey: ["auth"] }); }
    })();
    return () => { cancelled = true; };
  }, [meReady, user, queryClient]);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
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
  const isLoggedIn = !!user || !!getSession();
  const isOwner = !!user && !!user.isOwner;
  const closeMenu = () => setMenuOpen(false);
  const go = (path: string) => { closeMenu(); navigate(path); };
  const chrome = {
    isLoggedIn, isOwner, isPaid, isTrialing, tier, layoutMode, setLayoutMode, t, go,
    onLogout: () => { closeMenu(); logout.mutate(); },
  };
  return (
    <nav className="bg-forge-bg/90 backdrop-blur-xl border-b border-forge-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-2 md:py-2.5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => { closeMenu(); navigate("/"); }} className="flex items-center gap-3 shrink-0 group">
          <img src="/appforge-logo.png" alt="" width={72} height={72} className="h-14 w-14 md:h-16 md:w-16 object-contain forge-logo-glow" />
          <span className="font-display text-2xl md:text-[1.7rem] font-medium tracking-wide text-[color:var(--forge-heading)] group-hover:text-[#c4a35a]">AppForge</span>
        </button>
        {!compact && (<div className="flex items-center gap-3 flex-wrap justify-end"><NavChrome stacked={false} {...chrome} /></div>)}
        {compact && (
          <button ref={hamburgerRef} type="button" className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] border border-forge-border text-[color:var(--forge-heading)] hover:bg-[rgba(196,163,90,0.08)]" aria-label={t("nav.menu")} aria-expanded={menuOpen} aria-controls="mobile-nav-drawer" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </button>
        )}
      </div>
      {compact && menuOpen && (
        <div>
          <button type="button" className="fixed inset-0 z-[60] bg-black/60" aria-label={t("nav.closeMenu")} onClick={closeMenu} />
          <div id="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label={t("nav.menu")} className="fixed inset-y-0 end-0 z-[70] w-[min(20rem,86vw)] bg-forge-bg border-s border-forge-border shadow-[0_24px_80px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-forge-border shrink-0">
              <span className="flex items-center gap-2 font-display text-lg font-medium text-[color:var(--forge-heading)]">
                <img src="/appforge-logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain forge-logo-glow" />
                AppForge
              </span>
              <button ref={closeBtnRef} type="button" className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-[color:var(--forge-heading)] hover:bg-[rgba(196,163,90,0.08)]" aria-label={t("nav.closeMenu")} onClick={closeMenu}>
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

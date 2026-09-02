import { useLocale } from "../i18n/LocaleContext.js";
import { cn } from "../lib/cn.js";
import { useTheme } from "../lib/theme.js";

type Props = { className?: string; stacked?: boolean };

export function ThemeToggle({ className, stacked = false }: Props) {
  const { t } = useLocale();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className={cn(stacked ? "w-full" : "shrink-0", className)} role="group" aria-label={isDark ? t("nav.night") : t("nav.day")}>
      {stacked && (
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--forge-heading)]">{isDark ? t("nav.night") : t("nav.day")}</p>
      )}
      <div className={stacked ? "grid grid-cols-2 gap-1 p-1 bg-forge-surface border border-forge-border" : "inline-flex items-center gap-0.5 p-0.5 bg-forge-surface border border-forge-border"}>
        <button type="button" aria-pressed={isDark} onClick={() => setTheme("dark")} className={stacked ? `min-h-[44px] px-2 text-sm font-medium inline-flex items-center justify-center gap-1.5 ${isDark ? "bg-[#c4a35a] text-[#140f08]" : "text-forge-text-muted hover:text-[color:var(--forge-heading)]"}` : `min-h-[32px] px-2.5 text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 ${isDark ? "bg-[#c4a35a] text-[#140f08]" : "text-forge-text-muted hover:text-[color:var(--forge-heading)]"}`}>
          <MoonIcon />{t("nav.night")}
        </button>
        <button type="button" aria-pressed={!isDark} onClick={() => setTheme("light")} className={stacked ? `min-h-[44px] px-2 text-sm font-medium inline-flex items-center justify-center gap-1.5 ${!isDark ? "bg-[#c4a35a] text-[#140f08]" : "text-forge-text-muted hover:text-[color:var(--forge-heading)]"}` : `min-h-[32px] px-2.5 text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 ${!isDark ? "bg-[#c4a35a] text-[#140f08]" : "text-forge-text-muted hover:text-[color:var(--forge-heading)]"}`}>
          <SunIcon />{t("nav.day")}
        </button>
      </div>
    </div>
  );
}

function MoonIcon() {
  return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>);
}
function SunIcon() {
  return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>);
}

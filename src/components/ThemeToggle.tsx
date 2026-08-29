import { useLocale } from "../i18n/LocaleContext.js";
import { cn } from "../lib/cn.js";
import { useTheme } from "../lib/theme.js";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-forge-border bg-forge-surface/60 text-forge-text-muted transition-colors hover:border-forge-cyan/30 hover:text-forge-text-primary",
        className,
      )}
      aria-label={isDark ? t("nav.light") : t("nav.dark")}
      title={isDark ? t("nav.light") : t("nav.dark")}
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

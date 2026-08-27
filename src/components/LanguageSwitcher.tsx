import { useEffect, useRef, useState } from "react";
import { LOCALES } from "../i18n/locales.js";
import { useLocale } from "../i18n/LocaleContext.js";

type LanguageSwitcherProps = {
  /** `panel` expands in-flow so the list is not clipped inside a mobile drawer. */
  variant?: "dropdown" | "panel";
};

export function LanguageSwitcher({ variant = "dropdown" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPanel = variant === "panel";

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: (typeof LOCALES)[number]["code"]) => {
    setLocale(code);
    setOpen(false);
  };

  return (
    <div className={isPanel ? "relative w-full" : "relative"} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={
          isPanel
            ? "w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-start"
            : "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("nav.language")}
      >
        <span>🌐 {t("nav.language")}</span>
        {isPanel && (
          <span aria-hidden className="text-slate-400">
            {open ? "▴" : "▾"}
          </span>
        )}
      </button>
      {open && (
        <ul
          role="listbox"
          className={
            isPanel
              ? "relative mt-2 w-full max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-[200]"
              : "absolute end-0 mt-2 w-56 max-h-80 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-[200]"
          }
        >
          {LOCALES.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                role="option"
                aria-selected={locale === item.code}
                lang={item.code}
                dir={item.dir}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  pick(item.code);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  pick(item.code);
                }}
                className={`w-full text-start px-4 ${isPanel ? "min-h-[44px]" : "py-2"} text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  locale === item.code
                    ? "font-semibold text-blue-600 dark:text-blue-400"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {item.nativeName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

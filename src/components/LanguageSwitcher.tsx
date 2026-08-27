import { useEffect, useRef, useState } from "react";
import { LOCALES } from "../i18n/locales.js";
import { useLocale } from "../i18n/LocaleContext.js";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("nav.language")}
      >
        🌐 {t("nav.language")}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute end-0 mt-2 w-56 max-h-80 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50"
        >
          {LOCALES.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                role="option"
                aria-selected={locale === item.code}
                lang={item.code}
                dir={item.dir}
                onClick={() => {
                  setLocale(item.code);
                  setOpen(false);
                }}
                className={`w-full text-start px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
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

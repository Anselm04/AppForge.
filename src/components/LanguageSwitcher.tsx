import { useEffect, useRef, useState } from "react";
import { LOCALES } from "../i18n/locales.js";
import { useLocale } from "../i18n/LocaleContext.js";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef\u003cHTMLDivElement\u003e(null);

  useEffect(() =\u003e {
    if (!open) return;
    const onDoc = (event: MouseEvent) =\u003e {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) =\u003e {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () =\u003e {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    \u003cdiv className="relative" ref={rootRef}\u003e
      \u003cbutton
        type="button"
        onClick={() =\u003e setOpen((value) =\u003e !value)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("nav.language")}
      \u003e
        🌐 {t("nav.language")}
      \u003c/button\u003e
      {open \u0026\u0026 (
        \u003cul
          role="listbox"
          className="absolute end-0 mt-2 w-56 max-h-80 overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50"
        \u003e
          {LOCALES.map((item) =\u003e (
            \u003cli key={item.code}\u003e
              \u003cbutton
                type="button"
                role="option"
                aria-selected={locale === item.code}
                lang={item.code}
                dir={item.dir}
                onClick={() =\u003e {
                  setLocale(item.code);
                  setOpen(false);
                }}
                className={`w-full text-start px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  locale === item.code
                    ? "font-semibold text-blue-600 dark:text-blue-400"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              \u003e
                {item.nativeName}
              \u003c/button\u003e
            \u003c/li\u003e
          ))}
        \u003c/ul\u003e
      )}
    \u003c/div\u003e
  );
}

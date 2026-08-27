import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  detectLocale,
  getLocaleMeta,
  isLocaleCode,
  LOCALE_STORAGE_KEY,
  type LocaleCode,
  type TextDir,
} from "./locales.js";
import { messages, type Messages } from "./messages.js";

type Vars = Record\u003cstring, string | number\u003e;

type LocaleContextValue = {
  locale: LocaleCode;
  dir: TextDir;
  setLocale: (next: LocaleCode) =\u003e void;
  t: (key: string, vars?: Vars) =\u003e string;
};

const LocaleContext = createContext\u003cLocaleContextValue | null\u003e(null);

function lookup(tree: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = tree;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = (cur as Record\u003cstring, unknown\u003e)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\\{(\\w+)\\}/g, (_, name: string) =\u003e
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`,
  );
}

function persistLocale(code: LocaleCode) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    /* ignore quota / private mode */
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState\u003cLocaleCode\u003e(() =\u003e {
    const initial = detectLocale();
    applyDocumentLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next: LocaleCode) =\u003e {
    if (!isLocaleCode(next)) return;
    setLocaleState(next);
    persistLocale(next);
    applyDocumentLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) =\u003e {
      const raw = lookup(messages[locale], key) ?? lookup(messages[DEFAULT_LOCALE], key) ?? key;
      return interpolate(raw, vars);
    },
    [locale],
  );

  const value = useMemo\u003cLocaleContextValue\u003e(
    () =\u003e ({
      locale,
      dir: getLocaleMeta(locale).dir,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return \u003cLocaleContext.Provider value={value}\u003e{children}\u003c/LocaleContext.Provider\u003e;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

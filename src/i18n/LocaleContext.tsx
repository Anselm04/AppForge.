import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

type Vars = Record<string, string | number>;

type LocaleContextValue = {
  locale: LocaleCode;
  dir: TextDir;
  setLocale: (next: LocaleCode) => void;
  t: (key: string, vars?: Vars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function unwrapMessages(mod: unknown): Messages | undefined {
  if (!mod || typeof mod !== "object") return undefined;
  const rec = mod as Record<string, unknown>;
  if ("nav" in rec) return mod as Messages;
  if (rec.default && typeof rec.default === "object" && rec.default && "nav" in (rec.default as object)) {
    return rec.default as Messages;
  }
  return undefined;
}

function lookup(tree: Messages | undefined, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = tree;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
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
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    const initial = detectLocale();
    applyDocumentLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next: LocaleCode) => {
    if (!isLocaleCode(next)) return;
    setLocaleState(next);
    persistLocale(next);
    applyDocumentLocale(next);
  }, []);

  useEffect(() => {
    persistLocale(locale);
    applyDocumentLocale(locale);
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const catalog = unwrapMessages(messages[locale]) ?? unwrapMessages(messages[DEFAULT_LOCALE]);
      const fallback = unwrapMessages(messages[DEFAULT_LOCALE]);
      const raw = lookup(catalog, key) ?? lookup(fallback, key) ?? key;
      return interpolate(raw, vars);
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: getLocaleMeta(locale).dir,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

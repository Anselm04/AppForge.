export const LOCALE_STORAGE_KEY = "appforge.locale";

export const LOCALES = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "mi", nativeName: "Māori", dir: "ltr" },
  { code: "zh", nativeName: "中文", dir: "ltr" },
  { code: "es", nativeName: "Español", dir: "ltr" },
  { code: "hi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "fr", nativeName: "Français", dir: "ltr" },
  { code: "pt", nativeName: "Português", dir: "ltr" },
  { code: "ja", nativeName: "日本語", dir: "ltr" },
  { code: "ko", nativeName: "한국어", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type TextDir = (typeof LOCALES)[number]["dir"];

export const DEFAULT_LOCALE: LocaleCode = "en";

const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code);

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

export function getLocaleMeta(code: LocaleCode) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/** Map navigator.language (e.g. en-NZ, zh-CN, pt-BR) onto a supported locale. */
export function matchNavigatorLanguage(language: string | undefined | null): LocaleCode {
  if (!language) return DEFAULT_LOCALE;
  const lower = language.toLowerCase().replace(/_/g, "-");
  const exact = LOCALES.find((l) => l.code === lower);
  if (exact) return exact.code;
  const prefix = lower.split("-")[0];
  if (prefix && isLocaleCode(prefix)) return prefix;
  return DEFAULT_LOCALE;
}

export function detectLocale(): LocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  const nav =
    window.navigator?.language ||
    (window.navigator as Navigator & { userLanguage?: string }).userLanguage;
  return matchNavigatorLanguage(nav);
}

export function applyDocumentLocale(code: LocaleCode) {
  if (typeof document === "undefined") return;
  try {
    const meta = getLocaleMeta(code);
    document.documentElement.lang = code;
    document.documentElement.dir = meta.dir;
    document.documentElement.setAttribute("data-locale", code);
  } catch {
    /* some WebKit builds reject html dir/lang writes during render */
  }
}

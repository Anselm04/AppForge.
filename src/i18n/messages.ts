import type { LocaleCode } from "./locales.js";
import enJson from "./data/en.json";
import mi from "./data/mi.json";
import zh from "./data/zh.json";
import es from "./data/es.json";
import hi from "./data/hi.json";
import ar from "./data/ar.json";
import fr from "./data/fr.json";
import pt from "./data/pt.json";
import ja from "./data/ja.json";
import ko from "./data/ko.json";
import de from "./data/de.json";

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Messages = DeepString<typeof enJson>;
export const en: Messages = enJson;

/** Merge locale overlays onto English so missing keys fall back safely. */
function withEnglishFallback(overlay: Record<string, unknown>): Messages {
  const merge = (base: any, over: any): any => {
    if (!over || typeof over !== "object" || Array.isArray(over)) return over ?? base;
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base)) {
      out[key] =
        key in over ? merge(base[key], over[key]) : base[key];
    }
    for (const key of Object.keys(over)) {
      if (!(key in out)) out[key] = over[key];
    }
    return out;
  };
  return merge(enJson, overlay) as Messages;
}

export const messages: Record<LocaleCode, Messages> = {
  en,
  mi: withEnglishFallback(mi),
  zh: withEnglishFallback(zh),
  es: withEnglishFallback(es),
  hi: withEnglishFallback(hi),
  ar: withEnglishFallback(ar),
  fr: withEnglishFallback(fr),
  pt: withEnglishFallback(pt),
  ja: withEnglishFallback(ja),
  ko: withEnglishFallback(ko),
  de: withEnglishFallback(de),
};

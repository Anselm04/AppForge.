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

export const messages: Record<LocaleCode, Messages> = {
  en,
  mi,
  zh,
  es,
  hi,
  ar,
  fr,
  pt,
  ja,
  ko,
  de,
};

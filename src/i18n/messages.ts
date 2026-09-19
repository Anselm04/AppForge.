import type { LocaleCode } from "./locales.js";
import { LOCALES } from "./locales.js";
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

const coreMessages: Partial<Record<LocaleCode, Messages>> = {
  en,
  mi: mi as Messages,
  zh: zh as Messages,
  es: es as Messages,
  hi: hi as Messages,
  ar: ar as Messages,
  fr: fr as Messages,
  pt: pt as Messages,
  ja: ja as Messages,
  ko: ko as Messages,
  de: de as Messages,
};

const overlayModules = import.meta.glob("./data/overlays/*.json", {
  eager: true,
}) as Record<string, { default?: Messages } | Messages>;

function catalogFromModule(
  mod: { default?: Messages } | Messages | undefined,
): Messages | undefined {
  if (!mod) return undefined;
  if (typeof mod === "object" && "default" in mod && mod.default) {
    return mod.default as Messages;
  }
  return mod as Messages;
}

function buildMessages(): Record<LocaleCode, Messages> {
  const all = {} as Record<LocaleCode, Messages>;
  for (const [code, catalog] of Object.entries(coreMessages) as Array<
    [LocaleCode, Messages | undefined]
  >) {
    if (catalog) all[code] = catalog;
  }
  for (const loc of LOCALES) {
    if (all[loc.code]) continue;
    const mod = overlayModules[`./data/overlays/${loc.code}.json`];
    all[loc.code] = catalogFromModule(mod) ?? en;
  }
  return all;
}

/** Full locale catalogs: 11 hand-translated + 100+ overlays (chrome/home strings change). */
export const messages: Record<LocaleCode, Messages> = buildMessages();

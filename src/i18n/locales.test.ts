import { describe, expect, it } from "vitest";
import { messages } from "./messages.js";
import {
  applyDocumentLocale,
  getLocaleMeta,
  isReviewedLocale,
  localeLabel,
  LOCALES,
  REVIEWED_LOCALE_CODES,
} from "./locales.js";

describe("reviewed locale support", () => {
  it("keeps the advertised locale-choice count exact", () => {
    expect(LOCALES).toHaveLength(130);
  });

  it("keeps the reviewed locale set aligned with complete catalogs", () => {
    expect(REVIEWED_LOCALE_CODES).toHaveLength(11);
    for (const code of REVIEWED_LOCALE_CODES) {
      expect(messages[code]).toBeDefined();
      expect(isReviewedLocale(code)).toBe(true);
    }
  });

  it("labels unsupported locale choices as English fallbacks", () => {
    const unsupported = LOCALES.find(
      (locale) => !isReviewedLocale(locale.code),
    );
    expect(unsupported).toBeDefined();
    expect(localeLabel(unsupported!.code)).toContain("English fallback");
    expect(localeLabel("en")).toBe("English");
  });

  it("uses English document language and direction for an unsupported locale", () => {
    applyDocumentLocale("fa");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe(getLocaleMeta("en").dir);
    expect(document.documentElement.dataset.locale).toBe("fa");
  });
});

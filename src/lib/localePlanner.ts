/** Planner/Coder hints for non-English UI locales — output stays English for code compatibility. */
export function plannerLocaleHint(locale: string): string {
  if (!locale || locale === "en") return "";
  return `
UI locale for the generated app: ${locale}. Use appropriate i18n patterns if the stack supports it.
Keep code identifiers, file paths, and JSON keys in English; user-facing copy may reference locale ${locale}.
`.trim();
}

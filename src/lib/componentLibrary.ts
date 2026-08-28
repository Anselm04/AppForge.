/** Design-to-code presets inspired by v0/shadcn patterns — injected into coder prompts. */

export const COMPONENT_LIBRARY_HINT = `
Use a polished design system:
- Tailwind CSS utility classes, consistent spacing (4/8/16px scale)
- shadcn/ui-style components: Card, Button (primary/secondary/ghost), Input, Badge
- Accessible focus rings, semantic HTML, dark mode via class="dark"
- Typography: text-sm body, text-lg headings, font-medium labels
- Color: slate neutrals + one accent (blue-600 or brand color from assets)
`.trim();

export const BRAND_KIT_HINT = (assetPaths: string[]) => {
  if (assetPaths.length === 0) return "";
  return `
Brand assets available in the project (use in UI):
${assetPaths.map((p) => `- ${p}`).join("\n")}
Reference logos/graphics from public/assets/ in the generated app header or hero.
`.trim();
};

export const LOCALE_UI_HINT = (locale: string) => {
  if (!locale || locale === "en") return "";
  return `Generate user-facing UI strings in locale "${locale}" (keep code identifiers in English).`;
};

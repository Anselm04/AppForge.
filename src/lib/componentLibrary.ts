/** Design-to-code presets — Tailwind-only so generated apps install & compile. */

/** Pure Tailwind. Do NOT instruct the model to import shadcn packages we don't install. */
export const COMPONENT_LIBRARY_HINT = `
Use a production-grade UI with Tailwind CSS only (no external UI kit imports):
- Spacing: consistent 2/4/8/16/24 scale (p-4, gap-4, space-y-6)
- Layout: max-w-5xl or max-w-6xl mx-auto, responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3), flex
- Surfaces: rounded-xl border border-slate-800 bg-slate-900/50, cards with p-5
- Typography: text-sm text-slate-400 secondary, text-3xl/4xl font-semibold tracking-tight titles
- Color: dark slate base (bg-slate-950 text-slate-50), accent cyan-400 / cyan-500 for CTAs
- Buttons: rounded-lg px-5 py-2.5 text-sm font-medium; primary = bg-cyan-500 text-slate-950; secondary = border border-slate-700
- States: hover: transitions, focus-visible:ring-2 focus-visible:ring-cyan-500/50
- Forms: labeled fields (label + input with rounded-lg border border-slate-700 bg-slate-900 px-3 py-2)
- Never import from @/components/ui, shadcn, radix, or packages not listed in package.json
- Prefer a single cohesive App.tsx (plus small local components in the same file or src/components/*) over many half-finished modules
`.trim();

export const V0_PAGE_PATTERNS = `
Page structure patterns (match quality of v0 / Bolt first paint):
1. Marketing landing: hero (headline + sub + dual CTAs) → feature grid (3 cards) → footer
2. Dashboard: sidebar or top nav + stat cards row + main content panel
3. Settings: sections in cards with labeled inputs + Save button
4. Auth-style: centered card max-w-md with title, form, secondary link
Always use semantic landmarks (header, main, nav, footer).
First paint must show real content — never an empty shell or "TODO".
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

export function designSystemPrompt(opts?: {
  assetPaths?: string[];
  locale?: string;
  stack?: string;
}): string {
  const parts = [COMPONENT_LIBRARY_HINT, V0_PAGE_PATTERNS];
  if (opts?.stack?.includes("next")) {
    parts.push(
      "Use Next.js App Router: app/layout.tsx, app/page.tsx. No shadcn imports unless packages are in package.json.",
    );
  }
  if (opts?.assetPaths?.length) parts.push(BRAND_KIT_HINT(opts.assetPaths));
  if (opts?.locale) parts.push(LOCALE_UI_HINT(opts.locale));
  return parts.filter(Boolean).join("\n\n");
}

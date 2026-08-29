/** Design-to-code presets — v0/shadcn-quality patterns injected into coder prompts. */

export const COMPONENT_LIBRARY_HINT = `
Use a production-grade design system (v0 / shadcn quality):
- Tailwind CSS with consistent spacing scale (2/4/8/16/24px)
- shadcn/ui components: Card, Button (default/destructive/ghost/outline), Input, Label, Badge, Separator, Tabs, Dialog, Sheet, DropdownMenu, Avatar, Skeleton
- Layout: container mx-auto max-w-6xl, responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3), flex gap-4
- Typography: font-sans, text-sm text-muted-foreground for secondary, text-2xl font-semibold tracking-tight for page titles
- Color: CSS variables pattern — bg-background text-foreground border-border, accent via primary (blue-600 or brand)
- States: hover/focus-visible rings, disabled:opacity-50, loading skeletons
- Dark mode: class="dark" on html, dark: variants throughout
- Motion: subtle transitions (transition-colors duration-200), no distracting animations
- Forms: labeled fields, inline validation messages, accessible aria-* attributes
- Empty states: centered icon + headline + CTA button in muted Card
`.trim();

export const V0_PAGE_PATTERNS = `
Page structure patterns (match v0 output):
1. Marketing landing: hero (headline + sub + dual CTAs) → logo cloud → feature grid → testimonial → pricing CTA → footer
2. Dashboard: sidebar nav + header bar + stat cards row + data table or chart area
3. Settings: vertical tabs + form sections in Cards with Save/Cancel footer
4. Auth: centered Card max-w-md with logo, form, divider, social/OAuth placeholders
Always use semantic landmarks (header, main, nav, footer) and skip-to-content link.
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
      "Use Next.js App Router: app/layout.tsx with ThemeProvider, app/page.tsx as server component where possible, client components only when needed.",
    );
  }
  if (opts?.assetPaths?.length) parts.push(BRAND_KIT_HINT(opts.assetPaths));
  if (opts?.locale) parts.push(LOCALE_UI_HINT(opts.locale));
  return parts.filter(Boolean).join("\n\n");
}

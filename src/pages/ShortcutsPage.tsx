import { PageMeta } from "../components/layout/PageMeta.js";
import { Section } from "../design-system/Section.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { useLocale } from "../i18n/LocaleContext.js";

const SHORTCUTS = [
  { keys: ["⌘", "K"], id: "commandPalette" },
  { keys: ["⌘", "Enter"], id: "generate" },
  { keys: ["⌘", "S"], id: "save" },
  { keys: ["⌘", "B"], id: "build" },
  { keys: ["⌘", "/"], id: "search" },
  { keys: ["Esc"], id: "close" },
] as const;

export function ShortcutsPage() {
  const { t } = useLocale();

  return (
    <>
      <PageMeta
        title={t("shortcuts.title")}
        description={t("shortcuts.subtitle")}
      />
      <Section title={t("shortcuts.title")} subtitle={t("shortcuts.subtitle")}>
        <GlassCard
          hover={false}
          className="max-w-xl mx-auto divide-y divide-white/[0.06]"
        >
          {SHORTCUTS.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <span className="text-sm text-forge-text-muted">
                {t(`shortcuts.actions.${s.id}`)}
              </span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-1 rounded-lg bg-forge-bg border border-white/[0.08] text-xs font-mono text-forge-text-primary"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </GlassCard>
      </Section>
    </>
  );
}

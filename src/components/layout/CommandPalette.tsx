import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { useLocale } from "../../i18n/LocaleContext.js";
import {
  PLATFORM_FEATURES,
  featurePath,
} from "../../lib/platformFeatures.js";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: Props) {
  const { t } = useLocale();
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      { id: "dashboard", label: t("nav.dashboard"), path: "/dashboard" },
      { id: "new", label: t("landing.ctaPrimary"), path: "/app/new" },
      { id: "settings", label: t("nav.settings") || "Settings", path: "/settings" },
      { id: "studio", label: t("sidebar.studios") || "Studios", path: "/studio" },
      ...PLATFORM_FEATURES.map((f) => ({
        id: f.id,
        label: t(`${f.i18nKey}.title`),
        path: featurePath(f.id),
      })),
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-forge-surface shadow-2xl"
        label="Command palette"
      >
        <Command.Input
          autoFocus
          placeholder={t("dashboard.searchPlaceholder") || "Search…"}
          className="w-full border-b border-white/[0.06] bg-transparent px-4 py-3 text-sm text-forge-text-primary outline-none placeholder:text-forge-text-muted"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-forge-text-muted">
            No results
          </Command.Empty>
          {items.map((item) => (
            <Command.Item
              key={item.id}
              value={`${item.id} ${item.label}`}
              onSelect={() => {
                navigate(item.path);
                onOpenChange(false);
              }}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-forge-text-primary aria-selected:bg-white/[0.06]"
            >
              {item.label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

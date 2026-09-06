import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [q, setQ] = useState("");

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.id.toLowerCase().includes(needle) ||
        item.label.toLowerCase().includes(needle),
    );
  }, [items, q]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
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
      <div
        role="dialog"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-forge-surface shadow-2xl"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("dashboard.searchPlaceholder") || "Search…"}
          className="w-full border-b border-white/[0.06] bg-transparent px-4 py-3 text-sm text-forge-text-primary outline-none placeholder:text-forge-text-muted"
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-forge-text-muted">
              No results
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-forge-text-primary hover:bg-white/[0.06]"
                  onClick={() => {
                    navigate(item.path);
                    onOpenChange(false);
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

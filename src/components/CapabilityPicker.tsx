import {
  BUILD_CAPABILITIES,
  BUILD_CAPABILITY_IDS,
  type BuildCapabilityId,
} from "../lib/buildCapabilities.js";

type Props = {
  selected: BuildCapabilityId[];
  onChange: (next: BuildCapabilityId[]) => void;
  disabled?: boolean;
};

export function CapabilityPicker({ selected, onChange, disabled }: Props) {
  const toggle = (id: BuildCapabilityId) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Build capabilities{" "}
        <span className="font-normal text-slate-500">
          (optional — use alongside any stack)
        </span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BUILD_CAPABILITY_IDS.map((id) => {
          const meta = BUILD_CAPABILITIES[id];
          const on = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                on
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl" aria-hidden>
                  {meta.icon}
                </span>
                <div>
                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {meta.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  id: string;
};

export function Input({ label, hint, error, id, className, ...rest }: Props) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-forge-text-primary mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full h-11 px-3 rounded-xl bg-forge-bg border border-forge-border text-forge-text-primary placeholder:text-forge-text-muted focus:outline-none focus:border-forge-cyan/50 transition-colors duration-forge",
          error ? "border-red-500/60" : "",
          className,
        )}
        {...rest}
      />
      {hint && !error && (
        <p className="mt-2 text-xs text-forge-text-muted">{hint}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

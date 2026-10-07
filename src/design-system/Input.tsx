import { useState, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  id: string;
  /** Accessible label for the reveal control on password fields. */
  showPasswordLabel?: string;
  /** Accessible label for the conceal control on password fields. */
  hidePasswordLabel?: string;
};

function PasswordVisibilityIcon({ concealed }: { concealed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {concealed ? (
        <>
          <path d="M2.75 12S6.25 5.75 12 5.75 21.25 12 21.25 12 17.75 18.25 12 18.25 2.75 12 2.75 12Z" />
          <circle cx="12" cy="12" r="2.75" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.4 6.05A9.6 9.6 0 0 1 12 5.9c5.75 0 9.25 6.1 9.25 6.1a17.6 17.6 0 0 1-3.24 3.98" />
          <path d="M6.5 7.03A17.2 17.2 0 0 0 2.75 12s3.5 6.25 9.25 6.25c1.3 0 2.46-.28 3.48-.72" />
          <path d="M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9" />
        </>
      )}
    </svg>
  );
}

export function Input({
  label,
  hint,
  error,
  id,
  className,
  type = "text",
  disabled,
  showPasswordLabel = "Show password",
  hidePasswordLabel = "Hide password",
  ...rest
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

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
      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          disabled={disabled}
          className={cn(
            "w-full h-11 px-3 rounded-xl bg-forge-bg border border-forge-border text-forge-text-primary placeholder:text-forge-text-muted focus:outline-none focus:border-forge-cyan/50 transition-colors duration-forge",
            isPassword ? "pr-12" : "",
            error ? "border-red-500/60" : "",
            className,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            disabled={disabled}
            aria-label={revealed ? hidePasswordLabel : showPasswordLabel}
            aria-pressed={revealed}
            aria-controls={id}
            title={revealed ? hidePasswordLabel : showPasswordLabel}
            className="absolute inset-y-0 right-1.5 flex w-9 items-center justify-center rounded-lg text-forge-text-muted transition-colors duration-forge hover:text-forge-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-cyan/50 disabled:opacity-50"
          >
            <PasswordVisibilityIcon concealed={!revealed} />
          </button>
        )}
      </div>
      {hint && !error && (
        <p className="mt-2 text-xs text-forge-text-muted">{hint}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

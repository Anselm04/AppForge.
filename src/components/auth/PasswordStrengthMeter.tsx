import { useLocale } from "../../i18n/LocaleContext.js";
import {
  evaluatePasswordStrength,
  PASSWORD_CHECK_IDS,
  type PasswordCheckId,
  type PasswordStrengthLevel,
} from "../../lib/passwordStrength.js";
import { cn } from "../../lib/cn.js";

const LEVEL_TEXT: Record<PasswordStrengthLevel, string> = {
  weak: "text-red-500 dark:text-red-400",
  fair: "text-amber-600 dark:text-amber-300",
  good: "text-forge-cyan",
  strong: "text-emerald-600 dark:text-emerald-400",
};

const LEVEL_LABEL_KEY: Record<PasswordStrengthLevel, string> = {
  weak: "auth.strengthWeak",
  fair: "auth.strengthFair",
  good: "auth.strengthGood",
  strong: "auth.strengthStrong",
};

const CHECK_LABEL_KEY: Record<PasswordCheckId, string> = {
  length: "auth.checkLength",
  mixed: "auth.checkMixed",
  number: "auth.checkNumber",
  symbol: "auth.checkSymbol",
};

/** Advisory strength meter + requirement checklist for the signup password. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useLocale();
  if (!password) return null;

  const strength = evaluatePasswordStrength(password);

  return (
    <div data-testid="password-strength" className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-forge-text-muted">
          {t("signup.strength")}
        </span>
        <span
          data-testid="password-strength-level"
          className={cn("text-xs font-semibold", LEVEL_TEXT[strength.level])}
        >
          {t(LEVEL_LABEL_KEY[strength.level])}
        </span>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-forge",
              index < strength.score
                ? strength.level === "weak"
                  ? "bg-red-500/70"
                  : strength.level === "fair"
                    ? "bg-amber-500/70"
                    : strength.level === "good"
                      ? "bg-forge-cyan/70"
                      : "bg-emerald-500/70"
                : "bg-forge-border",
            )}
          />
        ))}
      </div>

      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_CHECK_IDS.map((id) => {
          const met = strength.passed.includes(id);
          return (
            <li
              key={id}
              className={cn(
                "flex items-center gap-2 text-xs",
                met ? "text-forge-text-primary" : "text-forge-text-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px] font-bold",
                  met
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "border-forge-border text-transparent",
                )}
              >
                ✓
              </span>
              {t(CHECK_LABEL_KEY[id])}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

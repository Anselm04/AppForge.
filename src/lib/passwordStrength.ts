/**
 * Password policy + advisory strength scoring shared by the auth forms.
 *
 * Only the minimum length is enforced (it matches the server-side signup
 * rule); the remaining checks drive an advisory strength meter so people can
 * see how to make a stronger password without being blocked by it.
 */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordCheckId = "length" | "mixed" | "number" | "symbol";
export type PasswordStrengthLevel = "weak" | "fair" | "good" | "strong";

export const PASSWORD_CHECK_IDS: readonly PasswordCheckId[] = [
  "length",
  "mixed",
  "number",
  "symbol",
];

export interface PasswordStrength {
  /** Number of advisory checks that passed (0–4). */
  score: number;
  level: PasswordStrengthLevel;
  /** Whether the enforced minimum length is met. */
  meetsMinimum: boolean;
  passed: PasswordCheckId[];
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const passed: PasswordCheckId[] = [];

  if (password.length >= MIN_PASSWORD_LENGTH) passed.push("length");
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) passed.push("mixed");
  if (/\d/.test(password)) passed.push("number");
  if (/[^A-Za-z0-9]/.test(password)) passed.push("symbol");

  const score = passed.length;
  const level: PasswordStrengthLevel =
    score <= 1
      ? "weak"
      : score === 2
        ? "fair"
        : score === 3
          ? "good"
          : "strong";

  return {
    score,
    level,
    meetsMinimum: password.length >= MIN_PASSWORD_LENGTH,
    passed,
  };
}

/** Pragmatic email shape check for inline form validation. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (trimmed.includes(" ")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

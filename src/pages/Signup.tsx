import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { getSession, safeAuthDestination, signUp } from "../lib/auth.js";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "../lib/passwordStrength.js";
import { trpc } from "../utils/trpc.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { AuthShell } from "../components/auth/AuthShell.js";
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons.js";
import { PasswordStrengthMeter } from "../components/auth/PasswordStrengthMeter.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";

export function Signup() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeAuthDestination(searchParams.get("next")),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);

  const emailError =
    touchedEmail && email.length > 0 && !isValidEmail(email)
      ? t("common.emailInvalid")
      : undefined;
  const confirmError =
    confirm.length > 0 && confirm !== password
      ? t("signup.mismatch")
      : undefined;

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  useEffect(() => {
    if (me && !checkEmail) {
      navigate(next, { replace: true });
    }
  }, [me, checkEmail, next, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setTouchedEmail(true);
      return;
    }
    if (password !== confirm) {
      setError(t("signup.mismatch"));
      return;
    }
    setPending(true);
    try {
      await signUp(email.trim(), password, next);
      if (getSession()) {
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
        navigate(next, { replace: true });
        return;
      }
      setCheckEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signup.failed"));
    } finally {
      setPending(false);
    }
  };

  if (checkEmail) {
    return (
      <AuthShell title={t("signup.checkTitle")}>
        <div className="space-y-5 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-forge-cyan/30 bg-forge-cyan/10 text-forge-cyan"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
              <path d="m3 6.5 9 6.5 9-6.5" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed text-forge-text-muted">
            {t("signup.checkBody", { email: email.trim() })}
          </p>
          <p
            data-testid="signup-verification-note"
            className="rounded-lg border border-forge-border bg-forge-surface/60 px-3 py-2 text-xs text-forge-text-muted"
          >
            {t("signup.verifyNote")}
          </p>
          <Button
            className="w-full"
            onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
          >
            {t("signup.goToLogin")}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("signup.title")}
      subtitle={t("signup.subtitle")}
      footer={
        <>
          {t("signup.hasAccount")}{" "}
          <Link
            to={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-forge-cyan hover:underline"
          >
            {t("signup.logIn")}
          </Link>
        </>
      }
    >
      {error && (
        <p
          role="alert"
          data-testid="signup-error"
          className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      <SocialAuthButtons next={next} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          id="signup-email"
          label={t("signup.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          error={emailError}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouchedEmail(true)}
        />
        <div>
          <Input
            id="signup-password"
            label={t("signup.password")}
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showPasswordLabel={t("common.showPassword")}
            hidePasswordLabel={t("common.hidePassword")}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <Input
          id="signup-confirm"
          label={t("signup.confirm")}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
          showPasswordLabel={t("common.showPassword")}
          hidePasswordLabel={t("common.hidePassword")}
        />
        <Button
          type="submit"
          className="w-full"
          loading={pending}
          disabled={
            pending ||
            !email.trim() ||
            password.length < MIN_PASSWORD_LENGTH ||
            confirm.length < MIN_PASSWORD_LENGTH
          }
        >
          {pending ? t("signup.pending") : t("signup.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}

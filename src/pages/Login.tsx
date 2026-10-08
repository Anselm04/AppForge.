import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeAuthRedirect,
  safeAuthDestination,
  signIn,
} from "../lib/auth.js";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "../lib/passwordStrength.js";
import { trpc } from "../utils/trpc.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { AuthShell } from "../components/auth/AuthShell.js";
import { SocialAuthButtons } from "../components/auth/SocialAuthButtons.js";
import { Button } from "../design-system/Button.js";
import { Input } from "../design-system/Input.js";

const MIN_PASSWORD_LENGTH_LOCAL = MIN_PASSWORD_LENGTH;

/**
 * Turn a raw auth-provider failure into copy a person can act on. Verification
 * failures are called out explicitly so an unconfirmed account is never shown a
 * bare "sign-in failed" that hides the verification step.
 */
function describeSignInError(
  error: unknown,
  t: (key: string) => string,
): string {
  const message = error instanceof Error ? error.message : "";
  if (/not confirmed|confirm your email|email_not_confirmed/i.test(message)) {
    return t("login.emailNotConfirmed");
  }
  if (
    /invalid login credentials|invalid_grant|invalid password/i.test(message)
  ) {
    return t("login.invalidCredentials");
  }
  if (/rate limit|too many requests/i.test(message)) {
    return t("login.rateLimited");
  }
  return message || t("login.failed");
}

export function Login() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeAuthDestination(searchParams.get("next")),
    [searchParams],
  );
  const loginError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [completingConfirmation, setCompletingConfirmation] = useState(false);
  const [blurred, setBlurred] = useState<{ email: boolean; password: boolean }>(
    { email: false, password: false },
  );

  const emailError =
    blurred.email && email.length > 0 && !isValidEmail(email)
      ? t("common.emailInvalid")
      : undefined;
  const passwordError =
    blurred.password &&
    password.length > 0 &&
    password.length < MIN_PASSWORD_LENGTH_LOCAL
      ? t("signup.minChars")
      : undefined;

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });

  const { data: ssoInfo } = useQuery({
    queryKey: ["sso", "discover", email],
    queryFn: () => trpc.sso.discover.query({ email: email.trim() }),
    enabled: email.includes("@") && email.trim().length > 5,
  });

  useEffect(() => {
    let cancelled = false;
    const completeConfirmation = async () => {
      if (typeof window === "undefined") return;
      const hasAuthRedirect =
        window.location.hash.includes("access_token=") ||
        window.location.search.includes("access_token=") ||
        window.location.hash.includes("error_description=") ||
        window.location.search.includes("error_description=");
      if (!hasAuthRedirect) return;

      setCompletingConfirmation(true);
      setError(null);
      try {
        const session = await completeAuthRedirect();
        if (!session || cancelled) return;
        const meNow = await trpc.auth.me.query();
        if (cancelled) return;
        queryClient.setQueryData(["auth", "me"], meNow);
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
        if (!cancelled) navigate(next, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(describeSignInError(err, t));
        }
      } finally {
        if (!cancelled) setCompletingConfirmation(false);
      }
    };
    void completeConfirmation();
    return () => {
      cancelled = true;
    };
  }, [navigate, next, queryClient, t]);

  useEffect(() => {
    if (me && !completingConfirmation) {
      navigate(next, { replace: true });
    }
  }, [me, completingConfirmation, next, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) {
      setBlurred((previous) => ({ ...previous, email: true }));
      return;
    }
    setPending(true);
    try {
      await signIn(email.trim(), password);
      const meNow = await trpc.auth.me.query();
      queryClient.setQueryData(["auth", "me"], meNow);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate(next, { replace: true });
    } catch (err) {
      setError(describeSignInError(err, t));
    } finally {
      setPending(false);
    }
  };

  const startSso = () => {
    if (!ssoInfo?.ssoAvailable) return;
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return;
    window.location.href = `/api/sso/login?domain=${encodeURIComponent(domain)}&next=${encodeURIComponent(next)}`;
  };

  const alertMessage =
    error ||
    (loginError === "sso_exchange_failed"
      ? t("login.ssoFailed")
      : loginError
        ? t("login.failed")
        : null);

  return (
    <AuthShell
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <>
          {t("login.newTo")}{" "}
          <Link
            to={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-forge-cyan hover:underline"
          >
            {t("login.createAccount")}
          </Link>
        </>
      }
    >
      {completingConfirmation && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-forge-cyan"
        >
          {t("login.confirming")}
        </p>
      )}

      {alertMessage && (
        <p
          role="alert"
          data-testid="login-error"
          className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200"
        >
          {alertMessage}
        </p>
      )}

      <SocialAuthButtons next={next} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          id="login-email"
          label={t("login.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          error={emailError}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() =>
            setBlurred((previous) => ({ ...previous, email: true }))
          }
        />
        <Input
          id="login-password"
          label={t("login.password")}
          type="password"
          autoComplete="current-password"
          required
          minLength={MIN_PASSWORD_LENGTH_LOCAL}
          value={password}
          error={passwordError}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() =>
            setBlurred((previous) => ({ ...previous, password: true }))
          }
          showPasswordLabel={t("common.showPassword")}
          hidePasswordLabel={t("common.hidePassword")}
        />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-forge-cyan hover:underline"
          >
            {t("login.forgot")}
          </Link>
        </div>
        <Button
          type="submit"
          className="w-full"
          loading={pending || completingConfirmation}
          disabled={
            pending ||
            completingConfirmation ||
            !email.trim() ||
            password.length < MIN_PASSWORD_LENGTH_LOCAL
          }
        >
          {pending ? t("login.pending") : t("login.submit")}
        </Button>
      </form>

      {ssoInfo?.ssoAvailable && (
        <div className="mt-6 border-t border-forge-border pt-6">
          <p className="mb-3 text-sm text-forge-text-muted">
            {t("login.ssoUses", {
              org: ssoInfo.orgName ?? "",
              provider: ssoInfo.provider?.toUpperCase() ?? "",
            })}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={startSso}
          >
            {t("login.signInWithSso")}
          </Button>
        </div>
      )}
    </AuthShell>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { completeAuthRedirect, signIn } from "../lib/auth.js";
import { trpc } from "../utils/trpc.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { LogoLockup } from "../components/brand/LogoMark.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Input } from "../design-system/Input.js";

function safeNext(value: string | null): string {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }
  return "/";
}

export function Login() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );
  const loginError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [phoneHint, setPhoneHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [completingConfirmation, setCompletingConfirmation] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });

  const { data: verificationStatus } = useQuery({
    queryKey: ["auth", "loginVerificationStatus"],
    queryFn: () => trpc.auth.loginVerificationStatus.query(),
    staleTime: 0,
  });

  const { data: ssoInfo } = useQuery({
    queryKey: ["sso", "discover", email],
    queryFn: () => trpc.sso.discover.query({ email: email.trim() }),
    enabled: email.includes("@") && email.trim().length > 5,
  });

  const sendVerification = async () => {
    const result = await trpc.auth.requestLoginVerification.mutate();
    setPhoneHint(result.phoneHint || "your registered mobile");
    setVerificationCode("");
    setVerificationRequired(true);
  };

  useEffect(() => {
    if (
      verificationStatus?.authenticated &&
      !verificationStatus.verified &&
      !verificationRequired
    ) {
      setPhoneHint(
        "phoneHint" in verificationStatus
          ? verificationStatus.phoneHint || "your registered mobile"
          : "your registered mobile",
      );
      setVerificationRequired(true);
    }
  }, [verificationStatus, verificationRequired]);

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
        await sendVerification();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Account confirmation could not be completed.",
          );
        }
      } finally {
        if (!cancelled) setCompletingConfirmation(false);
      }
    };
    void completeConfirmation();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (me && verificationStatus?.verified && !completingConfirmation) {
      navigate(next, { replace: true });
    }
  }, [me, verificationStatus, completingConfirmation, next, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      await sendVerification();
      await queryClient.invalidateQueries({
        queryKey: ["auth", "loginVerificationStatus"],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setPending(false);
    }
  };

  const handleVerification = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await trpc.auth.verifyLoginVerification.mutate({
        code: verificationCode.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      const meNow = await trpc.auth.me.query();
      if (!meNow) throw new Error("Phone verification did not complete.");
      queryClient.setQueryData(["auth", "me"], meNow);
      navigate(next, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verification code was not accepted.",
      );
    } finally {
      setPending(false);
    }
  };

  const resendVerification = async () => {
    setError(null);
    setPending(true);
    try {
      await sendVerification();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send a new code.",
      );
    } finally {
      setPending(false);
    }
  };

  const startSso = () => {
    if (!ssoInfo?.ssoAvailable) return;
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return;
    window.location.href = `/api/sso/login?domain=${encodeURIComponent(domain)}&next=${encodeURIComponent(`/login?next=${encodeURIComponent(next)}`)}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-forge-mesh">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/">
            <LogoLockup size="sm" />
          </Link>
        </div>
        <div className="text-center mb-8">
          <h1 className="forge-h2 text-forge-text-primary mb-2">
            {verificationRequired ? "Verify your identity" : t("login.title")}
          </h1>
          <p className="text-forge-text-muted">
            {verificationRequired
              ? "Enter the SMS code sent to your registered mobile number. AppForge does not open your account until this verification succeeds."
              : t("login.subtitle")}
          </p>
        </div>
        <GlassCard hover={false} padding="lg">
          {completingConfirmation && (
            <p className="text-sm text-forge-cyan mb-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-2">
              Email confirmed. Preparing mobile verification…
            </p>
          )}
          {(loginError || error) && (
            <p className="text-sm text-amber-600 dark:text-amber-300 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              {error ||
                (loginError === "sso_exchange_failed"
                  ? t("login.ssoFailed")
                  : t("login.failed"))}
            </p>
          )}

          {verificationRequired ? (
            <form onSubmit={handleVerification} className="space-y-5">
              <p className="text-sm text-forge-text-muted">
                Code sent to {phoneHint || "your registered mobile"}
              </p>
              <Input
                id="login-verification-code"
                name="verification-code"
                label="Verification code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
              />
              <Button
                type="submit"
                className="w-full"
                loading={pending}
                disabled={pending || verificationCode.length !== 6}
              >
                {pending ? "Verifying…" : "Verify and sign in"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void resendVerification()}
                disabled={pending}
              >
                Send another code
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  id="login-email"
                  name="email"
                  label={t("login.email")}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  id="login-password"
                  name="password"
                  label={t("login.password")}
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-forge-cyan hover:underline font-medium"
                  >
                    Forgot password?
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
                    password.length < 8
                  }
                >
                  {pending ? "Checking credentials…" : "Continue securely"}
                </Button>
              </form>

              {ssoInfo?.ssoAvailable && (
                <div className="mt-6 pt-6 border-t border-forge-border">
                  <p className="text-sm text-forge-text-muted mb-3">
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

              <p className="text-sm text-forge-text-muted mt-6 text-center">
                {t("login.newTo")}{" "}
                <Link
                  to={`/signup?next=${encodeURIComponent(next)}`}
                  className="text-forge-cyan hover:underline font-medium"
                >
                  {t("login.createAccount")}
                </Link>
              </p>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

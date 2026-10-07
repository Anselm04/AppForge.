import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient } from "../lib/supabase-client.js";
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

function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, "");
}

export function Signup() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

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
    const normalizedPhone = normalizePhone(phone);
    if (fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError("Enter your mobile number with country code, for example +64221234567.");
      return;
    }
    if (password !== confirm) {
      setError(t("signup.mismatch"));
      return;
    }
    setPending(true);
    try {
      await supabaseClient.signUp(
        email.trim().toLowerCase(),
        password,
        next,
        fullName.trim(),
        normalizedPhone,
      );
      setCheckEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signup.failed"));
    } finally {
      setPending(false);
    }
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
            {t("signup.title")}
          </h1>
          <p className="text-forge-text-muted">{t("signup.subtitle")}</p>
        </div>
        <GlassCard hover={false} padding="lg">
          {checkEmail ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-forge-text-primary">
                Check your email
              </h2>
              <p className="text-forge-text-muted">
                Confirm {email.trim()} first. Then sign in and AppForge will send
                a verification code to your registered mobile number before
                allowing account access.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(`/login?next=${encodeURIComponent(next)}`)
                }
              >
                Go to login
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  id="signup-full-name"
                  name="full-name"
                  label="Full name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  id="signup-phone"
                  name="phone"
                  label="Mobile number"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+64221234567"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  hint="Include your country code. AppForge verifies this number before every new login session."
                />
                <Input
                  id="signup-email"
                  name="email"
                  label={t("signup.email")}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  id="signup-password"
                  name="password"
                  label={t("signup.password")}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint="Use at least 8 characters."
                />
                <Input
                  id="signup-confirm"
                  name="confirm-password"
                  label={t("signup.confirm")}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  error={error ?? undefined}
                />
                <Button
                  type="submit"
                  className="w-full"
                  loading={pending}
                  disabled={
                    pending ||
                    fullName.trim().length < 2 ||
                    !phone.trim() ||
                    !email.trim() ||
                    password.length < 8
                  }
                >
                  {pending ? t("signup.pending") : t("signup.submit")}
                </Button>
              </form>
              <p className="text-sm text-forge-text-muted mt-6 text-center">
                {t("signup.hasAccount")}{" "}
                <Link
                  to={`/login?next=${encodeURIComponent(next)}`}
                  className="text-forge-cyan hover:underline font-medium"
                >
                  {t("signup.logIn")}
                </Link>
              </p>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

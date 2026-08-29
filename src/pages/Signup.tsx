import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { getSession, signUp } from "../lib/auth.js";
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

export function Signup() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );

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
    if (password !== confirm) {
      setError(t("signup.mismatch"));
      return;
    }
    setPending(true);
    try {
      await signUp(email.trim(), password);
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
                {t("signup.checkTitle")}
              </h2>
              <p className="text-forge-text-muted">
                {t("signup.checkBody", { email: email.trim() })}
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(`/login?next=${encodeURIComponent(next)}`)
                }
              >
                {t("signup.goToLogin")}
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  id="signup-email"
                  label={t("signup.email")}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  id="signup-password"
                  label={t("signup.password")}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint={t("signup.minChars")}
                />
                <Input
                  id="signup-confirm"
                  label={t("signup.confirm")}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  error={error ?? undefined}
                />
                <Button
                  type="submit"
                  className="w-full"
                  loading={pending}
                  disabled={pending || !email.trim() || password.length < 6}
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

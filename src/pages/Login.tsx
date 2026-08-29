import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signIn } from "../lib/auth.js";
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  const { data: ssoInfo } = useQuery({
    queryKey: ["sso", "discover", email],
    queryFn: () => trpc.sso.discover.query({ email: email.trim() }),
    enabled: email.includes("@") && email.trim().length > 5,
  });

  useEffect(() => {
    if (me) {
      navigate(next, { replace: true });
    }
  }, [me, next, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn(email.trim(), password);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
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
            {t("login.title")}
          </h1>
          <p className="text-forge-text-muted">{t("login.subtitle")}</p>
        </div>
        <GlassCard hover={false} padding="lg">
          {(loginError || error) && (
            <p className="text-sm text-amber-600 dark:text-amber-300 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              {error ||
                (loginError === "sso_exchange_failed"
                  ? t("login.ssoFailed")
                  : t("login.failed"))}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="login-email"
              label={t("login.email")}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="login-password"
              label={t("login.password")}
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              className="w-full"
              loading={pending}
              disabled={pending || !email.trim() || password.length < 6}
            >
              {pending ? t("login.pending") : t("login.submit")}
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
        </GlassCard>
      </div>
    </div>
  );
}

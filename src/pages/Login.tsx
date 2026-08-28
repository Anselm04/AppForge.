import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signIn } from "../lib/auth.js";
import { trpc } from "../utils/trpc.js";
import { useLocale } from "../i18n/LocaleContext.js";

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            {t("login.title")}
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            {t("login.subtitle")}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          {(loginError || error) && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
              {error ||
                (loginError === "sso_exchange_failed"
                  ? "Enterprise SSO sign-in failed. Try again or use password."
                  : "Sign-in failed.")}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
              >
                {t("login.email")}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
              >
                {t("login.password")}
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={pending || !email.trim() || password.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {pending ? t("login.pending") : t("login.submit")}
            </button>
          </form>

          {ssoInfo?.ssoAvailable && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {ssoInfo.orgName} uses enterprise SSO (
                {ssoInfo.provider?.toUpperCase()}).
              </p>
              <button
                type="button"
                onClick={startSso}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-lg"
              >
                Sign in with SSO
              </button>
            </div>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-6 text-center">
            {t("login.newTo")}{" "}
            <Link
              to={`/signup?next=${encodeURIComponent(next)}`}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              {t("login.createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

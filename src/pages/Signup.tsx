import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { getSession, signUp } from "../lib/auth.js";
import { trpc } from "../utils/trpc.js";
import { useLocale } from "../i18n/LocaleContext.js";

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return "/";
}

export function Signup() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t("signup.title")}</h1>
          <p className="text-slate-600 dark:text-slate-300">{t("signup.subtitle")}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          {checkEmail ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("signup.checkTitle")}</h2>
              <p className="text-slate-600 dark:text-slate-300">
                {t("signup.checkBody", { email: email.trim() })}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {t("signup.goToLogin")}
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {t("signup.email")}
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {t("signup.password")}
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t("signup.minChars")}</p>
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {t("signup.confirm")}
                  </label>
                  <input
                    id="signup-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                {error && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={pending || !email.trim() || password.length < 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {pending ? t("signup.pending") : t("signup.submit")}
                </button>
              </form>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-6 text-center">
                {t("signup.hasAccount")}{" "}
                <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-blue-600 hover:text-blue-700 font-semibold">
                  {t("signup.logIn")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

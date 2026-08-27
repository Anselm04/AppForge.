import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/auth.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { useLocale } from "../i18n/LocaleContext.js";

export function TopNav() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [isDark, setIsDark] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
    enabled: !!user,
  });

  const session = useSession();

  const logout = useMutation({
    mutationFn: async () => {
      signOut();
      await trpc.auth.logout.mutate();
    },
    onSuccess: () => {
      navigate("/");
    },
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const isPaid = subStatus?.isPaid ?? false;
  const tier = subStatus?.tier ?? "free";
  const isTrialing = subStatus?.isTrialing ?? false;
  const email = user?.email || session?.user?.email;
  const isLoggedIn = !!user || !!session;
  const isOwner = email === "anselm.perkins@gmail.com";

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="text-2xl font-bold text-blue-600 hover:text-blue-700"
        >
          AppForge
        </button>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />

          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {isDark ? t("nav.light") : t("nav.dark")}
          </button>

          {isLoggedIn ? (
            <>
              {isOwner && (
                <button
                  onClick={() => navigate("/admin")}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
                >
                  {t("nav.admin")}
                </button>
              )}

              <button
                onClick={() => navigate("/dashboard")}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                {t("nav.dashboard")}
              </button>

              <button
                onClick={() => navigate("/editor")}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                {t("nav.editor")}
              </button>

              {!isPaid && !isTrialing && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  {t("nav.upgrade")}
                </button>
              )}

              {isTrialing && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 px-3 py-1 rounded-full font-semibold">
                  {t("nav.trial", { tier })}
                </span>
              )}

              {isPaid && !isTrialing && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 px-3 py-1 rounded-full font-semibold capitalize">
                  {tier}
                </span>
              )}

              <button
                onClick={() => logout.mutate()}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                {t("nav.login")}
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                {t("nav.signUp")}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc";
import { useNavigate } from "react-router-dom";

export function TopNav() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = React.useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
    enabled: !!user,
  });

  const logout = useMutation({
    mutationFn: () => trpc.auth.logout.mutate(),
    onSuccess: () => {
      navigate("/");
    },
  });

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="text-2xl font-bold text-blue-600 hover:text-blue-700"
        >
          🚀 AppForge
        </button>

        <div className="flex items-center gap-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            {isDark ? "☀️" : "🌙"}
          </button>

          {user ? (
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Dashboard
              </button>

              {!subStatus?.isPro && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  Upgrade to Pro
                </button>
              )}

              {subStatus?.isPro && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 px-3 py-1 rounded-full font-semibold">
                  ✨ PRO
                </span>
              )}

              <button
                onClick={() => logout.mutate()}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Login
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

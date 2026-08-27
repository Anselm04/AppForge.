import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getSession, signUp, useSession } from "../lib/auth.js";

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return "/";
}

export function Signup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const session = useSession();
  const next = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (session && !checkEmail) {
      navigate(next, { replace: true });
    }
  }, [session, checkEmail, next, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
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
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Create your account</h1>
          <p className="text-slate-600 dark:text-slate-300">Start building full-stack apps with AI.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          {checkEmail ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Check your email</h2>
              <p className="text-slate-600 dark:text-slate-300">
                We sent a confirmation link to <span className="font-semibold">{email.trim()}</span>.
                Confirm your address, then log in to start a session.
              </p>
              <button
                type="button"
                onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Email
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
                    Password
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">At least 6 characters.</p>
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Confirm password
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
                  {pending ? "Creating account..." : "Sign up"}
                </button>
              </form>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-6 text-center">
                Already have an account?{" "}
                <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-blue-600 hover:text-blue-700 font-semibold">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

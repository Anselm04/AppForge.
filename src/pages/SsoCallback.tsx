import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

/** Client handoff after server SSO code exchange — persists Supabase session locally. */
export function SsoCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  useEffect(() => {
    const next = safeNext(params.get("next"));
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/sso/session", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error("SSO session unavailable");
        }

        const session = (await response.json()) as {
          accessToken?: string;
          refreshToken?: string;
          user?: { id: string; email?: string };
        };
        if (!session.accessToken || !session.user?.id) {
          throw new Error("Invalid SSO session payload");
        }

        localStorage.setItem(
          "appforge.session",
          JSON.stringify({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            user: session.user,
          }),
        );
        void queryClient.invalidateQueries({ queryKey: ["auth"] });
        if (!cancelled) navigate(next, { replace: true });
      } catch {
        if (!cancelled) {
          navigate(
            `/login?error=sso_session_invalid&next=${encodeURIComponent(next)}`,
            { replace: true },
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, navigate, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <p>Completing SSO sign-in…</p>
    </div>
  );
}

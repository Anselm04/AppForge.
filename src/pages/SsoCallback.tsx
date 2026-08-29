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
    const raw = params.get("session");
    const next = safeNext(params.get("next"));
    if (!raw) {
      navigate(
        `/login?error=sso_session_missing&next=${encodeURIComponent(next)}`,
        {
          replace: true,
        },
      );
      return;
    }
    try {
      const session = JSON.parse(decodeURIComponent(raw)) as {
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
      navigate(next, { replace: true });
    } catch {
      navigate(
        `/login?error=sso_session_invalid&next=${encodeURIComponent(next)}`,
        {
          replace: true,
        },
      );
    }
  }, [params, navigate, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <p>Completing SSO sign-in…</p>
    </div>
  );
}

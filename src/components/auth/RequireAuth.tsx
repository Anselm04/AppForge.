import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../../utils/trpc.js";

type Props = {
  children?: ReactNode;
};

export function RequireAuth({ children }: Props) {
  const location = useLocation();
  const {
    data: me,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
        <p className="text-forge-text-muted" role="status">
          Checking sign-in…
        </p>
      </div>
    );
  }

  if (isError || !me) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

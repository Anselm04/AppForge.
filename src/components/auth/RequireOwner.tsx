import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../../utils/trpc.js";
import { GlassCard } from "../../design-system/GlassCard.js";

type Props = {
  children: ReactNode;
};

/**
 * Client-side gate for the owner-only admin dashboard.
 *
 * The server stays authoritative: every `admin.*` procedure is guarded by
 * ownerAuthenticatedProcedure (verified session + owner email) and
 * ownerOnlyProcedure (owner SMS verification). This guard exists so a
 * non-owner never mounts the admin shell or fires admin requests at all.
 */
export function RequireOwner({ children }: Props) {
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
          Checking admin access…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
        <GlassCard hover={false} padding="lg" className="w-full max-w-md">
          <h1 className="text-xl font-semibold text-forge-text-primary mb-2">
            Unable to verify access
          </h1>
          <p className="text-forge-text-muted" role="alert">
            We could not confirm your account right now. Refresh the page or
            sign in again.
          </p>
          <Link
            to={`/login?next=${encodeURIComponent(location.pathname)}`}
            className="mt-4 inline-block text-sm text-forge-cyan hover:underline font-medium"
          >
            Go to sign in
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!me) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (!me.isOwner) {
    return (
      <div
        data-testid="owner-guard-denied"
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16"
      >
        <GlassCard hover={false} padding="lg" className="w-full max-w-md">
          <h1 className="text-xl font-semibold text-forge-text-primary mb-2">
            Access Denied
          </h1>
          <p className="text-forge-text-muted" role="alert">
            This dashboard is restricted to the AppForge owner account.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block text-sm text-forge-cyan hover:underline font-medium"
          >
            Back to your dashboard
          </Link>
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
}

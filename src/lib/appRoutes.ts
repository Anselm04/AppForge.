/**
 * Canonical list of the app's statically declared routes.
 *
 * `src/App.tsx` owns the actual <Route> elements; this list exists so shared
 * code (feature links, command palette, navigation) can tell whether a
 * destination is real before offering it. `appRoutesContract.test.ts` fails if
 * the two ever drift apart, so a link can never silently dead-end in the
 * catch-all route again.
 */
export const APP_ROUTES = [
  "/",
  "/about",
  "/account",
  "/admin",
  "/ai-builder",
  "/app/new",
  "/auth/sso/callback",
  "/build/:projectId",
  "/dashboard",
  "/discover",
  "/editor",
  "/features/:id",
  "/forgot-password",
  "/help",
  "/login",
  "/password-reset",
  "/pricing",
  "/redeem",
  "/resend-verification",
  "/settings",
  "/settings/org",
  "/shortcuts",
  "/signup",
  "/studio",
  "/studio/ar",
  "/studio/architecture",
  "/studio/cad",
  "/studio/collab",
  "/studio/data",
  "/studio/education",
  "/studio/fintech",
  "/studio/game",
  "/studio/healthcare",
  "/studio/legal",
  "/studio/localization",
  "/studio/marketing",
  "/studio/mobile",
  "/studio/music",
  "/studio/patent",
  "/studio/video",
  "/studio/voice",
  "/templates",
  "/tools",
] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

function segments(path: string): string[] {
  return path.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

/** True when `path` matches a declared app route, including `:param` segments. */
export function isKnownAppRoute(path: string | undefined | null): boolean {
  if (!path || !path.startsWith("/")) return false;
  const target = segments(path);
  return APP_ROUTES.some((route) => {
    const candidate = segments(route);
    if (candidate.length !== target.length) return false;
    return candidate.every(
      (segment, index) => segment.startsWith(":") || segment === target[index],
    );
  });
}

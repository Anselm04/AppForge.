import { getSessionCookieOptions } from "../_core/cookies";
import { systemRouter } from "../_core/systemRouter";
import { publicProcedure, router } from "../_core/trpc";
import { projectsRouter } from "./projects";
import { subscriptionsRouter } from "./subscriptions";
import { githubRouter } from "./github";
import { cosineRouter } from "./cosine";

/** Session cookie name used by auth.logout. Kept local until a shared const module exists. */
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "appforge_session";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  projects: projectsRouter,
  subscriptions: subscriptionsRouter,
  github: githubRouter,
  cosine: cosineRouter,
});

export type AppRouter = typeof appRouter;

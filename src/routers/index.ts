import { COOKIE_NAME } from "../_core/cookies.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import { systemRouter } from "../_core/systemRouter.js";
import { publicProcedure, router } from "../_core/trpc.js";
import { projectsRouter } from "./projects.js";
import { subscriptionsRouter } from "./subscriptions.js";
import { githubRouter } from "./github.js";
import { cosineRouter } from "./cosine.js";
import { adminRouter } from "./admin.js";
import { moderationRouter } from "./moderation.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  projects: projectsRouter,
  subscriptions: subscriptionsRouter,
  github: githubRouter,
  cosine: cosineRouter,
  admin: adminRouter,
  moderation: moderationRouter,
});

export type AppRouter = typeof appRouter;

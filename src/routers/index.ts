import { COOKIE_NAME } from "../_core/cookies.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import { systemRouter } from "../_core/systemRouter.js";
import { publicProcedure, router } from "../_core/trpc.js";
import { isOwnerEmail } from "../lib/owner.js";
import { projectsRouter } from "./projects.js";
import { subscriptionsRouter } from "./subscriptions.js";
import { githubRouter } from "./github.js";
import { cosineRouter } from "./cosine.js";
import { adminRouter } from "./admin.js";
import { moderationRouter } from "./moderation.js";
import { projectChatRouter } from "./projectChat.js";
import { analyticsRouter } from "./analytics.js";
import { templatesRouter } from "./templates.js";
import { assetsRouter } from "./assets.js";
import { capabilitiesRouter } from "./capabilities.js";
import { sandboxRouter } from "./sandbox.js";
import { orgsRouter } from "./orgs.js";
import { ssoRouter } from "./sso.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      const email = (user.email ?? "").trim().toLowerCase();
      return {
        id: user.id,
        email,
        name: user.name,
        isOwner: isOwnerEmail(email),
      };
    }),
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
  projectChat: projectChatRouter,
  analytics: analyticsRouter,
  templates: templatesRouter,
  assets: assetsRouter,
  capabilities: capabilitiesRouter,
  sandbox: sandboxRouter,
  orgs: orgsRouter,
  sso: ssoRouter,
});

export type AppRouter = typeof appRouter;

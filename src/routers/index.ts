import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../_core/cookies.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import { systemRouter } from "../_core/systemRouter.js";
import {
  authenticatedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc.js";
import { isOwnerEmail } from "../lib/owner.js";
import { clearAdminMfaCookie } from "../lib/adminMfa.js";
import {
  requestAccountPhoneVerification,
  verifyAccountPhone,
} from "../services/accountPhoneVerification.js";
import { accountRouter } from "./account.js";
import { operationsRouter } from "./operations.js";
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
import { ecosystemRouter } from "./ecosystem.js";
import { artifactsRouter } from "./artifacts.js";
import { templateFactoryRouter } from "./templateFactory.js";
import { deepResearchRouter } from "./deepResearch.js";
import { collaborationRouter } from "./collaboration.js";
import { visualEditorRouter } from "./visualEditor.js";
import { versionedWritesRouter } from "./versionedWrites.js";

function maskPhone(phone?: string): string | null {
  if (!phone) return null;
  const visible = phone.slice(-4);
  return `${"•".repeat(Math.max(0, phone.length - 4))}${visible}`;
}

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
        phone: user.phone ?? null,
        maskedPhone: maskPhone(user.phone),
        phoneVerified: user.phoneVerified,
      };
    }),
    requestPhoneVerification: authenticatedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user.phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No mobile number is attached to this account.",
        });
      }
      if (ctx.user.phoneVerified) {
        return { sent: false, alreadyVerified: true } as const;
      }
      await requestAccountPhoneVerification(ctx.user.phone);
      return {
        sent: true,
        alreadyVerified: false,
        maskedPhone: maskPhone(ctx.user.phone),
      } as const;
    }),
    verifyPhone: authenticatedProcedure
      .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.phone) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No mobile number is attached to this account.",
          });
        }
        if (ctx.user.phoneVerified) {
          return { verified: true } as const;
        }
        const verified = await verifyAccountPhone({
          supabaseUid: ctx.user.supabaseUid,
          phone: ctx.user.phone,
          code: input.code,
        });
        if (!verified) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That SMS code is invalid or expired.",
          });
        }
        return { verified: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearAdminMfaCookie(ctx.res);
      return { success: true } as const;
    }),
  }),
  account: accountRouter,
  operations: operationsRouter,
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
  ecosystem: ecosystemRouter,
  artifacts: artifactsRouter,
  templateFactory: templateFactoryRouter,
  deepResearch: deepResearchRouter,
  collaboration: collaborationRouter,
  visualEditor: visualEditorRouter,
  versionedWrites: versionedWritesRouter,
});

export type AppRouter = typeof appRouter;

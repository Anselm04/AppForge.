import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, getSessionCookieOptions } from "../_core/cookies.js";
import { systemRouter } from "../_core/systemRouter.js";
import { publicProcedure, router } from "../_core/trpc.js";
import { isOwnerEmail } from "../lib/owner.js";
import { clearAdminMfaCookie } from "../lib/adminMfa.js";
import {
  clearLoginMfaCookie,
  hasValidLoginMfa,
  loginMfaCodeSchema,
  loginMfaExpiresInSeconds,
  setLoginMfaCookie,
} from "../lib/loginMfa.js";
import {
  checkTwilioVerification,
  requestTwilioVerification,
} from "../lib/twilioSms.js";
import {
  maskPhone,
  resolveLoginVerificationPhone,
} from "../services/loginVerification.js";
import { projectsRouter } from "./projects.js";
import { subscriptionsRouter } from "./subscriptions.js";
import { githubRouter } from "./github.js";
import { cosineRouter } from "./cosine.js";
import { composioRouter } from "./composio.js";
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

async function verificationPhone(user: {
  supabaseUid: string;
  email: string;
}): Promise<string> {
  try {
    return await resolveLoginVerificationPhone(user);
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Phone verification setup is required for this account.",
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    loginVerificationStatus: publicProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) return { authenticated: false, verified: false } as const;
      const verified = hasValidLoginMfa(ctx.req, user.supabaseUid);
      let phoneHint = "";
      try {
        phoneHint = maskPhone(await resolveLoginVerificationPhone(user));
      } catch {
        // Do not reveal account details when verification is not configured.
      }
      return {
        authenticated: true,
        verified,
        phoneHint,
        expiresInSeconds: loginMfaExpiresInSeconds(),
      } as const;
    }),
    requestLoginVerification: publicProcedure.mutation(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Enter your email and password first.",
        });
      }
      const phone = await verificationPhone(user);
      try {
        await requestTwilioVerification(phone);
      } catch {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Unable to send the verification code. Please try again.",
        });
      }
      return { sent: true, phoneHint: maskPhone(phone) } as const;
    }),
    verifyLoginVerification: publicProcedure
      .input(loginMfaCodeSchema.transform((code) => ({ code })))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Enter your email and password first.",
          });
        }
        const phone = await verificationPhone(user);
        let approved = false;
        try {
          approved = await checkTwilioVerification(phone, input.code);
        } catch {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "Unable to verify the code. Please try again.",
          });
        }
        if (!approved) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "That verification code was not accepted.",
          });
        }
        setLoginMfaCookie(ctx.req, ctx.res, user.supabaseUid);
        return {
          verified: true,
          user: {
            id: user.supabaseUid,
            email: user.email,
            name: user.name,
          },
        } as const;
      }),
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user || !hasValidLoginMfa(opts.ctx.req, user.supabaseUid)) return null;
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
      clearLoginMfaCookie(ctx.res);
      clearAdminMfaCookie(ctx.res);
      return { success: true } as const;
    }),
  }),
  projects: projectsRouter,
  subscriptions: subscriptionsRouter,
  github: githubRouter,
  cosine: cosineRouter,
  composio: composioRouter,
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

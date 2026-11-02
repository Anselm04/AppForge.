import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./context.js";
import { isOwnerEmail } from "../lib/owner.js";
import { hasValidAdminMfa } from "../lib/adminMfa.js";
import { accountLifecycleAllowsAccess } from "../middleware/accountLifecycleAccess.js";
import { getAccountLifecycleState } from "../services/accountLifecycleService.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

async function requireAuthenticatedUser(user: Context["user"]) {
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return user;
}

async function requireActiveAccount(user: NonNullable<Context["user"]>) {
  const state = await getAccountLifecycleState(user.id);
  if (!accountLifecycleAllowsAccess(state)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account access is disabled while deletion is in progress",
    });
  }
  return user;
}

export const authenticatedProcedure = t.procedure.use(async (opts) => {
  const candidate = await requireAuthenticatedUser(opts.ctx.user);
  const user = await requireActiveAccount(candidate);
  return opts.next({
    ctx: {
      ...opts.ctx,
      user,
    },
  });
});

export const protectedProcedure = authenticatedProcedure.use(async (opts) => {
  const user = opts.ctx.user;
  if (!user.phoneVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Phone verification required",
    });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});

export const accountDeletionProcedure = t.procedure.use(async (opts) => {
  const user = await requireAuthenticatedUser(opts.ctx.user);
  if (isOwnerEmail(user.email) && !hasValidAdminMfa(opts.ctx.req, user.id)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner SMS verification required",
    });
  }
  const state = await getAccountLifecycleState(user.id);
  if (state === "completed") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account deletion is already complete",
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      user,
      accountDeletionState: state,
    },
  });
});

export const ownerAuthenticatedProcedure = authenticatedProcedure.use(
  async (opts) => {
    const user = opts.ctx.user;
    if (!user.phoneVerified) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Phone verification required",
      });
    }
    if (!isOwnerEmail(user.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Owner access only" });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  },
);

// The owner's normal verified account session is the admin authorization
// boundary. Do not demand a second SMS after the account phone is already
// verified; owner identity still comes from the authenticated server session.
export const ownerOnlyProcedure = ownerAuthenticatedProcedure;

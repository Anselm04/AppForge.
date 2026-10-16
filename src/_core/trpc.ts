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

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  const user = await requireActiveAccount(opts.ctx.user);
  return opts.next({
    ctx: {
      ...opts.ctx,
      user,
    },
  });
});

export const ownerAuthenticatedProcedure = t.procedure.use(async (opts) => {
  const candidate = opts.ctx.user;
  if (!candidate) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  const user = await requireActiveAccount(candidate);
  if (!isOwnerEmail(user.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access only" });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});

export const ownerOnlyProcedure = ownerAuthenticatedProcedure.use(
  async (opts) => {
    const user = opts.ctx.user;
    if (!hasValidAdminMfa(opts.ctx.req, user.id)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin SMS verification required",
      });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  },
);

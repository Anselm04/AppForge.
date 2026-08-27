import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./context.js";
import { isOwnerEmail } from "../lib/owner.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  });
});

export const ownerOnlyProcedure = t.procedure.use(async (opts) => {
  const user = opts.ctx.user;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  if (!isOwnerEmail(user.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access only" });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});

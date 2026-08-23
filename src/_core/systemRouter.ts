import { initTRPC } from "@trpc/server";
import { publicProcedure, protectedProcedure } from "./trpc.js";

const t = initTRPC.create();

export const systemRouter = t.router({
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
});

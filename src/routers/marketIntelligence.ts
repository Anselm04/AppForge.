import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { researchMarketOpportunity } from "../services/marketIntelligence.js";

const analyzeInput = z.object({
  idea: z.string().trim().min(10).max(1_500),
  audience: z.string().trim().max(500).optional(),
  region: z.string().trim().max(120).optional(),
  maxSources: z.number().int().min(6).max(18).optional(),
});

export const marketIntelligenceRouter = router({
  analyze: protectedProcedure.input(analyzeInput).mutation(async ({ input }) => {
    try {
      return await researchMarketOpportunity(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Market intelligence failed";
      throw new TRPCError({
        code: /sources are currently unavailable/i.test(message)
          ? "BAD_GATEWAY"
          : "INTERNAL_SERVER_ERROR",
        message,
      });
    }
  }),
});

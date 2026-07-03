import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getProjectById, isUserPro } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

const COSINE_API_KEY = process.env.COSINE_API_KEY;
const COSINE_API_URL = process.env.COSINE_API_URL || "https://api.cosine.com";

export const cosineRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const isPro = await isUserPro(ctx.user.id);
    return {
      connected: !!COSINE_API_KEY,
      isPro,
      canImprove: isPro && !!COSINE_API_KEY,
    };
  }),

  improve: protectedProcedure
    .input(z.object({ projectId: z.number(), improvements: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const isPro = await isUserPro(ctx.user.id);
      if (!isPro) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cosine Genie 2 improvements are available for Pro subscribers only.",
        });
      }

      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      if (!COSINE_API_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Cosine Genie 2 is not configured.",
        });
      }

      // Call Cosine Genie 2 API
      const response = await fetch(`${COSINE_API_URL}/v1/improve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${COSINE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: input.projectId,
          files: project.generatedFiles || {},
          improvements: input.improvements,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Cosine Genie 2 improvement failed: ${err}`,
        });
      }

      const result = await response.json();
      return result;
    }),

  prStatus: protectedProcedure
    .input(z.object({ projectId: z.number(), prUrl: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Fetch PR status from GitHub
      const match = input.prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
      if (!match) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid PR URL" });
      }

      const [, owner, repo, prNumber] = match;

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`);
      if (!response.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch PR status" });
      }

      const pr = await response.json();
      return {
        status: pr.state,
        title: pr.title,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      };
    }),
});

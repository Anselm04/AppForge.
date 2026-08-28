import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createProject,
  getProjectById,
  getProjectFiles,
  updateProjectFiles,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getStackScaffold } from "../services/stackScaffolds.js";
import { templates } from "../data/templates.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { ensureUserCredits } from "../db.js";

export const templatesRouter = router({
  list: protectedProcedure.query(() => templates),

  createProjectFromTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const template = templates.find((t) => t.id === input.templateId);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const credits = await ensureUserCredits(ctx.user.id);
      const unlimited = !!credits.unlimited || credits.tier === "lifetime";
      if (!unlimited && credits.balance < BUILD_CREDIT_COST) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Need ${BUILD_CREDIT_COST} credits to start a build from this template.`,
        });
      }

      const techStack = template.techStack[0] ?? "react-node";
      const scaffold = getStackScaffold(techStack);
      const starterFiles: Record<string, string> = {
        ...scaffold,
        "README.md": `# ${template.name}\n\n${template.description}\n\nStarted from AppForge template **${template.id}**.\n`,
        "TEMPLATE.md": `# Template: ${template.name}\n\nFeatures:\n${template.features.map((f) => `- ${f}`).join("\n")}\n`,
      };

      const projectId = await createProject({
        userId: ctx.user.id,
        title: template.name,
        description: `Build a ${template.name}: ${template.description}`,
        techStack,
        status: "pending",
      });

      await updateProjectFiles(projectId, starterFiles);

      return { projectId, techStack, templateName: template.name };
    }),
});

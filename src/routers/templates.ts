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
import {
  resolveIntakeContract,
  type ProductContract,
} from "../lib/productContract.js";
import { isSupportedStack, normalizeStackId } from "../lib/stackAdapters.js";

type Template = (typeof templates)[number];

/**
 * A template's stack is explicit: its stackId must be a supported stack
 * adapter that can build the template's product, and the project is created
 * with that contract. No React fallback.
 */
export function templateIntake(
  template: Template,
):
  | { ok: true; productContract: ProductContract }
  | { ok: false; message: string } {
  const declared = template.stackId;
  if (!declared || !isSupportedStack(declared)) {
    return {
      ok: false,
      message: `Template ${template.id} does not declare a supported technology stack`,
    };
  }
  const intake = resolveIntakeContract(
    `Build a ${template.name}: ${template.description}`,
    normalizeStackId(declared),
  );
  if (!intake.ok) return { ok: false, message: intake.message };
  return { ok: true, productContract: intake.productContract };
}

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

      const intake = templateIntake(template);
      if (!intake.ok) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: intake.message,
        });
      }
      const { productContract } = intake;
      const techStack = productContract.selectedTechnologyStack;
      const scaffold = getStackScaffold(techStack, productContract.productType);
      const starterFiles: Record<string, string> = {
        ...scaffold,
        "README.md": `# ${template.name}\n\n${template.description}\n\nStarted from AppForge template **${template.id}**.\n`,
        "TEMPLATE.md": `# Template: ${template.name}\n\nFeatures:\n${template.features.map((f) => `- ${f}`).join("\n")}\n`,
      };

      const projectId = await createProject({
        userId: ctx.user.id,
        title: template.name,
        description: productContract.originalPrompt,
        techStack,
        status: "pending",
        productContract,
      });

      await updateProjectFiles(projectId, starterFiles);

      return { projectId, techStack, templateName: template.name };
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { projectsRouter, projectTechStackSchema } from "./projects.js";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.js";
import { templates } from "../data/templates.js";
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
  list: publicProcedure.query(() => templates),

  createProjectFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string().min(1),
        hcaptchaToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = templates.find((t) => t.id === input.templateId);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const intake = templateIntake(template);
      if (!intake.ok) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: intake.message,
        });
      }
      const stack = projectTechStackSchema.safeParse(template.stackId);
      if (!stack.success) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Template ${template.id} does not use a supported project stack`,
        });
      }

      const description = [
        `Build a ${template.name}: ${template.description}`,
        "Include these features:",
        ...template.features.map((feature) => `- ${feature}`),
      ].join("\n");
      const result = await projectsRouter.createCaller(ctx).create({
        title: template.name,
        description,
        techStack: stack.data,
        productType: intake.productContract.productType,
        hcaptchaToken: input.hcaptchaToken,
      });

      if (result.status === "clarification_required") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This template needs clarification before it can be built.",
        });
      }

      return {
        projectId: result.id,
        techStack: stack.data,
        templateName: template.name,
      };
    }),
});

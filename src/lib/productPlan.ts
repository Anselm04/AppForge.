import { z } from "zod";
import type { ProductContract } from "./productContract.js";

const nonEmptyString = z.string().trim().min(1);
const stringArray = z.array(nonEmptyString);

export const productPlanTaskSchema = z.object({
  id: nonEmptyString,
  module: nonEmptyString,
  description: nonEmptyString,
  sequence: z.number().int().positive(),
  dependencies: z.array(nonEmptyString),
  acceptanceCriteria: z.array(nonEmptyString).min(1),
  requirementIds: z.array(z.string().regex(/^REQ-\d{3}$/)).min(1),
  files: z.array(nonEmptyString).min(1),
  agent: z.enum([
    "frontend",
    "backend",
    "database",
    "ai",
    "integration",
    "security",
    "deployment",
    "operations",
    "general",
  ]),
  validations: z.array(nonEmptyString).min(1),
});

export const productPlanSchema = z.object({
  version: z.literal(1),
  title: nonEmptyString,
  overview: nonEmptyString,
  productType: nonEmptyString,
  selectedTechnologyStack: nonEmptyString,
  architecture: z.object({
    summary: nonEmptyString,
    workflows: stringArray.min(1),
    personas: stringArray.min(1),
    roles: stringArray.min(1),
    frontendModules: stringArray,
    backendModules: stringArray,
    databaseModules: stringArray,
    aiModules: stringArray,
    integrationModules: stringArray,
    authenticationDesign: nonEmptyString,
    authorizationDesign: nonEmptyString,
    billingDesign: nonEmptyString,
    deploymentDesign: nonEmptyString,
    operationsDesign: nonEmptyString,
    recoveryDesign: nonEmptyString,
    monetizationPlan: nonEmptyString,
  }),
  implementationSequence: z.array(nonEmptyString).min(1),
  tasks: z.array(productPlanTaskSchema).min(1),
  requirementToTasks: z.record(z.string(), z.array(nonEmptyString).min(1)),
  taskToFiles: z.record(z.string(), z.array(nonEmptyString).min(1)),
  taskToAgent: z.record(z.string(), nonEmptyString),
  taskToValidation: z.record(z.string(), z.array(nonEmptyString).min(1)),
  researchDecisionIds: z.array(nonEmptyString),
});

export type ProductPlan = z.infer<typeof productPlanSchema>;
export type ProductPlanTask = z.infer<typeof productPlanTaskSchema>;

const GENERIC_MODULE_NAMES = new Set([
  "core app",
  "core ui",
  "main app",
  "application",
  "app",
]);

function isComplexContract(contract: ProductContract): boolean {
  return (
    contract.functionalRequirements.length > 3 ||
    contract.secondaryCapabilities.length > 2 ||
    contract.integrations.length > 0 ||
    contract.monetizationRequirements.length > 0 ||
    contract.productFamilies.length > 3
  );
}

/**
 * Strip a whole-response markdown fence (``` or ```json) without salvaging
 * JSON from surrounding prose. Fenced replies parse on the first attempt;
 * prefixed/suffixed garbage still fails and burns a validation retry.
 */
export function stripPlannerMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(
    /^```(?:json|JSON)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/,
  );
  if (fenced) return fenced[1].trim();
  return trimmed;
}

export function parsePlannerJson(text: string): unknown {
  const candidate = stripPlannerMarkdownFence(text);
  if (!candidate) {
    throw new Error("Planner returned an empty response");
  }
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error("Planner returned invalid JSON: " + detail);
  }
}

export function formatPlannerValidationError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 12)
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return path + ": " + issue.message;
      })
      .join("; ");
  }
  if (error instanceof Error) return error.message;
  return "Unknown planner validation error";
}

export function validateProductPlan(
  input: unknown,
  contract: ProductContract,
): ProductPlan {
  let plan: ProductPlan;
  try {
    plan = productPlanSchema.parse(input);
  } catch (error) {
    throw new Error(formatPlannerValidationError(error));
  }

  if (plan.productType !== contract.productType) {
    throw new Error(
      "Planner product type does not match canonical product contract",
    );
  }

  if (plan.selectedTechnologyStack !== contract.selectedTechnologyStack) {
    throw new Error("Planner stack does not match canonical product contract");
  }

  if (
    contract.productFamilies.includes("frontend") &&
    plan.architecture.frontendModules.length === 0
  ) {
    throw new Error("Planner must include frontend modules for this product");
  }

  if (
    contract.productFamilies.includes("backend") &&
    plan.architecture.backendModules.length === 0
  ) {
    throw new Error("Planner must include backend modules for this product");
  }

  if (
    contract.productFamilies.includes("database") &&
    plan.architecture.databaseModules.length === 0
  ) {
    throw new Error("Planner must include database modules for this product");
  }

  if (
    contract.productFamilies.includes("ai") &&
    plan.architecture.aiModules.length === 0
  ) {
    throw new Error("Planner must include AI modules for this product");
  }

  if (
    contract.productFamilies.includes("integrations") &&
    plan.architecture.integrationModules.length === 0
  ) {
    throw new Error(
      "Planner must include integration modules for this product",
    );
  }

  const orderedTaskIds = [...plan.tasks]
    .sort((a, b) => a.sequence - b.sequence)
    .map((task) => task.id);

  if (
    plan.implementationSequence.length !== plan.tasks.length ||
    plan.implementationSequence.some(
      (taskId, index) => taskId !== orderedTaskIds[index],
    )
  ) {
    throw new Error(
      "Planner implementation sequence must include every task in sequence order",
    );
  }

  if (
    plan.tasks.length > 1 &&
    !plan.tasks.some((task) => task.dependencies.length > 0)
  ) {
    throw new Error("Planner must define dependencies between multi-task work");
  }

  const ids = plan.tasks.map((task) => task.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Planner task IDs must be unique");
  }

  const taskIds = new Set(ids);

  for (const task of plan.tasks) {
    for (const dependency of task.dependencies) {
      if (!taskIds.has(dependency)) {
        throw new Error(
          "Planner task " + task.id + " depends on unknown task " + dependency,
        );
      }

      if (dependency === task.id) {
        throw new Error("Planner task " + task.id + " cannot depend on itself");
      }
    }
  }

  const requiredIds = contract.functionalRequirements
    .filter((requirement) => requirement.priority === "must")
    .map((requirement) => requirement.id);

  for (const requirementId of requiredIds) {
    const mapped = plan.requirementToTasks[requirementId] ?? [];

    if (mapped.length === 0) {
      throw new Error("Planner dropped must-have requirement " + requirementId);
    }

    for (const taskId of mapped) {
      if (!taskIds.has(taskId)) {
        throw new Error(
          "Requirement " + requirementId + " maps to unknown task " + taskId,
        );
      }
    }

    if (
      !plan.tasks.some(
        (task) =>
          mapped.includes(task.id) &&
          task.requirementIds.includes(requirementId),
      )
    ) {
      throw new Error(
        "Requirement " +
          requirementId +
          " mapping disagrees with task requirement IDs",
      );
    }
  }

  for (const task of plan.tasks) {
    const mappedFiles = plan.taskToFiles[task.id];
    const mappedAgent = plan.taskToAgent[task.id];
    const mappedValidation = plan.taskToValidation[task.id];

    if (!mappedFiles || mappedFiles.length === 0) {
      throw new Error(
        "Planner task " + task.id + " has no task-to-file mapping",
      );
    }

    if (!mappedAgent) {
      throw new Error(
        "Planner task " + task.id + " has no task-to-agent mapping",
      );
    }

    if (!mappedValidation || mappedValidation.length === 0) {
      throw new Error(
        "Planner task " + task.id + " has no task-to-validation mapping",
      );
    }

    if (JSON.stringify(mappedFiles) !== JSON.stringify(task.files)) {
      throw new Error(
        "Planner task " + task.id + " file mapping disagrees with task files",
      );
    }

    if (mappedAgent !== task.agent) {
      throw new Error(
        "Planner task " + task.id + " agent mapping disagrees with task agent",
      );
    }

    if (JSON.stringify(mappedValidation) !== JSON.stringify(task.validations)) {
      throw new Error(
        "Planner task " +
          task.id +
          " validation mapping disagrees with task validations",
      );
    }
  }

  if (isComplexContract(contract)) {
    const moduleNames = [
      plan.title,
      ...plan.tasks.map((task) => task.module),
      ...plan.architecture.frontendModules,
      ...plan.architecture.backendModules,
      ...plan.architecture.databaseModules,
      ...plan.architecture.aiModules,
      ...plan.architecture.integrationModules,
    ];
    const hasGenericModule = moduleNames.some((name) =>
      GENERIC_MODULE_NAMES.has(name.trim().toLowerCase()),
    );
    if (plan.tasks.length < 2 || hasGenericModule) {
      throw new Error(
        "Planner returned generic output for a complex product; detailed modules are required",
      );
    }
  }

  return plan;
}

export function parseAndValidateProductPlan(
  text: string,
  contract: ProductContract,
): ProductPlan {
  return validateProductPlan(parsePlannerJson(text), contract);
}

export function plannerJsonSchemaInstruction(): string {
  return [
    "Return ONLY one JSON object. A single ```json fence around the object is allowed; do not add prose before or after it.",
    "Required top-level fields: version, title, overview, productType, selectedTechnologyStack, architecture, implementationSequence, tasks, requirementToTasks, taskToFiles, taskToAgent, taskToValidation, researchDecisionIds.",
    "version must be the number 1 (not a string, not 2).",
    "Architecture must include: summary, workflows, personas, roles, frontendModules, backendModules, databaseModules, aiModules, integrationModules, authenticationDesign, authorizationDesign, billingDesign, deploymentDesign, operationsDesign, recoveryDesign, monetizationPlan.",
    "Each task must include: id, module, description, sequence, dependencies, acceptanceCriteria, requirementIds, files, agent, validations.",
    "acceptanceCriteria and validations must be arrays of strings (never a single string).",
    "agent must be exactly one of: frontend, backend, database, ai, integration, security, deployment, operations, general.",
    "requirementIds must use the contract IDs like REQ-001.",
    "implementationSequence must list every task id in ascending sequence order.",
    "requirementToTasks, taskToFiles, taskToAgent, and taskToValidation must agree with the tasks array.",
    "Every must-have requirement ID must map to at least one task.",
    "Every task must have acceptance criteria, files, owner agent, validations, dependencies, and requirement IDs.",
    "For complex products, use specific modules; never use generic Core App/Core UI fallbacks.",
  ].join("\n");
}

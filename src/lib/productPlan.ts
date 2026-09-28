import { z } from "zod";
import type { ProductContract } from "./productContract.js";
import {
  databasePersistencePolicy,
  isDatabaseMigrationPath,
  isDatabasePersistencePath,
  isDatabaseRecoveryPath,
  isDatabaseSchemaPath,
  isDatabaseSeedPath,
} from "./databasePersistence.js";
import {
  integrationCompatibilityProblems,
  integrationImplementationPolicy,
  isIntegrationClientPath,
  isIntegrationDocsPath,
  isIntegrationEnvPath,
  isIntegrationHealthPath,
  isIntegrationWebhookPath,
} from "./integrationImplementation.js";
import {
  aiAgentPolicy,
  isAiAuditPath,
  isAiDocsPath,
  isAiEnvPath,
  isAiMemoryPath,
  isAiPolicyPath,
  isAiProviderPath,
  isAiRouterPath,
  isAiStatusPath,
  isAiToolsPath,
} from "./aiAgentImplementation.js";
import {
  isMonetizationAuditPath,
  isMonetizationCatalogPath,
  isMonetizationCheckoutPath,
  isMonetizationDocsPath,
  isMonetizationEntitlementPath,
  isMonetizationEnvPath,
  isMonetizationLimitPath,
  isMonetizationPortalPath,
  isMonetizationWebhookPath,
  monetizationPolicy,
} from "./monetizationImplementation.js";

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

  const aiPolicy = aiAgentPolicy(contract);
  if (aiPolicy.required) {
    const aiTasks = plan.tasks.filter((task) => task.agent === "ai");
    if (aiTasks.length === 0) {
      throw new Error(
        "Planner must include an AI-owned task for AI-agent products",
      );
    }

    const aiFiles = aiTasks.flatMap((task) => task.files);
    if (!aiFiles.some(isAiProviderPath)) {
      throw new Error(
        "Planner AI task must include model-provider configuration",
      );
    }
    if (!aiFiles.some(isAiRouterPath)) {
      throw new Error(
        "Planner AI task must include model routing/fallback implementation",
      );
    }
    if (aiPolicy.toolUseExpected && !aiFiles.some(isAiToolsPath)) {
      throw new Error("Planner AI task must include typed tool definitions");
    }
    if (!aiFiles.some(isAiPolicyPath)) {
      throw new Error(
        "Planner AI task must include AI safety/permission policy code",
      );
    }
    if (!aiFiles.some(isAiMemoryPath)) {
      throw new Error(
        "Planner AI task must include memory/context boundary code",
      );
    }
    if (!aiFiles.some(isAiAuditPath)) {
      throw new Error("Planner AI task must include AI audit logging");
    }
    if (!aiFiles.some(isAiStatusPath)) {
      throw new Error(
        "Planner AI task must include user-visible AI status handling",
      );
    }
    if (!aiFiles.some(isAiEnvPath)) {
      throw new Error(
        "Planner AI task must include environment example/configuration",
      );
    }
    if (!aiFiles.some(isAiDocsPath)) {
      throw new Error(
        "Planner AI task must include AI-agent setup/safety documentation",
      );
    }

    const aiValidationText = aiTasks
      .flatMap((task) => task.validations)
      .join(" ");
    if (
      !/provider|model|tool|permission|approval|injection|memory|context|cost|audit|status|refusal|timeout|retry/i.test(
        aiValidationText,
      )
    ) {
      throw new Error(
        "Planner AI task must include AI-agent safety and runtime validation",
      );
    }
  }

  const databasePolicy = databasePersistencePolicy(contract);
  if (databasePolicy.required) {
    const databaseTasks = plan.tasks.filter(
      (task) => task.agent === "database",
    );
    if (databaseTasks.length === 0) {
      throw new Error(
        "Planner must include a database-owned task for database-capable products",
      );
    }

    const databaseFiles = databaseTasks.flatMap((task) => task.files);
    if (!databaseFiles.some(isDatabaseSchemaPath)) {
      throw new Error(
        "Planner database task must include schema/model definitions",
      );
    }
    if (!databaseFiles.some(isDatabaseMigrationPath)) {
      throw new Error(
        "Planner database task must include at least one versioned migration",
      );
    }
    if (
      databasePolicy.seedRequired &&
      !databaseFiles.some(isDatabaseSeedPath)
    ) {
      throw new Error(
        "Planner database task must include development/test seed data",
      );
    }
    if (!databaseFiles.some(isDatabasePersistencePath)) {
      throw new Error(
        "Planner database task must include server-side persistence/repository code",
      );
    }
    if (!databaseFiles.some(isDatabaseRecoveryPath)) {
      throw new Error(
        "Planner database task must include database recovery documentation",
      );
    }

    const databaseValidationText = databaseTasks
      .flatMap((task) => task.validations)
      .join(" ");
    if (
      !/database|schema|migration|transaction|tenant|persistence|restore|backup/i.test(
        databaseValidationText,
      )
    ) {
      throw new Error(
        "Planner database task must include database-specific validation",
      );
    }
  }

  if (
    contract.productFamilies.includes("integrations") &&
    plan.architecture.integrationModules.length === 0
  ) {
    throw new Error(
      "Planner must include integration modules for this product",
    );
  }

  const integrationPolicy = integrationImplementationPolicy(contract);
  if (integrationPolicy.required) {
    const compatibilityProblems = integrationCompatibilityProblems(contract);
    if (compatibilityProblems.length > 0) {
      throw new Error(compatibilityProblems.join("; "));
    }

    const integrationTasks = plan.tasks.filter(
      (task) => task.agent === "integration",
    );
    if (integrationTasks.length === 0) {
      throw new Error(
        "Planner must include an integration-owned task for integration-capable products",
      );
    }

    const integrationFiles = integrationTasks.flatMap((task) => task.files);
    if (!integrationFiles.some(isIntegrationClientPath)) {
      throw new Error(
        "Planner integration task must include server-side provider client code",
      );
    }
    if (!integrationFiles.some(isIntegrationEnvPath)) {
      throw new Error(
        "Planner integration task must include environment example/configuration",
      );
    }
    if (!integrationFiles.some(isIntegrationHealthPath)) {
      throw new Error(
        "Planner integration task must include integration health/status code",
      );
    }
    if (!integrationFiles.some(isIntegrationDocsPath)) {
      throw new Error(
        "Planner integration task must include integration setup documentation",
      );
    }
    if (
      integrationPolicy.webhookRequired &&
      !integrationFiles.some(isIntegrationWebhookPath)
    ) {
      throw new Error(
        "Planner integration task must include webhook/callback handling",
      );
    }

    const validationText = integrationTasks
      .flatMap((task) => task.validations)
      .join(" ");
    if (
      !/integration|provider|webhook|signature|retry|rate.?limit|timeout|health|idempot/i.test(
        validationText,
      )
    ) {
      throw new Error(
        "Planner integration task must include integration-specific validation",
      );
    }
  }

  const moneyPolicy = monetizationPolicy(contract);
  if (moneyPolicy.required) {
    const billingTasks = plan.tasks.filter(
      (task) =>
        (task.agent === "backend" || task.agent === "integration") &&
        task.files.some((path) =>
          [
            isMonetizationCatalogPath,
            isMonetizationCheckoutPath,
            isMonetizationEntitlementPath,
            isMonetizationLimitPath,
            isMonetizationWebhookPath,
            isMonetizationAuditPath,
          ].some((match) => match(path)),
        ),
    );
    if (billingTasks.length === 0) {
      throw new Error(
        "Planner must include a backend/integration monetization task for requested monetization",
      );
    }

    const billingFiles = billingTasks.flatMap((task) => task.files);
    const requiredArtifacts: Array<[string, (path: string) => boolean]> = [
      ["product/price catalog", isMonetizationCatalogPath],
      ["checkout/payment flow", isMonetizationCheckoutPath],
      ["entitlement enforcement", isMonetizationEntitlementPath],
      ["access limits/quotas", isMonetizationLimitPath],
      ["billing webhook", isMonetizationWebhookPath],
      ["billing audit ledger", isMonetizationAuditPath],
      ["environment configuration", isMonetizationEnvPath],
      ["billing documentation", isMonetizationDocsPath],
    ];
    if (moneyPolicy.models.includes("subscription")) {
      requiredArtifacts.push(["customer portal", isMonetizationPortalPath]);
    }
    for (const [label, match] of requiredArtifacts) {
      if (!billingFiles.some(match)) {
        throw new Error("Planner monetization task must include " + label);
      }
    }

    const validationText = billingTasks
      .flatMap((task) => task.validations)
      .join(" ");
    if (
      !/billing|payment|price|entitlement|webhook|invoice|refund|idempot|portal|quota|credit|usage/i.test(
        validationText,
      )
    ) {
      throw new Error(
        "Planner monetization task must include billing-specific validation",
      );
    }
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

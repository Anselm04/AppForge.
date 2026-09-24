import { getStackAdapter } from "./stackAdapters.js";
import {
  validateProductContract,
  type ProductContract,
} from "./productContract.js";
import type { ProductPlan } from "./productPlan.js";

export type IncompleteProductFindingCode =
  | "placeholder_text"
  | "todo_only_file"
  | "empty_component"
  | "empty_page"
  | "fake_button"
  | "fake_form"
  | "fake_api_response"
  | "empty_service"
  | "empty_database_schema"
  | "generic_unrelated_page"
  | "missing_primary_workflow"
  | "missing_integration"
  | "missing_data_model"
  | "missing_authentication"
  | "missing_billing"
  | "missing_ai_behavior"
  | "incomplete_deployment_config"
  | "missing_requirement_evidence";

export type IncompleteProductFinding = {
  code: IncompleteProductFindingCode;
  message: string;
  path?: string;
  requirementId?: string;
};

export type IncompleteProductReport = {
  version: 1;
  complete: boolean;
  productType: string;
  selectedTechnologyStack: string;
  findings: IncompleteProductFinding[];
};

const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/Scaffold is ready/i, '"Scaffold is ready"'],
  [/Your generated UI will replace this screen/i, '"Your generated UI will replace this screen"'],
  [/Generated product/i, '"Generated product"'],
  [/Coming soon/i, '"Coming soon"'],
  [/\bTODO\b/i, "TODO"],
  [/\bFIXME\b/i, "FIXME"],
  [/\bnot implemented\b/i, "not implemented"],
  [/\bstub implementation\b/i, "stub implementation"],
];

const STOP_WORDS = new Set(
  [
    "a",
    "an",
    "and",
    "app",
    "application",
    "build",
    "create",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "product",
    "the",
    "to",
    "tool",
    "use",
    "using",
    "with",
    "website",
    "web",
    "mobile",
    "desktop",
    "system",
    "platform",
    "user",
    "users",
  ],
);

function isTextSource(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?|py|dart|rs|go|java|kt|swift|html|css|sql|prisma|md|json|ya?ml)$/i.test(
    path,
  );
}

function isProductSource(path: string): boolean {
  if (!isTextSource(path)) return false;
  if (
    /(?:^|\/)(?:node_modules|dist|build|coverage|vendor|\.git)(?:\/|$)/i.test(
      path,
    )
  ) {
    return false;
  }
  if (
    /(?:^|\/)(?:__tests__|tests?|fixtures?|mocks?|snapshots?)(?:\/|$)/i.test(
      path,
    ) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path)
  ) {
    return false;
  }
  return true;
}

function isCodeSource(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?|py|dart|rs|go|java|kt|swift|html|sql|prisma)$/i.test(
    path,
  );
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/^\s*#.*$/gm, " ")
    .trim();
}

function normalizedTokens(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
    ),
  ];
}

function sourceBlob(files: Record<string, string>): string {
  return Object.entries(files)
    .filter(([path]) => isProductSource(path))
    .map(([, source]) => source)
    .join("\n")
    .toLowerCase();
}

function codeBlob(files: Record<string, string>): string {
  return Object.entries(files)
    .filter(([path]) => isProductSource(path) && isCodeSource(path))
    .map(([, source]) => source)
    .join("\n")
    .toLowerCase();
}

function findImplementationEvidence(
  files: Record<string, string>,
): {
  requirements?: Array<{
    id?: string;
    files?: string[];
    taskIds?: string[];
    validations?: string[];
  }>;
} | null {
  const raw = files["appforge.implementation.json"];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      requirements?: Array<{
        id?: string;
        files?: string[];
        taskIds?: string[];
        validations?: string[];
      }>;
    };
  } catch {
    return null;
  }
}

function inspectPlaceholderAndEmptyFiles(
  files: Record<string, string>,
): IncompleteProductFinding[] {
  const findings: IncompleteProductFinding[] = [];

  for (const [path, source] of Object.entries(files)) {
    if (!isProductSource(path)) continue;

    for (const [pattern, label] of PLACEHOLDER_PATTERNS) {
      if (pattern.test(source)) {
        findings.push({
          code: "placeholder_text",
          path,
          message: `${label} content detected in generated product source.`,
        });
        break;
      }
    }

    if (!isCodeSource(path)) continue;
    const stripped = stripComments(source);
    const todoOnly =
      /\b(?:TODO|FIXME)\b/i.test(source) &&
      stripped.replace(/(?:TODO|FIXME)/gi, "").replace(/\s+/g, "").length < 24;
    if (todoOnly) {
      findings.push({
        code: "todo_only_file",
        path,
        message: "File contains only TODO/FIXME scaffolding and no substantive implementation.",
      });
    }

    if (/\.(?:tsx|jsx)$/i.test(path)) {
      if (
        /(?:function|const)\s+[A-Z][A-Za-z0-9_$]*[\s\S]{0,240}(?:return\s+null\s*;?|=>\s*null\s*;?)/m.test(
          source,
        ) ||
        /return\s*<>\s*<\/\s*>/m.test(source)
      ) {
        findings.push({
          code: /(?:^|\/)(?:page|index|App)\.[jt]sx$/i.test(path)
            ? "empty_page"
            : "empty_component",
          path,
          message: "Component/page resolves to an empty UI.",
        });
      }

      for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
        const attrs = match[1] ?? "";
        if (
          !/onClick\s*=|formAction\s*=|type\s*=\s*["']submit["']/i.test(attrs) &&
          !/<form\b[^>]*(?:onSubmit|action)\s*=/i.test(source)
        ) {
          findings.push({
            code: "fake_button",
            path,
            message: "Button has no click handler, form action, or submit behavior.",
          });
          break;
        }
      }

      for (const match of source.matchAll(/<form\b([^>]*)>/gi)) {
        const attrs = match[1] ?? "";
        if (!/onSubmit\s*=|action\s*=/i.test(attrs)) {
          findings.push({
            code: "fake_form",
            path,
            message: "Form has no submit handler or action.",
          });
          break;
        }
      }
    }

    if (
      /(?:^|\/)(?:api|routes?|controllers?|handlers?|services?)(?:\/|\.)/i.test(
        path,
      ) &&
      !/(?:health|readiness|liveness)/i.test(path)
    ) {
      const hardCodedSuccess =
        /(?:res\.json|Response\.json|NextResponse\.json)\s*\(\s*\{[^}]{0,180}(?:success\s*:\s*true|ok\s*:\s*true)[^}]*\}\s*\)/is.test(
          source,
        );
      const realWork =
        /\b(?:await|db\.|fetch\(|axios\.|stripe\.|supabase\.|prisma\.|sql\b|repository\.|service\.|client\.)/i.test(
          source,
        );
      if (hardCodedSuccess && !realWork) {
        findings.push({
          code: "fake_api_response",
          path,
          message: "API handler returns hard-coded success without performing real work.",
        });
      }
    }

    if (
      /class\s+[A-Za-z0-9_$]*Service\s*\{\s*(?:constructor\s*\([^)]*\)\s*\{\s*\}\s*)?\}/m.test(
        source,
      )
    ) {
      findings.push({
        code: "empty_service",
        path,
        message: "Service class contains no substantive behavior.",
      });
    }

    if (
      /(?:schema|models?|migrations?)/i.test(path) &&
      /\.(?:ts|js|sql|prisma|py)$/i.test(path)
    ) {
      const hasSchemaDefinition =
        /(?:pgTable|mysqlTable|sqliteTable|create\s+table|model\s+[A-Z]|class\s+[A-Z][A-Za-z0-9_]*\s*\(|Schema\s*\(|mongoose\.Schema|CREATE\s+TYPE|ALTER\s+TABLE)/i.test(
          source,
        );
      if (!hasSchemaDefinition && stripComments(source).length < 180) {
        findings.push({
          code: "empty_database_schema",
          path,
          message: "Database schema/model file has no substantive model or table definitions.",
        });
      }
    }
  }

  return findings;
}

function inspectRequirementEvidence(
  files: Record<string, string>,
  contract: ProductContract,
  plan?: ProductPlan,
): IncompleteProductFinding[] {
  const findings: IncompleteProductFinding[] = [];
  const evidence = findImplementationEvidence(files);

  for (const requirement of contract.functionalRequirements.filter(
    (item) => item.priority === "must",
  )) {
    const entry = evidence?.requirements?.find(
      (item) => item.id === requirement.id,
    );
    const mappedFiles =
      entry?.files ??
      (plan?.requirementToTasks[requirement.id] ?? []).flatMap(
        (taskId) => plan?.taskToFiles[taskId] ?? [],
      );
    const existingFiles = mappedFiles.filter((path) => files[path]?.trim());
    if (
      !entry ||
      (mappedFiles.length > 0 && existingFiles.length !== mappedFiles.length) ||
      !(entry.taskIds?.length ?? 0) ||
      !(entry.validations?.length ?? 0)
    ) {
      findings.push({
        code: "missing_requirement_evidence",
        requirementId: requirement.id,
        message: `Must-have requirement ${requirement.id} lacks complete task/file/validation implementation evidence.`,
      });
    }
  }

  return findings;
}

function inspectContractCoverage(
  files: Record<string, string>,
  contract: ProductContract,
): IncompleteProductFinding[] {
  const findings: IncompleteProductFinding[] = [];
  const allText = sourceBlob(files);
  const code = codeBlob(files);

  if (contract.productFamilies.includes("frontend")) {
    const uiText = Object.entries(files)
      .filter(
        ([path]) =>
          isProductSource(path) &&
          /(?:App|page|index|screen|view|component).*\.(?:tsx|jsx|html|dart)$/i.test(
            path,
          ),
      )
      .map(([, source]) => source.toLowerCase())
      .join("\n");
    const domainTokens = normalizedTokens(
      [
        contract.originalPrompt,
        contract.canonicalInterpretation,
        ...contract.coreWorkflows,
      ].join(" "),
    );
    if (
      domainTokens.length >= 2 &&
      !domainTokens.some((token) => uiText.includes(token))
    ) {
      findings.push({
        code: "generic_unrelated_page",
        message:
          "Primary UI contains none of the product-specific domain/workflow terms from the canonical contract.",
      });
    }
  }

  for (const workflow of contract.coreWorkflows) {
    const tokens = normalizedTokens(workflow);
    if (tokens.length === 0) continue;
    const matches = tokens.filter((token) => allText.includes(token)).length;
    const requiredMatches = tokens.length >= 3 ? 2 : 1;
    if (matches < requiredMatches) {
      findings.push({
        code: "missing_primary_workflow",
        message: `Primary workflow is not evidenced in generated source: ${workflow}`,
      });
    }
  }

  for (const integration of contract.integrations) {
    const tokens = normalizedTokens(integration);
    if (
      tokens.length > 0 &&
      !tokens.some((token) => allText.includes(token))
    ) {
      findings.push({
        code: "missing_integration",
        message: `Required integration is not implemented/configured in generated source: ${integration}`,
      });
    }
  }

  if (contract.secondaryCapabilities.includes("database")) {
    const schemaText = Object.entries(files)
      .filter(
        ([path]) =>
          isProductSource(path) &&
          /(?:schema|models?|migrations?|(?:^|\/)db(?:\/|\.))/i.test(path),
      )
      .map(([, source]) => source.toLowerCase())
      .join("\n");
    for (const model of contract.dataModels) {
      const tokens = normalizedTokens(model);
      if (
        tokens.length > 0 &&
        !tokens.some((token) => schemaText.includes(token))
      ) {
        findings.push({
          code: "missing_data_model",
          message: `Required data model is not represented in generated code/schema: ${model}`,
        });
      }
    }
  }

  if (contract.secondaryCapabilities.includes("authentication")) {
    const authBehavior =
      /\b(?:authenticate|authorization|session|jwt|verifytoken|currentUser|supabase\.auth|nextauth|clerk|passport)\b/i.test(
        code,
      );
    if (!authBehavior) {
      findings.push({
        code: "missing_authentication",
        message:
          "Authentication is required by the contract but no real session/token/provider behavior is present.",
      });
    }
  }

  if (
    contract.secondaryCapabilities.includes("billing") ||
    contract.monetizationRequirements.length > 0
  ) {
    const provider =
      /\b(?:stripe|paddle|braintree|paypal|checkout|paymentintent|subscription)\b/i.test(
        code,
      );
    const enforcement =
      /\b(?:webhook|entitlement|subscriptionstatus|paid|billing|invoice)\b/i.test(
        code,
      );
    if (!provider || !enforcement) {
      findings.push({
        code: "missing_billing",
        message:
          "Billing/monetization is required but provider integration and server-authoritative entitlement/billing behavior are incomplete.",
      });
    }
  }

  if (contract.secondaryCapabilities.includes("ai")) {
    const aiProvider =
      /\b(?:openai|anthropic|gemini|groq|openrouter|ollama|responses\.create|chat\.completions|generateContent|streamText|generateText)\b/i.test(
        code,
      );
    const invocation =
      /\b(?:await\s+[^;]*(?:responses\.create|chat\.completions|generateContent|streamText|generateText)|invoke\s*\(|stream\s*\()/i.test(
        code,
      );
    if (!aiProvider || !invocation) {
      findings.push({
        code: "missing_ai_behavior",
        message:
          "AI capability is required but no real model-provider invocation is present.",
      });
    }
  }

  return findings;
}

function inspectDeploymentConfig(
  files: Record<string, string>,
  contract: ProductContract,
): IncompleteProductFinding[] {
  if (contract.deploymentRequirements.length === 0) return [];
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  const findings: IncompleteProductFinding[] = [];

  const raw = files["appforge.deploy.json"];
  if (!raw) {
    findings.push({
      code: "incomplete_deployment_config",
      message: "Missing appforge.deploy.json deployment metadata.",
    });
    return findings;
  }

  try {
    const parsed = JSON.parse(raw) as {
      stack?: string;
      targets?: string[];
      buildCommand?: string | null;
      startCommand?: string | null;
      outputDirectory?: string | null;
      generationMode?: string;
    };
    if (parsed.stack !== adapter.id) {
      findings.push({
        code: "incomplete_deployment_config",
        message: "Deployment metadata stack does not match the canonical selected stack.",
      });
    }
    if (
      JSON.stringify(parsed.targets ?? []) !==
      JSON.stringify(adapter.deploymentTargets)
    ) {
      findings.push({
        code: "incomplete_deployment_config",
        message: "Deployment targets do not match the selected stack adapter.",
      });
    }
    if (parsed.buildCommand !== adapter.buildCommand) {
      findings.push({
        code: "incomplete_deployment_config",
        message: "Deployment build command is missing or does not match the selected stack.",
      });
    }
    if (parsed.startCommand !== adapter.startCommand) {
      findings.push({
        code: "incomplete_deployment_config",
        message: "Deployment start command is missing or does not match the selected stack.",
      });
    }
    if (parsed.outputDirectory !== adapter.outputDirectory) {
      findings.push({
        code: "incomplete_deployment_config",
        message: "Deployment output directory does not match the selected stack.",
      });
    }
    if (parsed.generationMode !== adapter.generationMode) {
      findings.push({
        code: "incomplete_deployment_config",
        message: "Deployment generation mode does not match the selected stack.",
      });
    }
  } catch {
    findings.push({
      code: "incomplete_deployment_config",
      message: "appforge.deploy.json is invalid JSON.",
    });
  }

  return findings;
}

export function inspectIncompleteProduct(input: {
  files: Record<string, string>;
  productContract: ProductContract;
  productPlan?: ProductPlan;
}): IncompleteProductReport {
  const contract = validateProductContract(input.productContract);
  const findings = [
    ...inspectPlaceholderAndEmptyFiles(input.files),
    ...inspectRequirementEvidence(input.files, contract, input.productPlan),
    ...inspectContractCoverage(input.files, contract),
    ...inspectDeploymentConfig(input.files, contract),
  ];

  const unique = new Map<string, IncompleteProductFinding>();
  for (const finding of findings) {
    const key = [
      finding.code,
      finding.path ?? "",
      finding.requirementId ?? "",
      finding.message,
    ].join("|");
    unique.set(key, finding);
  }

  const normalizedFindings = [...unique.values()];
  return {
    version: 1,
    complete: normalizedFindings.length === 0,
    productType: contract.productType,
    selectedTechnologyStack: contract.selectedTechnologyStack,
    findings: normalizedFindings,
  };
}

export function assertProductComplete(input: {
  files: Record<string, string>;
  productContract: ProductContract;
  productPlan?: ProductPlan;
  context?: string;
}): IncompleteProductReport {
  const report = inspectIncompleteProduct(input);
  if (!report.complete) {
    const detail = report.findings
      .slice(0, 12)
      .map(
        (finding) =>
          `${finding.code}${finding.path ? `@${finding.path}` : ""}: ${finding.message}`,
      )
      .join("; ");
    throw new Error(
      `${input.context ?? "Product completeness gate"} failed: ${detail}`,
    );
  }
  return report;
}

export function attachCompletenessEvidence(input: {
  files: Record<string, string>;
  productContract: ProductContract;
  productPlan?: ProductPlan;
}): Record<string, string> {
  const report = assertProductComplete({
    ...input,
    context: "Completeness evidence",
  });
  return {
    ...input.files,
    "appforge.completeness.json": JSON.stringify(report, null, 2),
  };
}

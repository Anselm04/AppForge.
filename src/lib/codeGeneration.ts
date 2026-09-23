import { getStackAdapter } from "./stackAdapters.js";
import type { ProductContract } from "./productContract.js";
import type { ProductPlan, ProductPlanTask } from "./productPlan.js";
import type { ResearchDecision } from "./researchRecord.js";

const PLACEHOLDER_PATTERNS: Array<[RegExp, string]> = [
  [/\bTODO\b/i, "TODO marker"],
  [/\bcoming soon\b/i, "coming-soon placeholder"],
  [/scaffold is ready/i, "scaffold-ready placeholder"],
  [/your generated ui will replace/i, "generated-UI placeholder"],
  [/\bgenerated product\b/i, "generic generated-product placeholder"],
  [/\bnot implemented\b/i, "not-implemented placeholder"],
  [/throw\s+new\s+Error\s*\(\s*["'`]Not implemented/i, "not-implemented exception"],
];

const EMPTY_HANDLER_PATTERNS: RegExp[] = [
  /(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*\}/m,
  /(?:async\s*)?[A-Za-z_$][\w$]*\s*=>\s*\{\s*\}/m,
  /function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{\s*\}/m,
];

function isTextSource(path: string): boolean {
  return !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|pdf)$/i.test(path);
}

function isCodeFile(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?|py|dart|rs|go|java|kt|swift|html|css)$/i.test(path);
}

function wrongStackProblems(
  files: Record<string, string>,
  stackId: string,
): string[] {
  const adapter = getStackAdapter(stackId);
  const problems: string[] = [];

  for (const [path, source] of Object.entries(files)) {
    if (!isTextSource(path)) continue;

    if (
      adapter.runtime === "python" &&
      /\.(?:tsx?|jsx?)$/i.test(path)
    ) {
      problems.push(`${path}: JavaScript/React file does not match Python runtime`);
    }

    if (
      adapter.runtime === "mobile" &&
      adapter.id === "flutter-firebase" &&
      (/\.(?:tsx?|jsx?)$/i.test(path) ||
        /from\s+["']react["']|react-dom/i.test(source))
    ) {
      problems.push(`${path}: React output does not match Flutter stack`);
    }

    if (
      adapter.id === "react-native-expo" &&
      /react-dom|document\.getElementById|<html\b|<body\b/i.test(source)
    ) {
      problems.push(`${path}: browser DOM output does not match React Native stack`);
    }

    if (
      ["api-service", "node-service", "ai-agent-node", "browser-automation"].includes(
        adapter.id,
      ) &&
      (/\.(?:tsx|jsx)$/i.test(path) || /react-dom\/client/i.test(source))
    ) {
      problems.push(`${path}: browser UI output does not match service stack`);
    }

    if (
      ["react-node", "next-node", "data-visualization"].includes(adapter.id) &&
      /from\s+fastapi\s+import|import\s+Flutter|package:flutter\//i.test(source)
    ) {
      problems.push(`${path}: generated code does not match ${adapter.id}`);
    }
  }

  return problems;
}

export function coderTaskInstruction(input: {
  contract: ProductContract;
  plan: ProductPlan;
  task: ProductPlanTask;
  researchDecisions: ResearchDecision[];
}): string {
  const { contract, plan, task } = input;
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  const taskRequirements = contract.functionalRequirements.filter((requirement) =>
    task.requirementIds.includes(requirement.id),
  );
  const applicableResearch = input.researchDecisions.filter((decision) =>
    plan.researchDecisionIds.includes(decision.id),
  );

  const capabilityRules: string[] = [];
  if (contract.secondaryCapabilities.includes("authentication")) {
    capabilityRules.push(
      "Authentication must implement real sign-in/session/error behavior; never fake an authenticated state.",
    );
  }
  if (contract.secondaryCapabilities.includes("database")) {
    capabilityRules.push(
      "Persistence must perform real validated reads/writes through the planned data boundary; do not use fake in-memory success as production behavior.",
    );
  }
  if (contract.secondaryCapabilities.includes("billing")) {
    capabilityRules.push(
      "Billing and entitlements must be server-authoritative, handle failures, and never trust paid state only in the client.",
    );
  }
  if (contract.secondaryCapabilities.includes("external_integrations")) {
    capabilityRules.push(
      "External integrations must include timeout/error handling and explicit unconfigured states; never claim an integration succeeded without a provider response.",
    );
  }
  if (contract.secondaryCapabilities.includes("ai")) {
    capabilityRules.push(
      "AI behavior must expose loading/error states, validate outputs, and never claim an external action occurred unless the tool/provider actually confirms it.",
    );
  }
  if (contract.productFamilies.includes("frontend")) {
    capabilityRules.push(
      "Interactive UI must implement loading, empty, success, and error states for every asynchronous primary workflow; buttons/forms must invoke real handlers.",
    );
  }

  return [
    "CODE GENERATION CONTRACT — authoritative:",
    `Product type: ${contract.productType}`,
    `Selected stack: ${adapter.id} (${adapter.label})`,
    `Runtime: ${adapter.runtime}`,
    `Runtime entrypoints: ${adapter.entrypoints.join(", ")}`,
    `Environment files: ${adapter.environmentFiles.join(", ") || "none"}`,
    `Task ID: ${task.id}`,
    `Task owner: ${task.agent}`,
    `Task files (ALL must be returned as complete files): ${task.files.join(", ")}`,
    `Acceptance criteria: ${task.acceptanceCriteria.join(" | ")}`,
    "Requirement IDs and text:",
    ...taskRequirements.map(
      (requirement) =>
        `- ${requirement.id} [${requirement.priority}/${requirement.category}]: ${requirement.text}`,
    ),
    "Applicable research decisions:",
    ...(applicableResearch.length
      ? applicableResearch.map(
          (decision) =>
            `- ${decision.id}: ${decision.decision} — ${decision.rationale}`,
        )
      : ["- none"]),
    "Mandatory implementation rules:",
    "- Return EVERY planned task file in full, even when modifying an existing file.",
    "- Output only // filename: <path> blocks for the files owned by this task.",
    "- Implement real workflows and real state transitions; no mock success, stubs, placeholders, TODO-only files, or empty handlers.",
    "- Preserve the canonical product scope, architecture, requirement IDs, and selected technology stack.",
    "- Add a short comment near substantive implementation points using the exact form: // requirement: REQ-001 (use the real requirement ID).",
    "- Never embed secrets. Read runtime configuration from environment/server configuration appropriate to the selected stack.",
    "- Generate production error handling and validation for external/user-controlled inputs.",
    ...capabilityRules.map((rule) => `- ${rule}`),
  ].join("\n");
}

export function validateCoderTaskOutput(input: {
  files: Record<string, string>;
  task: ProductPlanTask;
  contract: ProductContract;
}): void {
  const planned = new Set(input.task.files);
  const produced = Object.keys(input.files);

  if (produced.length === 0) {
    throw new Error(`Task ${input.task.id} returned no files`);
  }

  const missing = input.task.files.filter((path) => !(path in input.files));
  if (missing.length > 0) {
    throw new Error(
      `Task ${input.task.id} omitted planned complete file(s): ${missing.join(", ")}`,
    );
  }

  const unexpected = produced.filter((path) => !planned.has(path));
  if (unexpected.length > 0) {
    throw new Error(
      `Task ${input.task.id} returned unplanned file(s): ${unexpected.join(", ")}`,
    );
  }

  for (const [path, source] of Object.entries(input.files)) {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new Error(`Task ${input.task.id} returned empty file ${path}`);
    }
    if (isCodeFile(path) && trimmed.length < 24) {
      throw new Error(
        `Task ${input.task.id} returned suspiciously incomplete code file ${path}`,
      );
    }
    if (!isTextSource(path)) continue;

    for (const [pattern, label] of PLACEHOLDER_PATTERNS) {
      if (pattern.test(source)) {
        throw new Error(
          `Task ${input.task.id} returned ${label} in ${path}`,
        );
      }
    }
    if (
      isCodeFile(path) &&
      EMPTY_HANDLER_PATTERNS.some((pattern) => pattern.test(source))
    ) {
      throw new Error(
        `Task ${input.task.id} returned an empty handler in ${path}`,
      );
    }
  }

  const combined = Object.values(input.files).join("\n");
  for (const requirementId of input.task.requirementIds) {
    if (!combined.includes(`requirement: ${requirementId}`)) {
      throw new Error(
        `Task ${input.task.id} has no implementation evidence marker for ${requirementId}`,
      );
    }
  }

  const stackProblems = wrongStackProblems(
    input.files,
    input.contract.selectedTechnologyStack,
  );
  if (stackProblems.length > 0) {
    throw new Error(
      `Task ${input.task.id} generated wrong-stack output: ${stackProblems.join("; ")}`,
    );
  }
}

export function validateCoderOwnedArtifact(input: {
  files: Record<string, string>;
  contract: ProductContract;
}): string[] {
  const adapter = getStackAdapter(input.contract.selectedTechnologyStack);
  const problems: string[] = [];

  for (const entrypoint of adapter.entrypoints) {
    if (!input.files[entrypoint]?.trim()) {
      problems.push(`Coder omitted runtime entrypoint ${entrypoint}`);
    }
  }

  for (const envFile of adapter.environmentFiles) {
    if (envFile.endsWith(".json")) continue;
    if (!input.files[envFile]?.trim()) {
      problems.push(`Coder omitted environment example ${envFile}`);
    }
  }

  if (!input.files["README.md"]?.trim()) {
    problems.push("Coder omitted README.md documentation");
  }

  problems.push(
    ...wrongStackProblems(
      input.files,
      input.contract.selectedTechnologyStack,
    ),
  );

  return [...new Set(problems)];
}

export function buildImplementationEvidence(input: {
  contract: ProductContract;
  plan: ProductPlan;
}): string {
  const requirements = input.contract.functionalRequirements.map((requirement) => {
    const taskIds = input.plan.requirementToTasks[requirement.id] ?? [];
    const files = [
      ...new Set(
        taskIds.flatMap((taskId) => input.plan.taskToFiles[taskId] ?? []),
      ),
    ];
    return {
      id: requirement.id,
      priority: requirement.priority,
      category: requirement.category,
      text: requirement.text,
      taskIds,
      files,
      validations: [
        ...new Set(
          taskIds.flatMap((taskId) => input.plan.taskToValidation[taskId] ?? []),
        ),
      ],
    };
  });

  return JSON.stringify(
    {
      version: 1,
      productType: input.contract.productType,
      selectedTechnologyStack: input.contract.selectedTechnologyStack,
      canonicalInterpretation: input.contract.canonicalInterpretation,
      researchDecisionIds: input.plan.researchDecisionIds,
      requirements,
    },
    null,
    2,
  );
}

export function ensureCodeGenerationSupportFiles(input: {
  files: Record<string, string>;
  contract: ProductContract;
  plan: ProductPlan;
}): Record<string, string> {
  const files = { ...input.files };
  const adapter = getStackAdapter(input.contract.selectedTechnologyStack);

  files["appforge.implementation.json"] = buildImplementationEvidence({
    contract: input.contract,
    plan: input.plan,
  });

  for (const envFile of adapter.environmentFiles) {
    if (envFile === "app.json" || envFile.endsWith(".json")) continue;
    if (!files[envFile]) {
      files[envFile] =
        "# Configure required runtime values here. Never commit production secrets.\n";
    }
  }

  if (!files["README.md"] || /AppForge project|Generated by AppForge/i.test(files["README.md"])) {
    files["README.md"] = [
      `# ${input.plan.title}`,
      "",
      input.plan.overview,
      "",
      `**Product type:** ${input.contract.productType}`,
      `**Technology stack:** ${adapter.label} (${adapter.id})`,
      `**Runtime:** ${adapter.runtime}`,
      `**Build:** ${adapter.buildCommand ?? "not applicable"}`,
      `**Start:** ${adapter.startCommand ?? "not applicable"}`,
      "",
      "## Runtime entrypoints",
      ...adapter.entrypoints.map((entry) => `- ${entry}`),
      "",
      "## Environment",
      ...(adapter.environmentFiles.length
        ? adapter.environmentFiles.map((path) => `- ${path}`)
        : ["- No runtime environment file required."]),
      "",
      "## Requirements evidence",
      "See `appforge.implementation.json` for requirement-to-task/file/validation mappings.",
      "",
      "## Production behavior",
      "Runtime credentials must be supplied through the configured environment. Generated source must not contain production secrets.",
      "",
    ].join("\n");
  }

  return files;
}

export function validateGeneratedCodeArtifact(input: {
  files: Record<string, string>;
  contract: ProductContract;
  plan: ProductPlan;
}): string[] {
  const problems: string[] = [];
  const adapter = getStackAdapter(input.contract.selectedTechnologyStack);

  for (const task of input.plan.tasks) {
    for (const plannedFile of task.files) {
      if (!input.files[plannedFile]?.trim()) {
        problems.push(
          `planned generated file disappeared before validation: ${plannedFile}`,
        );
      }
    }
  }

  for (const entrypoint of adapter.entrypoints) {
    if (!input.files[entrypoint]?.trim()) {
      problems.push(`missing runtime entrypoint ${entrypoint}`);
    }
  }

  for (const envFile of adapter.environmentFiles) {
    if (!input.files[envFile]?.trim() && envFile !== "app.json") {
      problems.push(`missing environment example/config ${envFile}`);
    }
  }

  if (!input.files["README.md"]?.trim()) {
    problems.push("missing generated documentation README.md");
  }
  if (!input.files["appforge.implementation.json"]?.trim()) {
    problems.push("missing requirement-linked implementation metadata");
  }

  const stackProblems = wrongStackProblems(
    input.files,
    input.contract.selectedTechnologyStack,
  );
  problems.push(...stackProblems);

  for (const [path, source] of Object.entries(input.files)) {
    if (!isTextSource(path)) continue;
    for (const [pattern, label] of PLACEHOLDER_PATTERNS) {
      if (pattern.test(source)) problems.push(`${path}: ${label}`);
    }
  }

  return [...new Set(problems)];
}

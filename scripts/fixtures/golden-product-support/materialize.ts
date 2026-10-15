import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ensureCodeGenerationSupportFiles } from "../../../src/lib/codeGeneration.js";
import { resolveIntakeContract } from "../../../src/lib/productContract.js";
import type { ProductPlan } from "../../../src/lib/productPlan.js";
import { getStackScaffold } from "../../../src/services/stackScaffolds.js";

const destination = process.argv[2];
if (!destination?.startsWith("/")) {
  throw new Error("Usage: materialize.ts ABSOLUTE_DESTINATION");
}

const prompt = [
  "Build an iPhone and Android restaurant table availability app.",
  "Users sign up and sign in, save restaurant watches in a database, choose preferred dates, time ranges and party sizes,",
  "monitor authorized reservation-provider API availability in the background on a recurring schedule,",
  "receive push notifications with deep links when a match appears, use hands-free voice commands with spoken replies,",
  "and only book a table after the user explicitly confirms.",
  "Charge $9.99 per month through Stripe with server-authoritative paid entitlements.",
].join(" ");

const intake = resolveIntakeContract(prompt);
if (!intake.ok) throw new Error(intake.message);
if (intake.productContract.selectedTechnologyStack !== "flutter-node") {
  throw new Error(`Expected flutter-node, got ${intake.productContract.selectedTechnologyStack}`);
}

const ids = intake.productContract.functionalRequirements.map((r) => r.id);
const taskId = "GOLDEN-001";
const plan: ProductPlan = {
  version: 1,
  title: "Golden Product compile fixture",
  overview: "Compile the combined generated capability layers.",
  productType: "mobile_app",
  selectedTechnologyStack: "flutter-node",
  architecture: {
    summary: "Flutter + Node",
    workflows: ["watch", "notify", "confirm booking"],
    personas: ["Diner"],
    roles: ["user"],
    frontendModules: ["Mobile client"],
    backendModules: ["API", "Worker"],
    databaseModules: ["Watches", "Entitlements"],
    aiModules: [],
    integrationModules: ["Stripe", "Authorized reservation provider"],
    authenticationDesign: "Secure user accounts.",
    authorizationDesign: "Owner-scoped data.",
    billingDesign: "Stripe test mode.",
    deploymentDesign: "iOS, Android, Node.",
    operationsDesign: "Durable background jobs.",
    recoveryDesign: "Idempotent external effects.",
    monetizationPlan: "$9.99 monthly subscription.",
  },
  implementationSequence: [taskId],
  tasks: [
    {
      id: taskId,
      module: "Golden Product",
      description: "Compile combined generated support.",
      sequence: 1,
      dependencies: [],
      acceptanceCriteria: ["Generated support compiles."],
      requirementIds: ids,
      files: ["lib/main.dart", "server/src/server.ts"],
      agent: "integration",
      validations: ["compile"],
    },
  ],
  requirementToTasks: Object.fromEntries(ids.map((id) => [id, [taskId]])),
  taskToFiles: { [taskId]: ["lib/main.dart", "server/src/server.ts"] },
  taskToAgent: { [taskId]: "integration" },
  taskToValidation: { [taskId]: ["compile"] },
  researchDecisionIds: [],
};

const scaffold = getStackScaffold("flutter-node", "mobile_app");
const files = ensureCodeGenerationSupportFiles({
  files: scaffold,
  contract: intake.productContract,
  plan,
});

for (const [path, content] of Object.entries(files)) {
  await mkdir(resolve(destination, path, ".."), { recursive: true });
  await writeFile(join(destination, path), content);
}

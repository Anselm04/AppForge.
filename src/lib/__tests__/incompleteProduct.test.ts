import { describe, expect, it } from "vitest";
import {
  assertProductComplete,
  attachCompletenessEvidence,
  inspectIncompleteProduct,
} from "../incompleteProduct.js";
import {
  validateProductContract,
  type ProductContract,
} from "../productContract.js";
import { getStackAdapter } from "../stackAdapters.js";
import { deployProject, type DeployDestination } from "../../services/deployer.js";

function contract(overrides: Partial<ProductContract> = {}): ProductContract {
  return validateProductContract({
    version: 2,
    originalPrompt: "Build a task tracker dashboard where teams track tasks and complete tasks",
    productType: "saas_application",
    productFamilies: ["frontend", "backend", "deployment"],
    targetUsers: ["Teams"],
    userRoles: ["member", "admin"],
    coreWorkflows: ["Track tasks", "Complete tasks"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Users can track tasks.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-002",
        text: "Users can complete tasks.",
        category: "workflow",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["No placeholders", "Production-safe errors"],
    dataModels: [],
    integrations: [],
    securityRequirements: ["Validate user input"],
    deploymentRequirements: ["Deploy a runnable production artifact"],
    monetizationRequirements: [],
    selectedTechnologyStack: "react-node",
    researchRequirements: [],
    runtimeRequirements: ["React browser runtime"],
    secondaryCapabilities: ["deployment"],
    intentConfidence: 0.99,
    canonicalInterpretation:
      "A team task tracker with task tracking and completion workflows.",
    ...overrides,
  });
}

function deploymentMetadata(stack = "react-node"): string {
  const adapter = getStackAdapter(stack);
  return JSON.stringify({
    stack: adapter.id,
    targets: adapter.deploymentTargets,
    buildCommand: adapter.buildCommand,
    startCommand: adapter.startCommand,
    outputDirectory: adapter.outputDirectory,
    generationMode: adapter.generationMode,
  });
}

function completeFiles(c = contract()): Record<string, string> {
  return {
    "src/App.tsx": `
      import { useState } from "react";
      export function App() {
        // requirement: REQ-001
        // requirement: REQ-002
        const [tasks, setTasks] = useState([{ id: 1, title: "Track tasks", done: false }]);
        function completeTask() {
          setTasks((items) => items.map((task) => ({ ...task, done: true })));
        }
        return (
          <main>
            <h1>Task tracker dashboard</h1>
            <p>Track tasks and complete tasks with your team.</p>
            {tasks.map((task) => <article key={task.id}>{task.title}</article>)}
            <button onClick={completeTask}>Complete task</button>
          </main>
        );
      }
    `,
    "src/main.tsx":
      'import { App } from "./App";\nconsole.info("task tracker", App);',
    "appforge.implementation.json": JSON.stringify({
      version: 1,
      requirements: c.functionalRequirements.map((requirement) => ({
        id: requirement.id,
        taskIds: ["T1"],
        files: ["src/App.tsx"],
        validations: [`behavioral test for ${requirement.id}`],
      })),
    }),
    "appforge.deploy.json": deploymentMetadata(
      c.selectedTechnologyStack,
    ),
  };
}

describe("placeholder and incomplete-product protection", () => {
  it.each([
    "Scaffold is ready",
    "Your generated UI will replace this screen",
    "Generated product",
    "Coming soon",
  ])("detects forbidden placeholder text: %s", (text) => {
    const c = contract();
    const files = completeFiles(c);
    files["src/App.tsx"] += `\nexport const placeholderMessage = ${JSON.stringify(text)};`;
    const report = inspectIncompleteProduct({
      files,
      productContract: c,
    });
    expect(report.complete).toBe(false);
    expect(report.findings.some((finding) => finding.code === "placeholder_text")).toBe(
      true,
    );
  });

  it("detects TODO-only files, empty components/pages, fake buttons and fake forms", () => {
    const c = contract();
    const files = completeFiles(c);
    files["src/todo.ts"] = "// TODO";
    files["src/Empty.tsx"] = "export function Empty(){ return null; }";
    files["src/page.tsx"] =
      'export function Page(){ return <><button>Save</button><form><input name="x" /></form></>; }';

    const codes = inspectIncompleteProduct({
      files,
      productContract: c,
    }).findings.map((finding) => finding.code);

    expect(codes).toContain("todo_only_file");
    expect(codes).toContain("empty_component");
    expect(codes).toContain("fake_button");
    expect(codes).toContain("fake_form");
  });

  it("detects fake API success, empty services and empty database schemas", () => {
    const c = contract();
    const files = completeFiles(c);
    files["src/api/tasks.ts"] =
      'export function handler(_req:any,res:any){ res.json({ success: true }); }';
    files["src/TaskService.ts"] = "export class TaskService {}";
    files["src/db/schema.ts"] = "export const schema = {};";

    const codes = inspectIncompleteProduct({
      files,
      productContract: c,
    }).findings.map((finding) => finding.code);

    expect(codes).toContain("fake_api_response");
    expect(codes).toContain("empty_service");
    expect(codes).toContain("empty_database_schema");
  });

  it("detects unrelated generic pages and missing primary workflows", () => {
    const c = contract();
    const files = completeFiles(c);
    files["src/App.tsx"] =
      'export function App(){ return <main><h1>Weather forecast</h1><button onClick={()=>console.log("weather")}>Refresh weather</button></main>; }';

    const codes = inspectIncompleteProduct({
      files,
      productContract: c,
    }).findings.map((finding) => finding.code);

    expect(codes).toContain("generic_unrelated_page");
    expect(codes).toContain("missing_primary_workflow");
  });

  it("detects missing integrations, data models, authentication, billing and AI behavior", () => {
    const c = contract({
      productFamilies: [
        "frontend",
        "backend",
        "database",
        "auth",
        "billing",
        "ai",
        "deployment",
      ],
      integrations: ["Slack"],
      dataModels: ["TaskRecord"],
      monetizationRequirements: ["Paid subscription access"],
      secondaryCapabilities: [
        "authentication",
        "database",
        "billing",
        "ai",
        "external_integrations",
        "deployment",
      ],
    });
    const files = completeFiles(c);

    const codes = inspectIncompleteProduct({
      files,
      productContract: c,
    }).findings.map((finding) => finding.code);

    expect(codes).toContain("missing_integration");
    expect(codes).toContain("missing_data_model");
    expect(codes).toContain("missing_authentication");
    expect(codes).toContain("missing_billing");
    expect(codes).toContain("missing_ai_behavior");
  });

  it("detects incomplete deployment configuration", () => {
    const c = contract();
    const files = completeFiles(c);
    delete files["appforge.deploy.json"];

    const report = inspectIncompleteProduct({
      files,
      productContract: c,
    });

    expect(report.findings.some(
      (finding) => finding.code === "incomplete_deployment_config",
    )).toBe(true);
  });

  it("detects missing must-have requirement implementation evidence", () => {
    const c = contract();
    const files = completeFiles(c);
    files["appforge.implementation.json"] = JSON.stringify({
      version: 1,
      requirements: [],
    });

    const report = inspectIncompleteProduct({
      files,
      productContract: c,
    });

    expect(
      report.findings.filter(
        (finding) => finding.code === "missing_requirement_evidence",
      ),
    ).toHaveLength(2);
  });

  it("accepts a complete product and persists completeness evidence", () => {
    const c = contract();
    const files = completeFiles(c);
    const report = assertProductComplete({
      files,
      productContract: c,
    });
    expect(report.complete).toBe(true);

    const withEvidence = attachCompletenessEvidence({
      files,
      productContract: c,
    });
    expect(JSON.parse(withEvidence["appforge.completeness.json"]).complete).toBe(
      true,
    );
  });

  it("blocks production deployment before contacting a provider when product is incomplete", async () => {
    const c = contract();
    const files = completeFiles(c);
    files["src/App.tsx"] = "export function App(){ return null; }";

    const adapter = getStackAdapter(c.selectedTechnologyStack);
    const destination = adapter.deploymentTargets.find((target) =>
      ["vercel", "netlify", "fly", "github-pages"].includes(target),
    ) as DeployDestination | undefined;
    expect(destination).toBeTruthy();

    await expect(
      deployProject({
        destination: destination!,
        projectName: "incomplete-product",
        files,
        techStack: adapter.id,
        productContract: c,
      }),
    ).rejects.toThrow(/Deployment completeness gate failed/);
  });
});

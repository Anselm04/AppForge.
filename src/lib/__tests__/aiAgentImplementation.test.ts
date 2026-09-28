import { describe, expect, it } from "vitest";
import {
  aiAgentCoderInstruction,
  aiAgentPlannerInstruction,
  aiAgentPolicy,
  validateAiAgentArtifact,
} from "../aiAgentImplementation.js";
import {
  buildProductContract,
  validateProductContract,
  type ProductContract,
} from "../productContract.js";
import { validateProductPlan } from "../productPlan.js";

function contract(): ProductContract {
  return validateProductContract({
    version: 2,
    originalPrompt:
      "Build an AI agent that remembers user preferences, triages email, drafts replies, and sends approved messages using tools",
    productType: "ai_agent",
    productFamilies: ["ai", "backend", "deployment"],
    targetUsers: ["Knowledge workers"],
    userRoles: ["user"],
    coreWorkflows: [
      "Understand the user request",
      "Recall scoped user preferences",
      "Draft a reply",
      "Ask for approval before sending",
      "Send the approved reply with a tool",
    ],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Route requests across configured model providers.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-002",
        text: "Use permissioned tools and require human approval before sending email.",
        category: "security",
        priority: "must",
      },
      {
        id: "REQ-003",
        text: "Keep memory scoped to the authorized user and bounded.",
        category: "security",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: [
      "Bound retries, timeouts, context, output tokens and model cost.",
      "Show truthful AI status and audit tool outcomes.",
    ],
    dataModels: [],
    integrations: [],
    securityRequirements: [
      "Protect against prompt injection.",
      "Never expose model provider secrets.",
      "Never execute unrestricted commands.",
      "Never claim a tool action succeeded without a verified result.",
    ],
    deploymentRequirements: ["Run as a production Node AI agent."],
    monetizationRequirements: [],
    selectedTechnologyStack: "ai-agent-node",
    researchRequirements: ["Use current provider tool-calling guidance."],
    runtimeRequirements: ["Node runtime."],
    secondaryCapabilities: ["ai", "deployment"],
    intentConfidence: 0.99,
    canonicalInterpretation:
      "Build a permissioned Node AI agent with memory and approved email tools.",
  });
}

function completeFiles(): Record<string, string> {
  return {
    "src/ai/provider.ts": [
      "export const providerConfig = {",
      "  openai: process.env.OPENAI_API_KEY,",
      "  groq: process.env.GROQ_API_KEY,",
      "};",
      'export const providerState = providerConfig.openai || providerConfig.groq ? "configured" : "unconfigured";',
    ].join("\n"),
    "src/ai/modelRouter.ts": [
      "const MAX_ATTEMPTS = 3;",
      "const maxTokens = 4096;",
      "const costLimitUsd = 0.25;",
      "export async function routeModel(providers: string[]) {",
      "  let lastError: unknown;",
      "  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {",
      "    const controller = new AbortController();",
      "    const timeout = setTimeout(() => controller.abort(), 10000);",
      "    try {",
      "      const provider = providers[(attempt - 1) % providers.length];",
      "      if (!provider) throw new Error('No model provider configured');",
      "      return { provider, model: 'bounded-model', maxTokens, costLimitUsd, fallback: attempt > 1 };",
      "    } catch (error) {",
      "      lastError = error;",
      "      if (attempt === MAX_ATTEMPTS) throw error;",
      "    } finally {",
      "      clearTimeout(timeout);",
      "    }",
      "  }",
      "  throw lastError;",
      "}",
    ].join("\n"),
    "src/ai/tools.ts": [
      "import { z } from 'zod';",
      "const sendEmailInput = z.object({ to: z.string().email(), body: z.string().max(10000) });",
      "export const allowedTools = ['send_email'] as const;",
      "export const toolRegistry = {",
      "  send_email: {",
      "    inputSchema: sendEmailInput,",
      "    permission: 'email:send',",
      "    scope: 'current_user',",
      "    requiresApproval: true,",
      "  },",
      "};",
      "export function getTool(name: string) {",
      "  if (!allowedTools.includes(name as any)) throw new Error('Tool not allowed');",
      "  return toolRegistry[name as keyof typeof toolRegistry];",
      "}",
    ].join("\n"),
    "src/ai/policy.ts": [
      "import { z } from 'zod';",
      "const resultSchema = z.object({ ok: z.boolean(), actionId: z.string().optional() });",
      "export const costLimitUsd = 0.25;",
      "export function inspectUntrustedPrompt(text: string) {",
      "  const promptInjection = /ignore previous|reveal system prompt|override tool permission/i.test(text);",
      "  if (promptInjection) return { allowed: false, refusal: 'Prompt injection detected' };",
      "  return { allowed: true };",
      "}",
      "export function requireApproval(input: { confirmedByUser: boolean }) {",
      "  if (!input.confirmedByUser) throw new Error('Human approval required');",
      "}",
      "export function validateToolResult(value: unknown) {",
      "  return resultSchema.parse(value);",
      "}",
      "export function denyUnauthorized(authorized: boolean) {",
      "  if (!authorized) return { refused: true, reason: 'Unauthorized request denied' };",
      "  return { refused: false };",
      "}",
    ].join("\n"),
    "src/ai/memory.ts": [
      "const maxEntries = 100;",
      "const retentionDays = 30;",
      "const contextLimit = 12000;",
      "export function memoryScope(userId: string) {",
      "  return { owner: userId, userId, maxEntries, retentionDays, contextLimit };",
      "}",
    ].join("\n"),
    "src/ai/audit.ts": [
      "export function redact(value: string) { return value.replace(/secret|credential/gi, '[redacted]'); }",
      "export function audit(event: { type: 'model'|'tool'|'approval'|'refusal'|'result'|'outcome'; message: string }) {",
      "  return { ...event, message: redact(event.message) };",
      "}",
    ].join("\n"),
    "src/ai/status.ts": [
      "export type AiStatus = 'thinking'|'waiting_for_approval'|'tool_running'|'succeeded'|'failed'|'refused'|'unconfigured';",
      "export function statusFromToolResult(toolResult: { ok: boolean } | null): AiStatus {",
      "  if (!toolResult) return 'tool_running';",
      "  return toolResult.ok ? 'succeeded' : 'failed';",
      "}",
      "export const approvalStatus: AiStatus = 'waiting_for_approval';",
      "export const refusedStatus: AiStatus = 'refused';",
    ].join("\n"),
    ".env.example": [
      "OPENAI_API_KEY=",
      "GROQ_API_KEY=",
      "AI_MAX_COST_USD=0.25",
    ].join("\n"),
    "docs/AI_AGENT.md": [
      "# AI Agent",
      "Provider configuration is server-side and model routing uses bounded fallback.",
      "Tool permission scopes use an allowlist and high-impact tools require human approval.",
      "Memory is user scoped with retention and context limits.",
      "Cost budgets and output limits prevent unbounded model spend.",
      "Prompt injection defenses treat retrieved content as untrusted.",
      "Refusal behavior denies unauthorized actions.",
      "Audit events redact secrets and record model/tool outcomes.",
      "Status states show approval, running, succeeded, failed and refused without claiming unverified actions.",
    ].join("\n"),
  };
}

function completePlan() {
  return {
    version: 1 as const,
    title: "Permissioned Mail Agent",
    overview: "A bounded AI agent with approved email tools.",
    productType: "ai_agent",
    selectedTechnologyStack: "ai-agent-node",
    architecture: {
      summary: "Node AI-agent service with bounded model and tool runtime.",
      workflows: ["Understand request", "Draft reply", "Approve", "Send"],
      personas: ["Knowledge worker"],
      roles: ["user"],
      frontendModules: [],
      backendModules: ["Agent service"],
      databaseModules: [],
      aiModules: ["Model router", "Tool runtime", "Safety policy"],
      integrationModules: [],
      authenticationDesign: "User identity is required before agent execution.",
      authorizationDesign:
        "Tool permissions are scoped to the authenticated user.",
      billingDesign: "No billing.",
      deploymentDesign: "Validated Node service deployment.",
      operationsDesign: "AI audit and status telemetry.",
      recoveryDesign: "Bounded retry and provider fallback.",
      monetizationPlan: "No monetization requirement.",
    },
    implementationSequence: ["AI-001"],
    tasks: [
      {
        id: "AI-001",
        module: "AI agent runtime",
        description:
          "Implement bounded model, tool, memory and safety runtime.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: [
          "Agent cannot exceed tool, memory, cost, approval or provider boundaries.",
        ],
        requirementIds: ["REQ-001", "REQ-002", "REQ-003"],
        files: Object.keys(completeFiles()),
        agent: "ai" as const,
        validations: [
          "model provider routing retry timeout cost context validation",
          "tool permission approval prompt injection refusal audit status validation",
        ],
      },
    ],
    requirementToTasks: {
      "REQ-001": ["AI-001"],
      "REQ-002": ["AI-001"],
      "REQ-003": ["AI-001"],
    },
    taskToFiles: { "AI-001": Object.keys(completeFiles()) },
    taskToAgent: { "AI-001": "ai" },
    taskToValidation: {
      "AI-001": [
        "model provider routing retry timeout cost context validation",
        "tool permission approval prompt injection refusal audit status validation",
      ],
    },
    researchDecisionIds: [],
  };
}

describe("Section 20 AI-agent product contract", () => {
  it("detects AI-agent intent and selects the dedicated agent stack", () => {
    const detected = buildProductContract(
      "Build an AI agent that triages my Gmail inbox and drafts replies",
      { productType: "ai_agent" },
    );
    expect(detected.productType).toBe("ai_agent");
    expect(detected.selectedTechnologyStack).toBe("ai-agent-node");
  });

  it("derives tool, approval and memory requirements from the contract", () => {
    expect(aiAgentPolicy(contract())).toEqual({
      required: true,
      toolUseExpected: true,
      approvalExpected: true,
      memoryExpected: true,
    });
  });

  it("requires a complete AI-owned planner task", () => {
    expect(() => validateProductPlan(completePlan(), contract())).not.toThrow();

    const broken = completePlan();
    broken.tasks[0].agent = "backend" as any;
    broken.taskToAgent["AI-001"] = "backend";
    expect(() => validateProductPlan(broken, contract())).toThrow(
      /AI-owned task/i,
    );
  });

  it("gives planner and coder all Section 20 boundaries", () => {
    for (const text of [
      aiAgentPlannerInstruction(contract()),
      aiAgentCoderInstruction(contract()),
    ]) {
      expect(text).toMatch(/provider/i);
      expect(text).toMatch(/routing|fallback/i);
      expect(text).toMatch(/tool/i);
      expect(text).toMatch(/permission/i);
      expect(text).toMatch(/memory|context/i);
      expect(text).toMatch(/cost|budget/i);
      expect(text).toMatch(/retry/i);
      expect(text).toMatch(/timeout/i);
      expect(text).toMatch(/approval/i);
      expect(text).toMatch(/prompt.?injection/i);
      expect(text).toMatch(/validation|validate/i);
      expect(text).toMatch(/refus/i);
      expect(text).toMatch(/audit/i);
      expect(text).toMatch(/status/i);
      expect(text).toMatch(/secret/i);
    }
  });

  it("accepts a bounded, permissioned and truthful AI-agent artifact", () => {
    expect(
      validateAiAgentArtifact({ contract: contract(), files: completeFiles() }),
    ).toEqual([]);
  });

  it("rejects missing approval, injection/refusal defenses and unscoped memory", () => {
    const files = completeFiles();
    files["src/ai/policy.ts"] =
      "export const costLimit = 1; export function validate(x: unknown){ return x; }";
    files["src/ai/memory.ts"] = "export const memory = { limit: 100 };";
    const problems = validateAiAgentArtifact({ contract: contract(), files });
    expect(problems).toContain(
      "ai-agent contract: no prompt-injection protection evidence",
    );
    expect(problems).toContain(
      "ai-agent contract: no refusal/deny behavior evidence",
    );
    expect(problems).toContain(
      "ai-agent contract: high-impact actions have no human approval gate",
    );
    expect(problems).toContain(
      "ai-agent contract: memory has no authorized user/tenant scope",
    );
  });

  it("rejects unrestricted command execution and client-side provider secrets", () => {
    const files = completeFiles();
    files["src/ai/tools.ts"] = [
      "import { exec } from 'node:child_process';",
      "export const allowedTools = ['shell'];",
      "export const permission = 'all';",
      "export const schema = {};",
      "export function shell(command: string){ return exec(command); }",
    ].join("\n");
    files["src/components/Leak.tsx"] =
      "export const key = import.meta.env.OPENAI_API_KEY;";
    const problems = validateAiAgentArtifact({ contract: contract(), files });
    expect(problems).toContain(
      "ai-agent contract: tool registry contains unrestricted command execution",
    );
    expect(problems).toContain(
      "ai-agent contract: client-exposed file references model/provider secret material: src/components/Leak.tsx",
    );
  });

  it("rejects fake action success that is not tied to a verified tool result", () => {
    const files = completeFiles();
    files["src/ai/status.ts"] =
      "export const status = { completed: true, state: 'succeeded' }; export const failed='failed'; export const refused='refused'; export const approval='approval'; export const running='running';";
    const problems = validateAiAgentArtifact({ contract: contract(), files });
    expect(problems).toContain(
      "ai-agent contract: status can claim action success without verified tool/provider result",
    );
  });
});

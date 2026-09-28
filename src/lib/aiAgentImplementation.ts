import { getStackAdapter } from "./stackAdapters.js";
import type { ProductContract } from "./productContract.js";

export type AiAgentPolicy = {
  required: boolean;
  toolUseExpected: boolean;
  approvalExpected: boolean;
  memoryExpected: boolean;
};

const PROVIDER_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:provider|providers|modelProvider|model_provider|llm)(?:\.|\/|$)/i;
const ROUTER_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:modelRouter|model_router|routing|router)(?:\.|\/|$)/i;
const TOOLS_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:tools?|toolRegistry|tool_registry)(?:\.|\/|$)/i;
const POLICY_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:policy|safety|guardrails?|permissions?)(?:\.|\/|$)/i;
const MEMORY_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:memory|context|state)(?:\.|\/|$)/i;
const AUDIT_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:audit|auditLog|audit_log|telemetry)(?:\.|\/|$)/i;
const STATUS_PATH =
  /(?:^|\/)(?:src\/|app\/)?(?:ai|agent)\/(?:status|health|progress)(?:\.|\/|$)/i;
const DOC_PATH = /(?:^|\/)docs\/(?:AI_AGENT|AI-AGENT|ai-agent|agent)\.md$/i;
const ENV_PATH = /(?:^|\/)\.env(?:\.example|\.sample|\.template)$/i;

const SECRET_PATTERN =
  /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|GROQ_API_KEY|DEEPSEEK_API_KEY|MISTRAL_API_KEY|TOGETHER_API_KEY|FIREWORKS_API_KEY|OPENROUTER_API_KEY|HF_TOKEN|HUGGINGFACE_API_KEY|API_SECRET|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|SERVICE_ROLE_KEY)\b/i;

const COMMAND_PATTERN =
  /\b(?:exec|execSync|spawn|spawnSync|execFile|execFileSync|os\.system|subprocess\.(?:run|Popen|call|check_call|check_output))\s*\(/i;

function textEntries(files: Record<string, string>): Array<[string, string]> {
  return Object.entries(files).filter(
    ([path]) => !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i.test(path),
  );
}

function combined(entries: Array<[string, string]>): string {
  return entries
    .map(([path, source]) => "// " + path + "\n" + source)
    .join("\n");
}

function isClientExposedPath(
  path: string,
  source: string,
  contract: ProductContract,
): boolean {
  if (/\.env(?:\.|$)/i.test(path) || /\.md$/i.test(path)) return false;
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  if (["browser", "mobile", "extension"].includes(adapter.runtime)) {
    return /\.(?:[cm]?[jt]sx?|dart|html)$/i.test(path);
  }
  if (/["']use client["']/.test(source)) return true;
  if (/^(?:src\/server|server|api|app\/api)\//i.test(path)) return false;
  if (
    /\.(?:tsx|jsx)$/i.test(path) ||
    /^src\/(?:components|pages|hooks|client|ui)\//i.test(path)
  ) {
    return true;
  }
  return false;
}

export function aiAgentPolicy(contract: ProductContract): AiAgentPolicy {
  const requirementText = [
    contract.originalPrompt,
    ...contract.coreWorkflows,
    ...contract.functionalRequirements.map((requirement) => requirement.text),
    ...contract.nonFunctionalRequirements,
    ...contract.securityRequirements,
  ].join(" ");

  const required = contract.productType === "ai_agent";
  const toolUseExpected =
    required &&
    /\b(tool|tools|action|actions|execute|execution|automation|email|calendar|browser|api|command|file|database|search|send|create|update|delete)\b/i.test(
      requirementText,
    );
  const approvalExpected =
    toolUseExpected &&
    /\b(send|delete|purchase|pay|publish|deploy|execute|command|modify|write|create|update|external|real[- ]world|side effect)\b/i.test(
      requirementText,
    );
  const memoryExpected =
    required &&
    /\b(memory|remember|conversation|history|context|persistent|profile|preferences)\b/i.test(
      requirementText,
    );

  return { required, toolUseExpected, approvalExpected, memoryExpected };
}

export function isAiProviderPath(path: string): boolean {
  return PROVIDER_PATH.test(path);
}
export function isAiRouterPath(path: string): boolean {
  return ROUTER_PATH.test(path);
}
export function isAiToolsPath(path: string): boolean {
  return TOOLS_PATH.test(path);
}
export function isAiPolicyPath(path: string): boolean {
  return POLICY_PATH.test(path);
}
export function isAiMemoryPath(path: string): boolean {
  return MEMORY_PATH.test(path);
}
export function isAiAuditPath(path: string): boolean {
  return AUDIT_PATH.test(path);
}
export function isAiStatusPath(path: string): boolean {
  return STATUS_PATH.test(path);
}
export function isAiDocsPath(path: string): boolean {
  return DOC_PATH.test(path);
}
export function isAiEnvPath(path: string): boolean {
  return ENV_PATH.test(path);
}

export function aiAgentPlannerInstruction(contract: ProductContract): string {
  const policy = aiAgentPolicy(contract);
  if (!policy.required) return "";

  return [
    "AI-AGENT PRODUCT PLAN — mandatory for this contract:",
    "- Include at least one task owned by the ai agent.",
    "- Plan explicit model-provider configuration and model routing/fallback code. Do not hard-code one provider key into business logic.",
    "- Plan a typed tool registry with per-tool permissions and least-privilege scopes.",
    "- Plan policy/guardrail code covering human approval boundaries, prompt-injection defense, refusal behavior, output validation, and truthful action-result reporting.",
    "- Plan memory/context boundaries with retention/scope rules and hard context/token limits.",
    "- Plan cost/budget limits plus bounded retry logic, timeout handling, and fallback behavior.",
    "- Plan durable audit logging for model calls, tool requests, approvals, refusals, and tool outcomes without logging secrets.",
    "- Plan user-visible AI status/progress that distinguishes thinking, waiting for approval, tool running, succeeded, failed, refused, and unconfigured states.",
    "- Include .env.example and docs/AI_AGENT.md setup/safety documentation.",
    policy.toolUseExpected
      ? "- This agent performs tools/actions: tool execution must be allowlisted and cannot accept unrestricted shell/filesystem/network commands."
      : "- Do not invent external tool execution when the product does not need it.",
    policy.approvalExpected
      ? "- Side-effecting actions require an explicit human approval gate before execution."
      : "- Human approval is still required for any newly introduced high-impact side effect.",
    policy.memoryExpected
      ? "- Persistent memory is requested: define tenant/user scope, retention, deletion, and maximum memory/context size."
      : "- Do not invent durable personal memory unless requested; keep transient context bounded.",
    "- Never allow unauthorized data access, client-side model secrets, unrestricted commands, or claims that an action occurred without a verified tool result.",
  ].join("\n");
}

export function aiAgentCoderInstruction(contract: ProductContract): string {
  const policy = aiAgentPolicy(contract);
  if (!policy.required) return "";

  return [
    "AI-agent implementation requirements:",
    "- Read model/provider credentials from server runtime configuration only and support explicit provider/model routing with bounded fallback.",
    "- Enforce hard max input/context/output token limits and a per-request or per-run cost/budget ceiling.",
    "- Implement bounded retry and timeout behavior; never retry indefinitely.",
    "- Define tools with typed input schemas, explicit permission scopes, and an allowlist. Reject unknown tools and arguments.",
    "- Treat tool/model retrieved content as untrusted. Detect/neutralize prompt-injection attempts that try to override system/tool permissions.",
    "- Validate model outputs before using them as structured data, commands, URLs, file paths, or tool arguments.",
    "- Implement explicit refusal/deny paths for disallowed or unauthorized requests.",
    "- Require human approval before high-impact or side-effecting tools execute.",
    "- Keep memory/context scoped to the current authorized tenant/user and enforce retention/size limits.",
    "- Audit model/tool/approval/refusal/result events using redacted metadata only; never log provider secrets or raw sensitive credentials.",
    "- Expose truthful user-visible status. Never report completed/sent/deployed/updated unless the corresponding tool result confirms success.",
    "- Prevent unrestricted shell/process execution and unrestricted filesystem/network/database access.",
    "- Add docs/AI_AGENT.md describing providers, routing, permissions, memory, limits, approvals, injection defense, refusal behavior, auditing, and status states.",
    policy.toolUseExpected
      ? "- The tool registry and permission boundary are mandatory for this product."
      : "- Keep the tool surface empty unless a requirement explicitly needs a tool.",
  ].join("\n");
}

export function validateAiAgentArtifact(input: {
  files: Record<string, string>;
  contract: ProductContract;
}): string[] {
  const policy = aiAgentPolicy(input.contract);
  if (!policy.required) return [];

  const entries = textEntries(input.files);
  const providerEntries = entries.filter(([path]) => isAiProviderPath(path));
  const routerEntries = entries.filter(([path]) => isAiRouterPath(path));
  const toolEntries = entries.filter(([path]) => isAiToolsPath(path));
  const policyEntries = entries.filter(([path]) => isAiPolicyPath(path));
  const memoryEntries = entries.filter(([path]) => isAiMemoryPath(path));
  const auditEntries = entries.filter(([path]) => isAiAuditPath(path));
  const statusEntries = entries.filter(([path]) => isAiStatusPath(path));
  const docsEntries = entries.filter(([path]) => isAiDocsPath(path));
  const envEntries = entries.filter(([path]) => isAiEnvPath(path));

  const providerSource = combined(providerEntries);
  const routerSource = combined(routerEntries);
  const toolSource = combined(toolEntries);
  const policySource = combined(policyEntries);
  const memorySource = combined(memoryEntries);
  const auditSource = combined(auditEntries);
  const statusSource = combined(statusEntries);
  const docsSource = combined(docsEntries);
  const allSource = combined(entries);
  const problems: string[] = [];

  if (providerEntries.length === 0)
    problems.push("ai-agent contract: missing model-provider configuration");
  if (routerEntries.length === 0)
    problems.push(
      "ai-agent contract: missing model routing/fallback implementation",
    );
  if (policy.toolUseExpected && toolEntries.length === 0)
    problems.push("ai-agent contract: missing typed tool registry");
  if (policyEntries.length === 0)
    problems.push(
      "ai-agent contract: missing AI safety/permission policy implementation",
    );
  if (memoryEntries.length === 0)
    problems.push(
      "ai-agent contract: missing memory/context boundary implementation",
    );
  if (auditEntries.length === 0)
    problems.push("ai-agent contract: missing AI audit logging implementation");
  if (statusEntries.length === 0)
    problems.push(
      "ai-agent contract: missing user-visible AI status implementation",
    );
  if (docsEntries.length === 0)
    problems.push(
      "ai-agent contract: missing AI-agent setup/safety documentation",
    );
  if (envEntries.length === 0)
    problems.push(
      "ai-agent contract: missing environment example/configuration",
    );

  if (
    providerEntries.length > 0 &&
    !/process\.env|os\.environ|getenv|environment/i.test(providerSource)
  ) {
    problems.push(
      "ai-agent contract: provider configuration is not environment-backed",
    );
  }
  if (
    routerEntries.length > 0 &&
    !/fallback|failover|provider|model/i.test(routerSource)
  ) {
    problems.push(
      "ai-agent contract: model router has no provider/model fallback evidence",
    );
  }
  if (
    routerEntries.length > 0 &&
    !/retry|maxAttempts|maxRetries|attempt/i.test(routerSource)
  ) {
    problems.push(
      "ai-agent contract: model router has no bounded retry evidence",
    );
  }
  if (
    routerEntries.length > 0 &&
    !/timeout|AbortController|AbortSignal|setTimeout/i.test(routerSource)
  ) {
    problems.push("ai-agent contract: model router has no timeout handling");
  }
  if (
    routerEntries.length > 0 &&
    !/maxTokens|max_tokens|contextLimit|context_limit|tokenLimit|token_limit/i.test(
      routerSource + "\n" + memorySource,
    )
  ) {
    problems.push("ai-agent contract: no hard context/token limit evidence");
  }
  if (
    !/budget|costLimit|cost_limit|maxCost|max_cost|spendLimit|spend_limit/i.test(
      routerSource + "\n" + policySource,
    )
  ) {
    problems.push("ai-agent contract: no cost/budget limit evidence");
  }

  if (policy.toolUseExpected && toolEntries.length > 0) {
    if (
      !/schema|zod|z\.object|jsonSchema|inputSchema|parameters/i.test(
        toolSource,
      )
    ) {
      problems.push("ai-agent contract: tool inputs are not schema-validated");
    }
    if (
      !/permission|scope|allowlist|allowedTools|allowed_tools/i.test(toolSource)
    ) {
      problems.push(
        "ai-agent contract: tool registry has no explicit permission boundary",
      );
    }
    if (
      /\b(?:shell|command|exec)\b/i.test(toolSource) &&
      COMMAND_PATTERN.test(toolSource)
    ) {
      problems.push(
        "ai-agent contract: tool registry contains unrestricted command execution",
      );
    }
  }

  if (
    policyEntries.length > 0 &&
    !/prompt.?injection|untrusted|instruction hierarchy|system prompt|ignore previous/i.test(
      policySource,
    )
  ) {
    problems.push("ai-agent contract: no prompt-injection protection evidence");
  }
  if (
    policyEntries.length > 0 &&
    !/refus|deny|disallow|forbidden|not authorized|unauthorized/i.test(
      policySource,
    )
  ) {
    problems.push("ai-agent contract: no refusal/deny behavior evidence");
  }
  if (
    policyEntries.length > 0 &&
    !/validate|schema|safeParse|parse\s*\(|guard/i.test(policySource)
  ) {
    problems.push(
      "ai-agent contract: no output/tool-argument validation evidence",
    );
  }
  if (
    policy.approvalExpected &&
    !/approval|approve|human.?in.?the.?loop|confirmation|confirmedByUser/i.test(
      policySource,
    )
  ) {
    problems.push(
      "ai-agent contract: high-impact actions have no human approval gate",
    );
  }

  if (
    memoryEntries.length > 0 &&
    !/tenant|userId|user_id|owner|scope/i.test(memorySource)
  ) {
    problems.push(
      "ai-agent contract: memory has no authorized user/tenant scope",
    );
  }
  if (
    memoryEntries.length > 0 &&
    !/retention|ttl|expires|maxEntries|max_entries|maxBytes|max_bytes|limit/i.test(
      memorySource,
    )
  ) {
    problems.push(
      "ai-agent contract: memory/context has no retention or size boundary",
    );
  }

  if (
    auditEntries.length > 0 &&
    !/tool|model|approval|refusal|result|outcome/i.test(auditSource)
  ) {
    problems.push(
      "ai-agent contract: audit log does not cover model/tool decision events",
    );
  }
  if (
    auditEntries.length > 0 &&
    !/redact|sanitize|secret|credential/i.test(auditSource)
  ) {
    problems.push(
      "ai-agent contract: audit logging has no secret-redaction evidence",
    );
  }

  for (const state of [
    "approval",
    "running",
    "succeeded",
    "failed",
    "refused",
  ]) {
    if (
      statusEntries.length > 0 &&
      !new RegExp(state, "i").test(statusSource)
    ) {
      problems.push(
        "ai-agent contract: user-visible status is missing " + state + " state",
      );
    }
  }

  if (
    statusEntries.length > 0 &&
    /(?:completed|succeeded|sent|deployed|updated)\s*[:=]\s*(?:true|["'](?:done|success|completed)["'])/i.test(
      statusSource,
    ) &&
    !/toolResult|tool_result|providerResult|provider_result|verified/i.test(
      statusSource,
    )
  ) {
    problems.push(
      "ai-agent contract: status can claim action success without verified tool/provider result",
    );
  }

  if (docsEntries.length > 0) {
    for (const term of [
      "provider",
      "routing",
      "permission",
      "memory",
      "context",
      "cost",
      "approval",
      "prompt injection",
      "refusal",
      "audit",
      "status",
    ]) {
      if (!new RegExp(term, "i").test(docsSource)) {
        problems.push(
          "ai-agent contract: documentation does not cover " + term,
        );
      }
    }
  }

  for (const [path, source] of entries) {
    if (
      isClientExposedPath(path, source, input.contract) &&
      SECRET_PATTERN.test(source)
    ) {
      problems.push(
        "ai-agent contract: client-exposed file references model/provider secret material: " +
          path,
      );
    }
  }

  if (
    /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY|DEEPSEEK_API_KEY|API_SECRET|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN)\s*=\s*["'`][^"'`\r\n]{8,}["'`]/i.test(
      allSource,
    )
  ) {
    problems.push(
      "ai-agent contract: hard-coded model/provider credential detected",
    );
  }

  return [...new Set(problems)];
}

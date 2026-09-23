import { z } from "zod";
import {
  assertStackSupportsProduct,
  normalizeStackId,
} from "./stackAdapters.js";

export type ProductType =
  | "website"
  | "saas_application"
  | "mobile_app"
  | "desktop_app"
  | "game"
  | "ai_agent"
  | "developer_tool"
  | "api"
  | "ecommerce_product"
  | "browser_extension"
  | "automation_tool"
  | "data_product";

export type SecondaryCapability =
  | "authentication"
  | "database"
  | "billing"
  | "ai"
  | "analytics"
  | "administration"
  | "teams"
  | "notifications"
  | "search"
  | "file_uploads"
  | "external_integrations"
  | "deployment";

export type ProductFamily =
  | "frontend"
  | "backend"
  | "database"
  | "ai"
  | "interactive"
  | "mobile"
  | "desktop"
  | "billing"
  | "auth"
  | "analytics"
  | "integrations"
  | "deployment";

export type ProductRequirement = {
  id: string;
  text: string;
  category: "workflow" | "quality" | "security" | "monetization" | "operations";
  priority: "must" | "should" | "could";
};

export type ProductIntentAlternative = {
  productType: ProductType;
  confidence: number;
};

export type PromptIntent = {
  originalPrompt: string;
  primaryProductType: ProductType | null;
  secondaryCapabilities: SecondaryCapability[];
  confidence: number;
  alternatives: ProductIntentAlternative[];
  ambiguous: boolean;
  clarificationQuestions: string[];
  canonicalInterpretation: string;
};

export const productContractSchema = z.object({
  version: z.literal(2),
  originalPrompt: z.string().min(1),
  productType: z.enum([
    "website","saas_application","mobile_app","desktop_app","game","ai_agent",
    "developer_tool","api","ecommerce_product","browser_extension","automation_tool","data_product",
  ]),
  productFamilies: z.array(z.enum([
    "frontend","backend","database","ai","interactive","mobile","desktop",
    "billing","auth","analytics","integrations","deployment",
  ])).min(1),
  targetUsers: z.array(z.string().min(1)).min(1),
  userRoles: z.array(z.string().min(1)).min(1),
  coreWorkflows: z.array(z.string().min(1)).min(1),
  functionalRequirements: z.array(z.object({
    id: z.string().regex(/^REQ-\d{3}$/),
    text: z.string().min(1),
    category: z.enum(["workflow","quality","security","monetization","operations"]),
    priority: z.enum(["must","should","could"]),
  })).min(1),
  nonFunctionalRequirements: z.array(z.string().min(1)).min(1),
  dataModels: z.array(z.string().min(1)),
  integrations: z.array(z.string().min(1)),
  securityRequirements: z.array(z.string().min(1)).min(1),
  deploymentRequirements: z.array(z.string().min(1)).min(1),
  monetizationRequirements: z.array(z.string().min(1)),
  selectedTechnologyStack: z.string().min(1),
  researchRequirements: z.array(z.string().min(1)),
  runtimeRequirements: z.array(z.string().min(1)).min(1),
  secondaryCapabilities: z.array(z.enum([
    "authentication","database","billing","ai","analytics","administration",
    "teams","notifications","search","file_uploads","external_integrations","deployment",
  ])),
  intentConfidence: z.number().min(0).max(1),
  canonicalInterpretation: z.string().min(1),
});

export type ProductContract = z.infer<typeof productContractSchema>;

type IntentSignal = {
  pattern: RegExp;
  weight: number;
};

type ProductIntentDefinition = {
  type: ProductType;
  label: string;
  signals: IntentSignal[];
};

const PRODUCT_INTENTS: ProductIntentDefinition[] = [
  {
    type: "website",
    label: "Website",
    signals: [
      {
        pattern: /\b(marketing|business|company|personal)\s+(website|site)\b/i,
        weight: 9,
      },
      {
        pattern:
          /\b(website|landing page|marketing site|portfolio site|blog site|homepage)\b/i,
        weight: 8,
      },
      { pattern: /\b(static site|web page|brochure site)\b/i, weight: 6 },
    ],
  },
  {
    type: "saas_application",
    label: "SaaS application",
    signals: [
      { pattern: /\bsaas\b|software as a service/i, weight: 10 },
      {
        pattern:
          /\b(multi[- ]tenant|tenant workspace|team workspace|subscription software)\b/i,
        weight: 8,
      },
      { pattern: /\bweb app(?:lication)?\b/i, weight: 5 },
    ],
  },
  {
    type: "mobile_app",
    label: "Mobile app",
    signals: [
      {
        pattern: /\b(mobile app|ios app|android app|iphone app|ipad app)\b/i,
        weight: 10,
      },
      { pattern: /\b(react native|expo|flutter)\b/i, weight: 8 },
      { pattern: /\b(app store|google play|play store)\b/i, weight: 6 },
    ],
  },
  {
    type: "desktop_app",
    label: "Desktop app",
    signals: [
      {
        pattern:
          /\b(desktop app|desktop application|windows app|mac app|macos app|linux app)\b/i,
        weight: 10,
      },
      { pattern: /\b(electron|tauri)\b/i, weight: 8 },
    ],
  },
  {
    type: "game",
    label: "Game",
    signals: [
      {
        pattern:
          /\b(video game|mobile game|browser game|web game|multiplayer game|single player game)\b/i,
        weight: 10,
      },
      {
        pattern:
          /\b(game|arcade|platformer|rpg|shooter|puzzle game|racing game|strategy game)\b/i,
        weight: 8,
      },
      { pattern: /\b(phaser|unity|godot|unreal)\b/i, weight: 7 },
    ],
  },
  {
    type: "ai_agent",
    label: "AI agent",
    signals: [
      {
        pattern:
          /\b(ai agent|autonomous agent|agentic system|multi[- ]agent|copilot)\b/i,
        weight: 10,
      },
      {
        pattern: /\b(ai assistant|llm assistant|chatbot|chat bot)\b/i,
        weight: 8,
      },
      {
        pattern: /\b(tool[- ]using agent|model routing|agent orchestration)\b/i,
        weight: 7,
      },
    ],
  },
  {
    type: "developer_tool",
    label: "Developer tool",
    signals: [
      {
        pattern:
          /\b(developer tool|dev tool|developer platform|developer utility)\b/i,
        weight: 10,
      },
      {
        pattern:
          /\b(cli|command line tool|sdk|code generator|compiler plugin|linter|formatter)\b/i,
        weight: 8,
      },
      {
        pattern: /\b(vscode extension|visual studio code extension)\b/i,
        weight: 7,
      },
    ],
  },
  {
    type: "api",
    label: "API",
    signals: [
      {
        pattern:
          /\b(rest api|graphql api|public api|private api|backend api|api service)\b/i,
        weight: 10,
      },
      {
        pattern: /\b(api|microservice|backend service|webhook service)\b/i,
        weight: 7,
      },
      { pattern: /\b(rest endpoints?|graphql schema|openapi)\b/i, weight: 6 },
    ],
  },
  {
    type: "ecommerce_product",
    label: "E-commerce product",
    signals: [
      {
        pattern:
          /\b(e[- ]?commerce|online store|online shop|storefront|shopping site)\b/i,
        weight: 10,
      },
      {
        pattern:
          /\b(cart|checkout|product catalog|inventory store|marketplace)\b/i,
        weight: 7,
      },
      { pattern: /\b(shopify alternative|sell products online)\b/i, weight: 7 },
    ],
  },
  {
    type: "browser_extension",
    label: "Browser extension",
    signals: [
      {
        pattern:
          /\b(browser extension|chrome extension|firefox extension|edge extension|safari extension)\b/i,
        weight: 10,
      },
      {
        pattern: /\b(content script|browser action|manifest v3|mv3)\b/i,
        weight: 8,
      },
    ],
  },
  {
    type: "automation_tool",
    label: "Automation tool",
    signals: [
      {
        pattern:
          /\b(automation tool|workflow automation|business automation|process automation)\b/i,
        weight: 10,
      },
      {
        pattern:
          /\b(automate|scheduled workflow|scheduled job|cron workflow|browser automation)\b/i,
        weight: 7,
      },
      { pattern: /\b(zapier|make\.com|n8n)\b/i, weight: 6 },
    ],
  },
  {
    type: "data_product",
    label: "Data product",
    signals: [
      {
        pattern:
          /\b(data product|analytics product|business intelligence|bi product|data platform)\b/i,
        weight: 10,
      },
      {
        pattern:
          /\b(data dashboard|analytics dashboard|reporting dashboard|data visualization)\b/i,
        weight: 8,
      },
      {
        pattern: /\b(kpi dashboard|metrics platform|reporting tool)\b/i,
        weight: 7,
      },
    ],
  },
];

const PRODUCT_LABELS: Record<ProductType, string> = Object.fromEntries(
  PRODUCT_INTENTS.map((definition) => [definition.type, definition.label]),
) as Record<ProductType, string>;

const CAPABILITY_SIGNALS: Array<{
  capability: SecondaryCapability;
  patterns: RegExp[];
}> = [
  {
    capability: "authentication",
    patterns: [
      /\b(auth|authentication|login|log in|sign in|sign up|signup|password|oauth|sso)\b/i,
    ],
  },
  {
    capability: "database",
    patterns: [
      /\b(database|postgres|postgresql|mysql|sqlite|mongodb|supabase|persist|persistence|store data)\b/i,
    ],
  },
  {
    capability: "billing",
    patterns: [
      /\b(billing|subscription|subscriptions|payment|payments|checkout|stripe|paid plan|pricing|monetiz(?:e|ed|ation)|revenue)\b/i,
    ],
  },
  {
    capability: "ai",
    patterns: [
      /\b(ai|artificial intelligence|llm|model|chatbot|agent|copilot|openai|anthropic|gemini)\b/i,
    ],
  },
  {
    capability: "analytics",
    patterns: [
      /\b(analytics|metrics|kpi|reporting|reports|tracking|telemetry|dashboard)\b/i,
    ],
  },
  {
    capability: "administration",
    patterns: [
      /\b(admin|administrator|administration|back office|control panel|moderation console)\b/i,
    ],
  },
  {
    capability: "teams",
    patterns: [
      /\b(team|teams|organization|organisation|workspace|members|collaboration|multi[- ]tenant)\b/i,
    ],
  },
  {
    capability: "notifications",
    patterns: [
      /\b(notification|notifications|email alert|push notification|sms alert|reminder)\b/i,
    ],
  },
  {
    capability: "search",
    patterns: [
      /\b(search|full[- ]text search|semantic search|filter and search|find records)\b/i,
    ],
  },
  {
    capability: "file_uploads",
    patterns: [
      /\b(file upload|file uploads|upload files|document upload|image upload|media upload|attachments?)\b/i,
    ],
  },
  {
    capability: "external_integrations",
    patterns: [
      /\b(integrat(?:e|es|ion|ions)|webhook|stripe|github|slack|twilio|google|shopify|salesforce|xero|api client)\b/i,
    ],
  },
  {
    capability: "deployment",
    patterns: [
      /\b(deploy|deployment|hosting|hosted|production|vercel|fly\.io|netlify|aws|cloudflare)\b/i,
    ],
  },
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function scoreProductTypes(
  prompt: string,
): Array<{ type: ProductType; score: number }> {
  return PRODUCT_INTENTS.map(({ type, signals }) => ({
    type,
    score: signals.reduce(
      (total, signal) =>
        total + (signal.pattern.test(prompt) ? signal.weight : 0),
      0,
    ),
  })).sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
}

export function detectSecondaryCapabilities(
  prompt: string,
): SecondaryCapability[] {
  return CAPABILITY_SIGNALS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(prompt)),
  ).map(({ capability }) => capability);
}

function buildClarificationQuestions(
  primary: ProductType | null,
  secondary: ProductType | null,
  noEvidence: boolean,
): string[] {
  if (noEvidence || !primary) {
    return [
      "What kind of product should AppForge build: a website, SaaS application, mobile app, desktop app, game, AI agent, developer tool, API, e-commerce product, browser extension, automation tool, or data product?",
    ];
  }
  if (secondary) {
    return [
      `Should this primarily be a ${PRODUCT_LABELS[primary]} or a ${PRODUCT_LABELS[secondary]}?`,
    ];
  }
  return [
    `Please confirm that the primary product is a ${PRODUCT_LABELS[primary]}.`,
  ];
}

export function classifyProductIntent(prompt: string): PromptIntent {
  const originalPrompt = prompt;
  const normalized = prompt.trim();
  const ranked = scoreProductTypes(normalized);
  const top = ranked[0];
  const second = ranked[1];
  const noEvidence = !top || top.score === 0;
  const gap = (top?.score ?? 0) - (second?.score ?? 0);
  const weakEvidence = (top?.score ?? 0) < 6;
  const closeCompetition = (second?.score ?? 0) >= 6 && gap <= 2;
  const ambiguous = noEvidence || weakEvidence || closeCompetition;
  const primaryProductType = noEvidence ? null : top.type;
  const baseConfidence = noEvidence
    ? 0.15
    : 0.52 +
      Math.min(0.28, top.score * 0.02) +
      Math.min(0.18, Math.max(0, gap) * 0.025);
  const confidence = Number(clamp(baseConfidence, 0.05, 0.99).toFixed(2));
  const secondaryCapabilities = detectSecondaryCapabilities(normalized);
  const alternatives = ranked
    .filter((entry) => entry.score > 0 && entry.type !== primaryProductType)
    .slice(0, 3)
    .map((entry) => ({
      productType: entry.type,
      confidence: Number(
        clamp(
          confidence * (entry.score / Math.max(top?.score ?? 1, 1)),
          0.05,
          0.95,
        ).toFixed(2),
      ),
    }));
  const clarificationQuestions = ambiguous
    ? buildClarificationQuestions(
        primaryProductType,
        closeCompetition ? (second?.type ?? null) : null,
        noEvidence,
      )
    : [];
  const primaryLabel = primaryProductType
    ? PRODUCT_LABELS[primaryProductType]
    : "unresolved";
  const capabilityText =
    secondaryCapabilities.length > 0
      ? secondaryCapabilities.join(", ")
      : "none explicitly requested";
  const canonicalInterpretation =
    `Primary product type: ${primaryLabel}. Secondary capabilities: ${capabilityText}. ` +
    `Intent confidence: ${confidence.toFixed(2)}. ` +
    (ambiguous
      ? `Clarification required before build: ${clarificationQuestions.join(" ")}`
      : "This interpretation is canonical for downstream agents; do not independently change the primary product type or requested capabilities.");

  return {
    originalPrompt,
    primaryProductType,
    secondaryCapabilities,
    confidence,
    alternatives,
    ambiguous,
    clarificationQuestions,
    canonicalInterpretation,
  };
}

export function classifyProductType(prompt: string): ProductType {
  const intent = classifyProductIntent(prompt);
  if (!intent.primaryProductType || intent.ambiguous) {
    throw new Error(
      `Ambiguous product intent: ${intent.clarificationQuestions[0] ?? "clarification required"}`,
    );
  }
  return intent.primaryProductType;
}

export function inferProductFamilies(
  prompt: string,
  productType = classifyProductType(prompt),
): ProductFamily[] {
  const capabilities = detectSecondaryCapabilities(prompt);
  const families = new Set<ProductFamily>(["deployment"]);

  if (
    [
      "website",
      "saas_application",
      "mobile_app",
      "desktop_app",
      "game",
      "ecommerce_product",
      "browser_extension",
      "data_product",
    ].includes(productType)
  ) {
    families.add("frontend");
  }
  if (
    [
      "saas_application",
      "ai_agent",
      "api",
      "ecommerce_product",
      "automation_tool",
      "data_product",
    ].includes(productType)
  ) {
    families.add("backend");
  }
  if (productType === "mobile_app") families.add("mobile");
  if (productType === "desktop_app") families.add("desktop");
  if (productType === "game") families.add("interactive");
  if (productType === "ai_agent" || capabilities.includes("ai"))
    families.add("ai");
  if (capabilities.includes("database")) families.add("database");
  if (capabilities.includes("billing")) families.add("billing");
  if (capabilities.includes("authentication")) families.add("auth");
  if (capabilities.includes("analytics")) families.add("analytics");
  if (capabilities.includes("external_integrations"))
    families.add("integrations");

  return [...families];
}

export function selectProductStack(
  prompt: string,
  productType = classifyProductType(prompt),
): string {
  const text = prompt.toLowerCase();

  if (productType === "website") {
    if (/\b(static website|static site|vanilla html|html css javascript)\b/.test(text))
      return "static-html";
    if (/\b(next\.js|nextjs|next js)\b/.test(text)) return "next-node";
    if (/\b(three\.js|threejs|webgl|3d website)\b/.test(text))
      return "three-js-3d";
    return "react-node";
  }

  if (productType === "saas_application" || productType === "ecommerce_product") {
    if (/\b(next\.js|nextjs|next js)\b/.test(text)) return "next-node";
    return "react-node";
  }

  if (productType === "game")
    return /\b(3d|three\.js|threejs|webgl)\b/.test(text)
      ? "three-js-3d"
      : "phaser-html5";

  if (productType === "ai_agent")
    return /\b(python|fastapi)\b/.test(text)
      ? "ai-agent-python"
      : "ai-agent-node";

  if (productType === "automation_tool")
    return /\b(python|fastapi)\b/.test(text)
      ? "python-service"
      : /\b(browser automation|playwright|puppeteer)\b/.test(text)
        ? "browser-automation"
        : "node-service";

  if (productType === "api")
    return /\b(python|fastapi)\b/.test(text)
      ? "python-service"
      : "api-service";

  if (productType === "browser_extension") return "chrome-extension";

  if (productType === "mobile_app")
    return /\bflutter\b/.test(text) ? "flutter-firebase" : "react-native-expo";

  if (productType === "desktop_app")
    return /\btauri\b/.test(text) ? "tauri-rust" : "electron-react";

  if (productType === "data_product")
    return /\bpython|fastapi\b/.test(text)
      ? "python-service"
      : "data-visualization";

  if (productType === "developer_tool") {
    if (/\bpython\b/.test(text)) return "python-service";
    if (/\b(api|backend|service)\b/.test(text)) return "node-service";
    return "react-node";
  }

  throw new Error(`No stack adapter is configured for product type ${productType}`);
}

export function renderCanonicalPromptContext(
  originalPrompt: string,
  intent: PromptIntent,
): string {
  return [
    originalPrompt,
    "",
    "[APPFORGE CANONICAL PROMPT INTERPRETATION — DO NOT REINTERPRET]",
    intent.canonicalInterpretation,
    `Primary product type id: ${intent.primaryProductType ?? "unresolved"}`,
    `Secondary capability ids: ${intent.secondaryCapabilities.join(", ") || "none"}`,
    "[END APPFORGE CANONICAL PROMPT INTERPRETATION]",
  ].join("\n");
}


function defaultTargetUsers(type: ProductType): string[] {
  const map: Record<ProductType, string[]> = {
    website: ["Public visitors", "Content owner"],
    saas_application: ["End users", "Organization administrators"],
    mobile_app: ["Mobile users", "Application administrators"],
    desktop_app: ["Desktop users", "Application administrators"],
    game: ["Players", "Game administrators"],
    ai_agent: ["Agent users", "Agent administrators"],
    developer_tool: ["Software developers", "Tool maintainers"],
    api: ["API consumers", "API administrators"],
    ecommerce_product: ["Shoppers", "Store administrators"],
    browser_extension: ["Browser users", "Extension administrators"],
    automation_tool: ["Automation operators", "Workspace administrators"],
    data_product: ["Data consumers", "Data administrators"],
  };
  return map[type];
}

function defaultRoles(type: ProductType, capabilities: SecondaryCapability[]): string[] {
  const roles = new Set<string>(["user"]);
  if (capabilities.includes("administration") || type !== "website") roles.add("admin");
  if (capabilities.includes("teams")) roles.add("team_member");
  if (type === "ecommerce_product") roles.add("customer");
  if (type === "api") roles.add("api_client");
  return [...roles];
}

function coreWorkflows(type: ProductType, capabilities: SecondaryCapability[]): string[] {
  const workflows = ["Complete the primary " + PRODUCT_LABELS[type] + " workflow described in the original prompt"];
  if (capabilities.includes("authentication")) workflows.push("Create account, authenticate, refresh session, and sign out");
  if (capabilities.includes("billing")) workflows.push("Select an offer, pay server-side, receive entitlement, and manage billing state");
  if (capabilities.includes("file_uploads")) workflows.push("Upload, validate, persist, retrieve, and delete permitted files");
  if (capabilities.includes("search")) workflows.push("Search domain data and display empty/error/result states");
  if (capabilities.includes("external_integrations")) workflows.push("Configure and execute requested external integrations with observable failure handling");
  return workflows;
}

function dataModelsFor(type: ProductType, capabilities: SecondaryCapability[]): string[] {
  const models = new Set<string>();
  if (capabilities.includes("authentication")) models.add("User");
  if (capabilities.includes("teams")) { models.add("Organization"); models.add("Membership"); }
  if (capabilities.includes("billing")) { models.add("Subscription"); models.add("Entitlement"); models.add("BillingEvent"); }
  if (capabilities.includes("file_uploads")) models.add("FileAsset");
  if (type === "ecommerce_product") { models.add("Product"); models.add("Cart"); models.add("Order"); }
  if (type === "data_product") models.add("Dataset");
  if (type === "ai_agent") { models.add("AgentRun"); models.add("AgentAuditEvent"); }
  return [...models];
}

function detectIntegrationNames(prompt: string): string[] {
  const candidates = ["Stripe","GitHub","Slack","Twilio","Google","Shopify","Salesforce","Xero","Supabase","OpenAI","Anthropic","Gemini"];
  return candidates.filter((name) => new RegExp("\\b" + name + "\\b", "i").test(prompt));
}

export function validateProductContract(input: unknown): ProductContract {
  return productContractSchema.parse(input);
}

export function withSelectedTechnologyStack(
  contract: ProductContract,
  selectedTechnologyStack: string,
): ProductContract {
  const normalized = normalizeStackId(selectedTechnologyStack);
  assertStackSupportsProduct(normalized, contract.productType);
  return validateProductContract({
    ...contract,
    selectedTechnologyStack: normalized,
  });
}

export function renderProductContractForAgents(contract: ProductContract): string {
  const validated = validateProductContract(contract);
  return [
    "[APPFORGE CANONICAL PRODUCT CONTRACT — AUTHORITATIVE]",
    JSON.stringify(validated, null, 2),
    "[END APPFORGE CANONICAL PRODUCT CONTRACT]",
    "All stages must consume this contract as the single product specification. Do not independently reinterpret the original prompt or silently drop requirements.",
  ].join("\n");
}

export function buildProductContract(prompt: string): ProductContract {
  const intent = classifyProductIntent(prompt);
  if (!intent.primaryProductType || intent.ambiguous) {
    throw new Error("Ambiguous product intent: " + (intent.clarificationQuestions[0] ?? "clarification required"));
  }
  const productType = intent.primaryProductType;
  const capabilities = intent.secondaryCapabilities;
  const selectedTechnologyStack = selectProductStack(prompt, productType);
  const monetized = capabilities.includes("billing");
  return validateProductContract({
    version: 2,
    originalPrompt: prompt,
    productType,
    productFamilies: inferProductFamilies(prompt, productType),
    targetUsers: defaultTargetUsers(productType),
    userRoles: defaultRoles(productType, capabilities),
    coreWorkflows: coreWorkflows(productType, capabilities),
    functionalRequirements: [
      { id: "REQ-001", text: "Implement the complete primary workflow in the original prompt.", category: "workflow", priority: "must" },
      { id: "REQ-002", text: "Provide functional loading, empty, success, and error states.", category: "quality", priority: "must" },
      { id: "REQ-003", text: "Enforce security boundaries and keep credentials server-side.", category: "security", priority: "must" },
      { id: "REQ-004", text: monetized ? "Implement requested monetization with server-authoritative entitlements." : "Do not invent monetization when it was not requested.", category: "monetization", priority: monetized ? "must" : "should" },
      { id: "REQ-005", text: "Build, start, health-check, and verify the selected runtime before completion.", category: "operations", priority: "must" },
    ],
    nonFunctionalRequirements: [
      "Production-safe error handling and observability",
      "Responsive, accessible user experience where a UI exists",
      "Deterministic build and startup commands",
      "No placeholder-only implementation may be treated as complete",
    ],
    dataModels: dataModelsFor(productType, capabilities),
    integrations: detectIntegrationNames(prompt),
    securityRequirements: [
      "No secrets in browser bundles, generated artifacts, or logs",
      "Authorization is enforced server-side for privileged actions",
      "Validate untrusted input at trust boundaries",
      "Generated product data is isolated from AppForge production data",
    ],
    deploymentRequirements: [
      "Deploy using a runtime compatible with " + selectedTechnologyStack,
      "Require environment configuration before production activation",
      "Require health verification and artifact identity before production certification",
    ],
    monetizationRequirements: monetized
      ? ["Billing state is server-authoritative","Webhook events are signature-validated and idempotent","Paid functionality is protected by entitlements"]
      : [],
    selectedTechnologyStack,
    researchRequirements: [
      "Verify current official documentation and supported versions for " + selectedTechnologyStack,
      "Verify current deployment constraints for " + PRODUCT_LABELS[productType],
    ],
    runtimeRequirements: [
      "Use the " + selectedTechnologyStack + " runtime and its native entrypoint",
      "Expose a health-verifiable startup path",
      "Use environment variables for external services and secrets",
      "Fail closed when required runtime configuration is missing",
    ],
    secondaryCapabilities: capabilities,
    intentConfidence: intent.confidence,
    canonicalInterpretation: intent.canonicalInterpretation,
  });
}

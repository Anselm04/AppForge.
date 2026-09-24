import { z } from "zod";
import {
  assertStackSupportsProduct,
  normalizeStackId,
} from "./stackAdapters.js";
import {
  buildPromptMonetization,
  buildPromptNonFunctional,
  buildPromptRequirements,
  buildPromptSecurity,
  buildPromptTargetUsers,
  buildPromptWorkflows,
  extractPromptFacts,
} from "./promptContractExtraction.js";

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

export const PRODUCT_TYPES = [
  "website",
  "saas_application",
  "mobile_app",
  "desktop_app",
  "game",
  "ai_agent",
  "developer_tool",
  "api",
  "ecommerce_product",
  "browser_extension",
  "automation_tool",
  "data_product",
] as const satisfies readonly ProductType[];

export const productContractSchema = z.object({
  version: z.literal(2),
  originalPrompt: z.string().min(1),
  productType: z.enum(PRODUCT_TYPES),
  productFamilies: z
    .array(
      z.enum([
        "frontend",
        "backend",
        "database",
        "ai",
        "interactive",
        "mobile",
        "desktop",
        "billing",
        "auth",
        "analytics",
        "integrations",
        "deployment",
      ]),
    )
    .min(1),
  targetUsers: z.array(z.string().min(1)).min(1),
  userRoles: z.array(z.string().min(1)).min(1),
  coreWorkflows: z.array(z.string().min(1)).min(1),
  functionalRequirements: z
    .array(
      z.object({
        id: z.string().regex(/^REQ-\d{3}$/),
        text: z.string().min(1),
        category: z.enum([
          "workflow",
          "quality",
          "security",
          "monetization",
          "operations",
        ]),
        priority: z.enum(["must", "should", "could"]),
      }),
    )
    .min(1),
  nonFunctionalRequirements: z.array(z.string().min(1)).min(1),
  dataModels: z.array(z.string().min(1)),
  integrations: z.array(z.string().min(1)),
  securityRequirements: z.array(z.string().min(1)).min(1),
  deploymentRequirements: z.array(z.string().min(1)).min(1),
  monetizationRequirements: z.array(z.string().min(1)),
  selectedTechnologyStack: z.string().min(1),
  researchRequirements: z.array(z.string().min(1)),
  runtimeRequirements: z.array(z.string().min(1)).min(1),
  secondaryCapabilities: z.array(
    z.enum([
      "authentication",
      "database",
      "billing",
      "ai",
      "analytics",
      "administration",
      "teams",
      "notifications",
      "search",
      "file_uploads",
      "external_integrations",
      "deployment",
    ]),
  ),
  intentConfidence: z.number().min(0).max(1),
  canonicalInterpretation: z.string().min(1),
  /**
   * How the contract content was produced. Every contract starts from the
   * deterministic prompt-specific extraction; LLM enrichment may only add
   * schema-valid items on top of it.
   */
  contractDerivation: z
    .enum(["prompt_deterministic", "prompt_deterministic_llm_enriched"])
    .optional(),
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
      { pattern: /\b(site|webpage|one[- ]pager)\b/i, weight: 5 },
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
      {
        // Common business/productivity application nouns. These are
        // interactive multi-user web applications, not marketing websites.
        pattern:
          /\b(crm|erp|helpdesk|help desk|ticketing system|project management (?:app|tool|software)|task manager|to-?do (?:app|list app)|booking (?:app|system|platform)|scheduling (?:app|system|platform)|appointment booking|inventory management|invoicing (?:app|tool|software)|client portal|customer portal|member portal|internal tool|applicant tracking|habit tracker|expense tracker|note[- ]taking app|learning management system|lms)\b/i,
        weight: 7,
      },
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
      {
        // Device platforms named without the word "app" next to them, e.g.
        // "iPhone habit tracker app" or "Android app for field workers".
        pattern: /\b(iphone|ipad|ios|android)\b/i,
        weight: 9,
      },
      { pattern: /\bmobile\b/i, weight: 6 },
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
      {
        pattern:
          /\b(discord|telegram|slack|whatsapp|twitter|x)\s+bot\b|\bbot that (?:posts|sends|replies|monitors|alerts|reminds)\b/i,
        weight: 8,
      },
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
      {
        pattern:
          /\b(dashboard|visuali[sz]es?|charts?|graphs?)\b[^.]{0,80}\b(data|csv|spreadsheet|metrics|sales|dataset|analytics)\b|\b(csv|spreadsheet|dataset)\b[^.]{0,80}\b(dashboard|visuali[sz]es?|charts?|graphs?)\b/i,
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

/**
 * Tie-break order when two product types score exactly the same. More specific
 * delivery targets (an extension, a mobile app, a game) win over generic web
 * application types, because a generic noun rarely overrides a named platform.
 */
const SPECIFICITY_ORDER: ProductType[] = [
  "browser_extension",
  "mobile_app",
  "desktop_app",
  "game",
  "ai_agent",
  "api",
  "ecommerce_product",
  "automation_tool",
  "data_product",
  "developer_tool",
  "saas_application",
  "website",
];

/**
 * Generic application nouns. They are only used when no product-type signal
 * matched at all, so "Build an app to manage my plumbing jobs" becomes a SaaS
 * application with low confidence instead of an error.
 */
const GENERIC_APPLICATION_PATTERN =
  /\b(apps?|applications?|platform|portal|tracker|manager|management|system|software|tool|dashboard|planner|organi[sz]er|scheduler|marketplace)\b/i;
const GENERIC_APPLICATION_SCORE = 4;

/** Below this the primary type is a best guess and is reported as such. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

function scoreProductTypes(
  prompt: string,
): Array<{ type: ProductType; score: number }> {
  const scored = PRODUCT_INTENTS.map(({ type, signals }) => ({
    type,
    score: signals.reduce(
      (total, signal) =>
        total + (signal.pattern.test(prompt) ? signal.weight : 0),
      0,
    ),
  }));
  if (
    scored.every((entry) => entry.score === 0) &&
    GENERIC_APPLICATION_PATTERN.test(prompt)
  ) {
    const saas = scored.find((entry) => entry.type === "saas_application");
    if (saas) saas.score = GENERIC_APPLICATION_SCORE;
  }
  return scored.sort(
    (a, b) =>
      b.score - a.score ||
      SPECIFICITY_ORDER.indexOf(a.type) - SPECIFICITY_ORDER.indexOf(b.type),
  );
}

export function detectSecondaryCapabilities(
  prompt: string,
): SecondaryCapability[] {
  return CAPABILITY_SIGNALS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(prompt)),
  ).map(({ capability }) => capability);
}

const PRODUCT_CHOICE_DESCRIPTIONS: Record<ProductType, string> = {
  website: "Marketing site, landing page, portfolio or blog",
  saas_application: "Web app with accounts and data (CRM, booking, tasks)",
  mobile_app: "iPhone / Android app",
  desktop_app: "Installable Windows / macOS / Linux app",
  game: "Playable 2D or 3D game",
  ai_agent: "AI assistant or agent that uses tools",
  developer_tool: "CLI, SDK or developer utility",
  api: "Backend HTTP API or service",
  ecommerce_product: "Online store with catalog, cart and checkout",
  browser_extension: "Chrome / Firefox / Edge extension",
  automation_tool: "Bot, scheduled job or workflow automation",
  data_product: "Dashboard or data visualization",
};

export type ClarificationChoice = {
  value: ProductType;
  label: string;
  description: string;
};

export type ClarificationQuestion = {
  id: "primary_product_type";
  question: string;
  choices: ClarificationChoice[];
};

/**
 * Structured clarification the UI can render as a question with one-click
 * choices. Answering sends the chosen value back as `productType`.
 */
export type ClarificationRequest = {
  reason: "clarification_required";
  message: string;
  confidence: number;
  bestGuess: ProductType | null;
  questions: ClarificationQuestion[];
};

function productChoice(type: ProductType): ClarificationChoice {
  return {
    value: type,
    label: PRODUCT_LABELS[type],
    description: PRODUCT_CHOICE_DESCRIPTIONS[type],
  };
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

export function buildClarificationRequest(
  intent: PromptIntent,
): ClarificationRequest {
  const tied = [
    intent.primaryProductType,
    ...intent.alternatives.map((alternative) => alternative.productType),
  ].filter((type): type is ProductType => type !== null);
  const ordered = [
    ...new Set<ProductType>([...tied, ...SPECIFICITY_ORDER.slice().reverse()]),
  ];
  const question =
    intent.clarificationQuestions[0] ??
    "What kind of product should AppForge build?";
  return {
    reason: "clarification_required",
    message:
      "AppForge needs one answer before it can plan this build: " + question,
    confidence: intent.confidence,
    bestGuess: intent.primaryProductType,
    questions: [
      {
        id: "primary_product_type",
        question,
        choices: ordered.map(productChoice),
      },
    ],
  };
}

export function isProductType(value: unknown): value is ProductType {
  return (
    typeof value === "string" &&
    (PRODUCT_TYPES as readonly string[]).includes(value)
  );
}

function renderInterpretation(
  primaryProductType: ProductType | null,
  secondaryCapabilities: SecondaryCapability[],
  confidence: number,
  ambiguous: boolean,
  clarificationQuestions: string[],
  basis: string,
): string {
  const primaryLabel = primaryProductType
    ? PRODUCT_LABELS[primaryProductType]
    : "unresolved";
  const capabilityText =
    secondaryCapabilities.length > 0
      ? secondaryCapabilities.join(", ")
      : "none explicitly requested";
  return (
    `Primary product type: ${primaryLabel}. Secondary capabilities: ${capabilityText}. ` +
    `Intent confidence: ${confidence.toFixed(2)}${basis}. ` +
    (ambiguous
      ? `Clarification required before build: ${clarificationQuestions.join(" ")}`
      : "This interpretation is canonical for downstream agents; do not independently change the primary product type or requested capabilities.")
  );
}

export function classifyProductIntent(prompt: string): PromptIntent {
  const originalPrompt = prompt;
  const normalized = prompt.trim();
  const ranked = scoreProductTypes(normalized);
  const top = ranked[0];
  const second = ranked[1];
  const noEvidence = !top || top.score === 0;
  const gap = (top?.score ?? 0) - (second?.score ?? 0);
  const genericGuess = !noEvidence && top.score === GENERIC_APPLICATION_SCORE;
  // Only genuinely unresolvable prompts ask a question: no product evidence at
  // all, or two different product types named with equally strong signals
  // ("a browser extension and a developer tool"). Weak or close evidence picks
  // the best-scoring type and reports a lower confidence plus alternatives.
  const exactTie = (second?.score ?? 0) >= 8 && gap === 0;
  const ambiguous = noEvidence || exactTie;
  const primaryProductType = noEvidence ? null : top.type;
  const baseConfidence = noEvidence
    ? 0.15
    : genericGuess
      ? 0.45
      : 0.52 +
        Math.min(0.28, top.score * 0.02) +
        Math.min(0.18, Math.max(0, gap) * 0.025) -
        (exactTie ? 0.1 : 0);
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
        exactTie ? (second?.type ?? null) : null,
        noEvidence,
      )
    : [];
  const basis = genericGuess
    ? " (default guess from generic application wording)"
    : confidence < LOW_CONFIDENCE_THRESHOLD && !ambiguous
      ? " (best match; alternatives recorded)"
      : "";
  const canonicalInterpretation = renderInterpretation(
    primaryProductType,
    secondaryCapabilities,
    confidence,
    ambiguous,
    clarificationQuestions,
    basis,
  );

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

/**
 * Apply a product type the user explicitly chose (for example by answering a
 * clarification question). The prompt text is unchanged; only the primary
 * type is fixed and recorded as user-confirmed.
 */
export function confirmProductIntent(
  prompt: string,
  productType: ProductType,
): PromptIntent {
  const classified = classifyProductIntent(prompt);
  const confidence = 1;
  return {
    ...classified,
    primaryProductType: productType,
    confidence,
    alternatives: classified.alternatives.filter(
      (alternative) => alternative.productType !== productType,
    ),
    ambiguous: false,
    clarificationQuestions: [],
    canonicalInterpretation: renderInterpretation(
      productType,
      classified.secondaryCapabilities,
      confidence,
      false,
      [],
      " (product type confirmed by the user)",
    ),
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
    if (
      /\b(static website|static site|vanilla html|html css javascript)\b/.test(
        text,
      )
    )
      return "static-html";
    if (/\b(next\.js|nextjs|next js)\b/.test(text)) return "next-node";
    if (/\b(three\.js|threejs|webgl|3d website)\b/.test(text))
      return "three-js-3d";
    return "react-node";
  }

  if (
    productType === "saas_application" ||
    productType === "ecommerce_product"
  ) {
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
    return /\b(python|fastapi)\b/.test(text) ? "python-service" : "api-service";

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
    if (/\b(api|backend|service|cli|command[- ]line|terminal)\b/.test(text))
      return "node-service";
    return "react-node";
  }

  throw new Error(
    `No stack adapter is configured for product type ${productType}`,
  );
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

function dataModelsFor(
  capabilities: SecondaryCapability[],
  promptEntities: string[],
  monetizationModel: string,
): string[] {
  const models = new Set<string>();
  if (capabilities.includes("authentication")) models.add("User");
  if (capabilities.includes("teams")) {
    models.add("Organization");
    models.add("Membership");
  }
  for (const entity of promptEntities) models.add(entity);
  if (capabilities.includes("billing")) {
    if (monetizationModel === "one_time_purchase") {
      models.add("Payment");
    } else if (monetizationModel === "in_app_purchase") {
      models.add("Purchase");
      models.add("Entitlement");
    } else {
      models.add("Subscription");
      models.add("Entitlement");
    }
    models.add("BillingEvent");
  }
  if (capabilities.includes("file_uploads")) models.add("FileAsset");
  return [...models];
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

export function renderProductContractForAgents(
  contract: ProductContract,
): string {
  const validated = validateProductContract(contract);
  return [
    "[APPFORGE CANONICAL PRODUCT CONTRACT — AUTHORITATIVE]",
    JSON.stringify(validated, null, 2),
    "[END APPFORGE CANONICAL PRODUCT CONTRACT]",
    "All stages must consume this contract as the single product specification. Do not independently reinterpret the original prompt or silently drop requirements.",
  ].join("\n");
}

export type BuildProductContractOptions = {
  /** Product type the user explicitly confirmed (clarification answer). */
  productType?: ProductType;
};

export function buildProductContract(
  prompt: string,
  options: BuildProductContractOptions = {},
): ProductContract {
  const intent = options.productType
    ? confirmProductIntent(prompt, options.productType)
    : classifyProductIntent(prompt);
  if (!intent.primaryProductType || intent.ambiguous) {
    throw new Error(
      "Ambiguous product intent: " +
        (intent.clarificationQuestions[0] ?? "clarification required"),
    );
  }
  const productType = intent.primaryProductType;
  const capabilities = intent.secondaryCapabilities;
  const selectedTechnologyStack = selectProductStack(prompt, productType);
  const typeLabel = PRODUCT_LABELS[productType];
  // Everything below is derived from this prompt's own words (subject,
  // audience, features, entities, integrations, schedule, monetization), so
  // two different prompts never share one generic requirement list.
  const facts = extractPromptFacts(prompt, productType, capabilities);
  const audienceText =
    facts.audience.length > 0 ? ` for ${facts.audience.join("; ")}` : "";
  return validateProductContract({
    version: 2,
    originalPrompt: prompt,
    productType,
    productFamilies: inferProductFamilies(prompt, productType),
    targetUsers: buildPromptTargetUsers(
      productType,
      facts,
      defaultTargetUsers(productType),
    ),
    userRoles: facts.roles,
    coreWorkflows: buildPromptWorkflows({
      type: productType,
      typeLabel,
      capabilities,
      facts,
    }),
    functionalRequirements: buildPromptRequirements({
      prompt,
      type: productType,
      typeLabel,
      capabilities,
      facts,
      stack: selectedTechnologyStack,
    }),
    nonFunctionalRequirements: buildPromptNonFunctional(productType, prompt),
    dataModels: dataModelsFor(
      capabilities,
      facts.entities,
      facts.monetization.model,
    ),
    integrations: facts.integrations,
    securityRequirements: buildPromptSecurity({
      prompt,
      type: productType,
      capabilities,
      facts,
    }),
    deploymentRequirements: [
      "Deploy using a runtime compatible with " + selectedTechnologyStack,
      "Require environment configuration before production activation",
      "Require health verification and artifact identity before production certification",
    ],
    monetizationRequirements: buildPromptMonetization(facts),
    selectedTechnologyStack,
    researchRequirements: [
      "Verify current official documentation and supported versions for " +
        selectedTechnologyStack,
      "Verify current deployment constraints for " + typeLabel,
      ...facts.integrations
        .slice(0, 4)
        .map(
          (integration) =>
            "Verify the current " + integration + " API and SDK documentation",
        ),
    ],
    runtimeRequirements: [
      "Use the " +
        selectedTechnologyStack +
        " runtime and its native entrypoint",
      "Expose a health-verifiable startup path",
      "Use environment variables for external services and secrets",
      "Fail closed when required runtime configuration is missing",
    ],
    secondaryCapabilities: capabilities,
    intentConfidence: intent.confidence,
    canonicalInterpretation:
      intent.canonicalInterpretation +
      ` Interpreted product: "${facts.subject}" (${typeLabel})${audienceText}.`,
    contractDerivation: "prompt_deterministic",
  });
}

export type IntakeResolution =
  | {
      ok: true;
      promptIntent: PromptIntent;
      productContract: ProductContract;
    }
  | {
      ok: false;
      reason: "clarification_required";
      message: string;
      promptIntent: PromptIntent;
      clarificationQuestions: string[];
      clarification: ClarificationRequest;
    }
  | {
      ok: false;
      reason: "unsupported_stack";
      message: string;
      promptIntent: PromptIntent;
      clarificationQuestions: string[];
      compatibleStack: string;
    };

export type IntakeOptions = {
  /** Product type the user explicitly chose, e.g. a clarification answer. */
  productType?: ProductType | null;
};

/**
 * Single intake path for every entrypoint (tRPC projects.create and the REST
 * generate route). The canonical contract selects the stack from the product
 * intent. An explicitly requested stack is preserved only when its adapter
 * supports the classified product type. An incompatible stack is rejected as a
 * user error; it is never silently replaced and never surfaces as a 500.
 */
export function resolveIntakeContract(
  description: string,
  requestedStack?: string | null,
  options: IntakeOptions = {},
): IntakeResolution {
  const promptIntent = options.productType
    ? confirmProductIntent(description, options.productType)
    : classifyProductIntent(description);
  if (promptIntent.ambiguous || !promptIntent.primaryProductType) {
    const clarification = buildClarificationRequest(promptIntent);
    return {
      ok: false,
      reason: "clarification_required",
      message: clarification.message,
      promptIntent,
      clarificationQuestions: promptIntent.clarificationQuestions,
      clarification,
    };
  }

  // Only a user-chosen type is passed through; an auto-classified prompt keeps
  // its classifier confidence and interpretation in the contract.
  const baseContract = buildProductContract(
    description,
    options.productType ? { productType: options.productType } : {},
  );
  const explicitStack = requestedStack?.trim();
  if (
    !explicitStack ||
    explicitStack.toLowerCase() === "auto" ||
    explicitStack.toLowerCase() === "default"
  ) {
    return { ok: true, promptIntent, productContract: baseContract };
  }

  try {
    return {
      ok: true,
      promptIntent,
      productContract: withSelectedTechnologyStack(baseContract, explicitStack),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: "unsupported_stack",
      message:
        `The requested stack "${explicitStack}" cannot build a ${PRODUCT_LABELS[baseContract.productType]}. ` +
        `Choose a compatible stack or leave it on automatic (AppForge would use ${baseContract.selectedTechnologyStack}). ` +
        detail,
      promptIntent,
      clarificationQuestions: [],
      compatibleStack: baseContract.selectedTechnologyStack,
    };
  }
}

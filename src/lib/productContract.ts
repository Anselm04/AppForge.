export type ProductType =
  | "website"
  | "saas"
  | "app"
  | "game"
  | "agent"
  | "tool"
  | "api"
  | "ecommerce"
  | "extension"
  | "automation"
  | "data";

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

export type ProductContract = {
  version: 1;
  originalPrompt: string;
  productType: ProductType;
  productFamilies: ProductFamily[];
  techStack: string;
  researchRequired: boolean;
  monetizationRequested: boolean;
  requirements: ProductRequirement[];
};

const TYPE_RULES: Array<{ type: ProductType; pattern: RegExp }> = [
  { type: "ecommerce", pattern: /\b(e[- ]?commerce|shop|store|cart|checkout|products?)\b/i },
  { type: "game", pattern: /\b(game|arcade|pac[- ]?man|maze|snake|pong|platformer|level|playable)\b/i },
  { type: "agent", pattern: /\b(ai agent|assistant|copilot|autonomous|agentic|llm|chatbot|chat bot)\b/i },
  { type: "extension", pattern: /\b(browser extension|chrome extension|firefox extension|vscode extension)\b/i },
  { type: "automation", pattern: /\b(automation|workflow|zap|bot|scraper|scheduled job)\b/i },
  { type: "api", pattern: /\b(api|backend service|microservice|webhook|rest service|graphql)\b/i },
  { type: "data", pattern: /\b(analytics|dashboard|reporting|data visualization|metrics|charts?)\b/i },
  { type: "saas", pattern: /\b(saas|subscription|team workspace|admin portal|multi[- ]tenant)\b/i },
  { type: "app", pattern: /\b(app|mobile|ios|android|desktop|application)\b/i },
  { type: "website", pattern: /\b(website|landing page|marketing site|portfolio|blog)\b/i },
];

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export function classifyProductType(prompt: string): ProductType {
  const text = prompt.trim();
  return TYPE_RULES.find(({ pattern }) => pattern.test(text))?.type ?? "app";
}

export function inferProductFamilies(prompt: string, productType = classifyProductType(prompt)): ProductFamily[] {
  const text = prompt.toLowerCase();
  const families = new Set<ProductFamily>(["frontend", "deployment"]);

  if (["api", "saas", "ecommerce", "agent", "automation", "data"].includes(productType)) families.add("backend");
  if (/\b(database|persist|save|users?|accounts?|orders?|tasks?|data)\b/.test(text)) families.add("database");
  if (productType === "agent" || /\b(ai|llm|model|assistant|chatbot)\b/.test(text)) families.add("ai");
  if (productType === "game" || /\b(interactive|canvas|animation|real[- ]?time)\b/.test(text)) families.add("interactive");
  if (productType === "app" && /\b(mobile|ios|android|expo|flutter)\b/.test(text)) families.add("mobile");
  if (/\b(desktop|electron|tauri)\b/.test(text)) families.add("desktop");
  if (/\b(login|sign[ -]?up|auth|account|role|permission|team)\b/.test(text)) families.add("auth");
  if (/\b(subscription|billing|checkout|payment|monetiz|paid|pricing|shop|store)\b/.test(text)) families.add("billing");
  if (/\b(analytics|tracking|metrics|reports?)\b/.test(text)) families.add("analytics");
  if (/\b(integrat|stripe|github|slack|twilio|supabase|google)\b/.test(text)) families.add("integrations");

  return [...families];
}

export function selectProductStack(prompt: string, productType = classifyProductType(prompt)): string {
  const text = prompt.toLowerCase();
  if (productType === "game") return /\b(3d|three\.js|threejs|webgl)\b/.test(text) ? "three-js-3d" : "phaser-html5";
  if (productType === "agent" || productType === "automation") return "ai-agent-node";
  if (productType === "api") return "api-service";
  if (productType === "extension") return "chrome-extension";
  if (productType === "app" && /\b(mobile|ios|android|expo)\b/.test(text)) return "react-native-expo";
  if (productType === "data") return "data-visualization";
  if (productType === "website") return "react-node";
  return "react-node";
}

export function buildProductContract(prompt: string): ProductContract {
  const originalPrompt = prompt.trim();
  const productType = classifyProductType(originalPrompt);
  const monetizationRequested = /\b(monetiz|subscription|billing|checkout|payment|paid|pricing|sell|revenue)\b/i.test(originalPrompt);
  const requirements: ProductRequirement[] = [
    { id: "REQ-001", text: "The primary product workflow described by the user is implemented and usable.", category: "workflow", priority: "must" },
    { id: "REQ-002", text: "The product provides clear success, loading, and error states.", category: "quality", priority: "must" },
    { id: "REQ-003", text: "The generated product does not expose secrets or unsafe privileged operations.", category: "security", priority: "must" },
    { id: "REQ-004", text: monetizationRequested ? "The requested monetization workflow is implemented with entitlement boundaries." : "The product reports monetization as not requested rather than inventing payment functionality.", category: "monetization", priority: monetizationRequested ? "must" : "should" },
    { id: "REQ-005", text: "The selected runtime can build, start, and be verified before completion is reported.", category: "operations", priority: "must" },
  ];

  return {
    version: 1,
    originalPrompt,
    productType,
    productFamilies: inferProductFamilies(originalPrompt, productType),
    techStack: selectProductStack(originalPrompt, productType),
    researchRequired: originalPrompt.length > 80 || productType !== "website",
    monetizationRequested,
    requirements,
  };
}

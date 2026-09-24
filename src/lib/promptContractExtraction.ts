/**
 * Deterministic, prompt-specific product contract extraction.
 *
 * Everything here is derived from the user's own words plus the classifier's
 * product type and secondary capabilities. It never calls a model, so it is
 * the guaranteed fallback when LLM enrichment is unavailable or invalid, and
 * two different prompts can never collapse into the same generic contract.
 */
import type {
  ProductRequirement,
  ProductType,
  SecondaryCapability,
} from "./productContract.js";

export type PromptFacts = {
  /** Short noun phrase naming what is being built, in the user's words. */
  subject: string;
  /** Who the prompt says the product is for (people or a business). */
  audience: string[];
  /** Feature phrases taken from the prompt ("Stripe billing", "team accounts"). */
  features: string[];
  /** Domain entities named or implied by the prompt. */
  entities: string[];
  roles: string[];
  integrations: string[];
  monetization: {
    requested: boolean;
    model:
      | "subscription"
      | "per_seat_subscription"
      | "one_time_purchase"
      | "usage_based"
      | "in_app_purchase"
      | "advertising"
      | "unspecified";
    provider: string | null;
  };
  schedule: string | null;
  genre: string | null;
};

const LEADING_FILLER =
  /^(?:(?:please|pls|hey|hi|i\s+(?:want|need|would like)(?:\s+to)?|can\s+you|could\s+you|help\s+me|let'?s|build|create|make|develop|design|generate|code|write|set\s+up|give\s+me|me|us)\b[\s,:]*)+/i;
const LEADING_ARTICLE = /^(?:an?|the|my|our|some|simple|basic|new)\s+/i;

const FEATURE_CONNECTOR =
  /\s+(?:with|that|which|including|includes|where|so\s+that|featuring|plus|who\s+can|to\s+let|to\s+help|allowing)\s+/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripFiller(prompt: string): string {
  let text = normalizeWhitespace(prompt).replace(/[.!?]+$/, "");
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(LEADING_FILLER, "").replace(LEADING_ARTICLE, "");
    if (next === text) break;
    text = next;
  }
  return text;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = normalizeWhitespace(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

export function extractSubject(prompt: string): string {
  const text = stripFiller(prompt);
  const firstSentence = text.split(/[.;\n]/)[0] ?? text;
  const beforeFeatures = firstSentence.split(FEATURE_CONNECTOR)[0] ?? "";
  const subject = normalizeWhitespace(
    beforeFeatures.split(/,\s*/)[0] ?? beforeFeatures,
  ).slice(0, 90);
  return subject || normalizeWhitespace(prompt).slice(0, 90);
}

export function extractFeatures(prompt: string): string[] {
  const text = stripFiller(prompt);
  const parts = text.split(FEATURE_CONNECTOR).slice(1);
  const features: string[] = [];
  for (const part of parts) {
    for (const piece of part.split(/,\s*|\s+and\s+|\s*;\s*|\.\s+/i)) {
      const cleaned = normalizeWhitespace(
        piece
          .replace(
            /^(?:also|then|it|can|will|should|must|lets?|allows?)\s+/i,
            "",
          )
          .replace(/[.!?]+$/, ""),
      );
      // Single words ("AI", "login") are covered by capability requirements.
      if (cleaned.split(" ").length >= 2 && cleaned.length <= 120) {
        features.push(cleaned);
      }
    }
  }
  return dedupe(features).slice(0, 6);
}

const DOMAIN_NOUN_HINTS =
  /\b(bookings?|appointments?|reservations?|invoices?|orders?|recipes?|tasks?|todos?|habits?|notes?|jobs?|leads?|deals?|tickets?|events?|products?|posts?|pages?|links?|bookmarks?|expenses?|workouts?|questions?|documents?|photos?|images?|videos?|listings?|properties|courses?|lessons?|sales|data|metrics|reports?|inventory|messages?|payments?|records?)\b/i;
const BUSINESS_NOUNS =
  /\b(salon|bakery|studio|clinic|restaurant|cafe|gym|shop|store|agency|business|company|school|practice|firm|team|startup|nonprofit|church|hotel|spa|garage|farm|brewery|dentist|dental practice|law firm|band)\b/i;

export function extractAudience(prompt: string): string[] {
  const audience: string[] = [];
  const forPattern =
    /\bfor\s+(?:my\s+|our\s+|a\s+|an\s+|the\s+|small\s+|local\s+)*([a-z][a-z0-9'&-]*(?:\s+[a-z][a-z0-9'&-]*){0,3}?)(?=\s+(?:with|that|who|which|to|using|and|where|so|in|on|at|by|via)\b|[,.;!?]|$)/gi;
  for (const match of prompt.matchAll(forPattern)) {
    const phrase = normalizeWhitespace(match[1] ?? "");
    if (!phrase) continue;
    // "API for bookings" names a domain object, not an audience.
    if (DOMAIN_NOUN_HINTS.test(phrase) && !BUSINESS_NOUNS.test(phrase))
      continue;
    if (/^(me|us|myself|everyone|free|fun|now|people)$/i.test(phrase)) continue;
    if (BUSINESS_NOUNS.test(phrase)) {
      audience.push(`${capitalize(phrase)} owners and staff`);
      audience.push(`${capitalize(phrase)} customers`);
    } else {
      audience.push(capitalize(phrase));
    }
  }
  const tracker = prompt.match(/\b([a-z]+)\s+tracker\b/i);
  if (tracker)
    audience.push(`People who track their ${tracker[1].toLowerCase()}s`);
  return dedupe(audience).slice(0, 4);
}

const ENTITY_LEXICON: Array<{ pattern: RegExp; models: string[] }> = [
  { pattern: /\bcrm\b/i, models: ["Contact", "Deal", "Activity"] },
  { pattern: /\b(customers?|clients?)\b/i, models: ["Customer"] },
  { pattern: /\bjobs?\b/i, models: ["Job"] },
  { pattern: /\binvoic(?:e|es|ing)\b/i, models: ["Invoice"] },
  { pattern: /\bquotes?\b|\bestimates?\b/i, models: ["Quote"] },
  { pattern: /\bleads?\b/i, models: ["Lead"] },
  { pattern: /\bbookings?\b|\breservations?\b/i, models: ["Booking"] },
  { pattern: /\bappointments?\b/i, models: ["Appointment"] },
  {
    pattern: /\b(?:availability|time ?slots?)\b/i,
    models: ["AvailabilitySlot"],
  },
  { pattern: /\b(to-?dos?|tasks?)\b/i, models: ["Task"] },
  { pattern: /\bhabits?\b/i, models: ["Habit", "HabitCheckIn"] },
  { pattern: /\bstreaks?\b/i, models: ["Streak"] },
  { pattern: /\bnotes?\b/i, models: ["Note"] },
  { pattern: /\bprojects?\b/i, models: ["Project"] },
  { pattern: /\btickets?\b/i, models: ["Ticket"] },
  { pattern: /\bevents?\b/i, models: ["Event"] },
  { pattern: /\bproducts?\b|\bcatalog\b/i, models: ["Product"] },
  { pattern: /\bcart\b/i, models: ["Cart"] },
  { pattern: /\borders?\b/i, models: ["Order"] },
  { pattern: /\brecipes?\b/i, models: ["Recipe"] },
  { pattern: /\b(?:blog|blog posts?|articles)\b/i, models: ["Post"] },
  { pattern: /\bcomments?\b/i, models: ["Comment"] },
  { pattern: /\breviews?\b/i, models: ["Review"] },
  { pattern: /\b(?:bookmarks?|links?)\b/i, models: ["Bookmark"] },
  { pattern: /\bexpenses?\b/i, models: ["Expense"] },
  { pattern: /\bbudgets?\b/i, models: ["Budget"] },
  { pattern: /\binventory\b/i, models: ["InventoryItem"] },
  { pattern: /\b(?:workouts?|exercises?)\b/i, models: ["Workout"] },
  { pattern: /\bpatients?\b/i, models: ["Patient"] },
  {
    pattern: /\b(?:students?|courses?|lessons?)\b/i,
    models: ["Course", "Enrollment"],
  },
  { pattern: /\b(?:listings?|properties)\b/i, models: ["Listing"] },
  {
    pattern: /\b(?:employees?|staff|technicians?)\b/i,
    models: ["StaffMember"],
  },
  { pattern: /\b(?:messages?|chat)\b/i, models: ["Message"] },
  { pattern: /\b(?:documents?|pdfs?|files?)\b/i, models: ["Document"] },
  { pattern: /\b(?:photos?|images?)\b/i, models: ["Image"] },
  { pattern: /\bsales\b/i, models: ["SalesRecord"] },
  { pattern: /\bcsv\b|\bspreadsheets?\b/i, models: ["DatasetUpload"] },
  { pattern: /\bweather\b/i, models: ["WeatherReport"] },
  { pattern: /\bquestions?\b|\bfaq\b/i, models: ["Question"] },
  { pattern: /\b(?:web ?pages?|articles?|tabs?)\b/i, models: ["PageSnapshot"] },
  { pattern: /\b(?:sites?|domains?)\b.*\bblock/i, models: ["BlockRule"] },
  { pattern: /\blevels?\b|\bplatformer\b/i, models: ["Level"] },
  {
    pattern: /\b(?:scores?|leaderboards?|high ?scores?)\b/i,
    models: ["Score"],
  },
  { pattern: /\benem(?:y|ies)\b/i, models: ["Enemy"] },
  { pattern: /\bmenu\b/i, models: ["MenuItem"] },
];

const TYPE_DEFAULT_ENTITIES: Record<ProductType, string[]> = {
  website: ["Page", "ContactSubmission"],
  saas_application: ["Workspace"],
  mobile_app: [],
  desktop_app: ["AppSettings"],
  game: ["Player", "Level", "Score"],
  ai_agent: ["AgentRun", "AgentAuditEvent"],
  developer_tool: ["CommandInvocation"],
  api: ["ApiClient"],
  ecommerce_product: ["Product", "Cart", "Order"],
  browser_extension: ["ExtensionSettings"],
  automation_tool: ["AutomationRun"],
  data_product: ["Dataset"],
};

export function extractEntities(prompt: string, type: ProductType): string[] {
  const models: string[] = [];
  for (const { pattern, models: names } of ENTITY_LEXICON) {
    if (pattern.test(prompt)) models.push(...names);
  }
  if (type === "game") {
    // Gameplay entities come from the game, not from CRUD records.
    return dedupe([
      ...TYPE_DEFAULT_ENTITIES.game,
      ...models.filter((m) => ["Level", "Score", "Enemy"].includes(m)),
    ]);
  }
  const defaults =
    type === "saas_application" && models.length > 0
      ? []
      : TYPE_DEFAULT_ENTITIES[type];
  return dedupe([...models, ...defaults]).slice(0, 10);
}

const ROLE_LEXICON: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\badmins?\b|\badministrators?\b/i, role: "admin" },
  { pattern: /\bowners?\b/i, role: "owner" },
  { pattern: /\bmanagers?\b/i, role: "manager" },
  { pattern: /\b(?:staff|employees?)\b/i, role: "staff" },
  { pattern: /\btechnicians?\b/i, role: "technician" },
  { pattern: /\bdispatchers?\b/i, role: "dispatcher" },
  { pattern: /\b(?:customers?|clients?)\b/i, role: "customer" },
  { pattern: /\bplayers?\b/i, role: "player" },
  { pattern: /\bmoderators?\b/i, role: "moderator" },
  { pattern: /\bteachers?\b|\binstructors?\b/i, role: "instructor" },
  { pattern: /\bstudents?\b/i, role: "student" },
  { pattern: /\bpatients?\b/i, role: "patient" },
  { pattern: /\b(?:doctors?|clinicians?)\b/i, role: "clinician" },
  { pattern: /\bsellers?\b|\bvendors?\b/i, role: "seller" },
  { pattern: /\bbuyers?\b|\bshoppers?\b/i, role: "buyer" },
  { pattern: /\bviewers?\b|\bread[- ]only\b/i, role: "viewer" },
  { pattern: /\beditors?\b/i, role: "editor" },
  {
    pattern: /\bteam accounts?\b|\bteam members?\b|\bteams?\b/i,
    role: "team_member",
  },
];

const TYPE_DEFAULT_ROLES: Record<ProductType, string[]> = {
  website: ["visitor", "site_owner"],
  saas_application: ["user", "admin"],
  mobile_app: ["user"],
  desktop_app: ["user"],
  game: ["player"],
  ai_agent: ["user", "agent_operator"],
  developer_tool: ["developer"],
  api: ["api_client", "admin"],
  ecommerce_product: ["customer", "store_admin"],
  browser_extension: ["user"],
  automation_tool: ["operator"],
  data_product: ["viewer", "data_admin"],
};

function singularRole(audience: string): string | null {
  const word = audience.toLowerCase().split(" ").pop() ?? "";
  if (!/^[a-z]{4,}s$/.test(word) || /(ss|us|is)$/.test(word)) return null;
  return word.replace(/ies$/, "y").replace(/s$/, "");
}

export function extractRoles(
  prompt: string,
  type: ProductType,
  capabilities: SecondaryCapability[],
  audience: string[],
): string[] {
  const roles = [...TYPE_DEFAULT_ROLES[type]];
  for (const { pattern, role } of ROLE_LEXICON) {
    if (pattern.test(prompt)) roles.push(role);
  }
  for (const entry of audience) {
    if (/owners and staff|customers$|^People who/.test(entry)) continue;
    const role = singularRole(entry);
    if (role) roles.push(role);
  }
  if (capabilities.includes("administration")) roles.push("admin");
  if (capabilities.includes("teams")) roles.push("team_member");
  return dedupe(roles).slice(0, 8);
}

const INTEGRATION_CANDIDATES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Stripe", pattern: /\bstripe\b/i },
  { name: "PayPal", pattern: /\bpaypal\b/i },
  { name: "Paddle", pattern: /\bpaddle\b/i },
  { name: "GitHub", pattern: /\bgithub\b/i },
  { name: "Slack", pattern: /\bslack\b/i },
  { name: "Discord", pattern: /\bdiscord\b/i },
  { name: "Telegram", pattern: /\btelegram\b/i },
  { name: "WhatsApp", pattern: /\bwhatsapp\b/i },
  { name: "Twilio", pattern: /\btwilio\b|\bsms\b/i },
  { name: "Google Sheets", pattern: /\bgoogle sheets?\b/i },
  { name: "Google Calendar", pattern: /\bgoogle calendar\b/i },
  { name: "Gmail", pattern: /\bgmail\b/i },
  {
    name: "Google",
    pattern: /\bgoogle\b(?!\s+(?:sheets?|calendar|play|maps))/i,
  },
  { name: "Google Maps", pattern: /\bgoogle maps\b|\bmaps?\b/i },
  { name: "Shopify", pattern: /\bshopify\b/i },
  { name: "Salesforce", pattern: /\bsalesforce\b/i },
  { name: "HubSpot", pattern: /\bhubspot\b/i },
  { name: "Xero", pattern: /\bxero\b/i },
  { name: "QuickBooks", pattern: /\bquickbooks\b/i },
  { name: "Notion", pattern: /\bnotion\b/i },
  { name: "Airtable", pattern: /\bairtable\b/i },
  { name: "Mailchimp", pattern: /\bmailchimp\b/i },
  { name: "SendGrid", pattern: /\bsendgrid\b/i },
  { name: "Supabase", pattern: /\bsupabase\b/i },
  { name: "Firebase", pattern: /\bfirebase\b/i },
  { name: "OpenAI", pattern: /\bopenai\b|\bgpt\b|\bchatgpt\b/i },
  { name: "Anthropic", pattern: /\banthropic\b|\bclaude\b/i },
  { name: "Gemini", pattern: /\bgemini\b/i },
  { name: "Weather data API", pattern: /\bweather\b/i },
  { name: "Apple HealthKit", pattern: /\bhealthkit\b|\bapple health\b/i },
  {
    name: "App Store / Google Play in-app purchases",
    pattern: /\bin[- ]app purchases?\b/i,
  },
];

export function extractIntegrations(prompt: string): string[] {
  return INTEGRATION_CANDIDATES.filter(({ pattern }) =>
    pattern.test(prompt),
  ).map(({ name }) => name);
}

export function extractMonetization(
  prompt: string,
  type: ProductType,
  capabilities: SecondaryCapability[],
): PromptFacts["monetization"] {
  const requested =
    capabilities.includes("billing") ||
    /\b(in[- ]app purchases?|ads?|advertising|freemium|paywall|premium tier|sell)\b/i.test(
      prompt,
    );
  if (!requested)
    return { requested: false, model: "unspecified", provider: null };
  const provider =
    ["Stripe", "PayPal", "Paddle", "Lemon Squeezy"].find((name) =>
      new RegExp("\\b" + name.replace(" ", "\\s*") + "\\b", "i").test(prompt),
    ) ??
    (type === "mobile_app" && /\bin[- ]app\b/i.test(prompt)
      ? "App Store / Google Play"
      : null);
  let model: PromptFacts["monetization"]["model"] = "unspecified";
  if (/\bin[- ]app purchases?\b/i.test(prompt)) model = "in_app_purchase";
  else if (/\b(ads|advertising|ad[- ]supported)\b/i.test(prompt))
    model = "advertising";
  else if (
    /\b(usage[- ]based|metered|pay[- ]as[- ]you[- ]go|per request)\b/i.test(
      prompt,
    )
  )
    model = "usage_based";
  else if (
    /\b(subscriptions?|monthly|yearly|annual|recurring|plans?|billing|freemium|premium tier)\b/i.test(
      prompt,
    )
  )
    model =
      capabilities.includes("teams") || /\bper[- ](seat|user)\b/i.test(prompt)
        ? "per_seat_subscription"
        : "subscription";
  else if (
    /\b(one[- ]time|buy|purchase|checkout|sell|payments?)\b/i.test(prompt)
  )
    model = "one_time_purchase";
  return { requested: true, model, provider };
}

function extractSchedule(prompt: string): string | null {
  const match = prompt.match(
    /\b(every\s+(?:\d+\s+)?(?:minute|hour|day|week|month|morning|evening|night)s?|hourly|daily|nightly|weekly|monthly)\b/i,
  );
  return match ? match[1].toLowerCase() : null;
}

function extractGenre(prompt: string): string | null {
  const match = prompt.match(
    /\b(platformer|puzzle|shooter|racing|rpg|roguelike|tower defense|snake|tetris|card|trivia|quiz|runner|breakout|pong|match[- ]3|strategy|adventure|arcade)\b/i,
  );
  return match ? match[1].toLowerCase() : null;
}

export function extractPromptFacts(
  prompt: string,
  type: ProductType,
  capabilities: SecondaryCapability[],
): PromptFacts {
  const audience = extractAudience(prompt);
  return {
    subject: extractSubject(prompt),
    audience,
    features: extractFeatures(prompt),
    entities: extractEntities(prompt, type),
    roles: extractRoles(prompt, type, capabilities, audience),
    integrations: extractIntegrations(prompt),
    monetization: extractMonetization(prompt, type, capabilities),
    schedule: extractSchedule(prompt),
    genre: extractGenre(prompt),
  };
}

// ── Contract sections ────────────────────────────────────────────────────

const CAPABILITY_LABELS: Record<SecondaryCapability, string> = {
  authentication: "Accounts and sign-in",
  database: "Persistence",
  billing: "Billing",
  ai: "AI features",
  analytics: "Analytics",
  administration: "Admin area",
  teams: "Teams",
  notifications: "Notifications",
  search: "Search",
  file_uploads: "File uploads",
  external_integrations: "Integrations",
  deployment: "Deployment",
};

const ONE_TIME_BILLING_DETAIL =
  "server-side checkout, signature-verified payment webhooks that mark the order paid, and totals computed on the server";

const CAPABILITY_REQUIREMENT_DETAIL: Record<
  SecondaryCapability,
  { match: RegExp; detail: string; category: ProductRequirement["category"] }
> = {
  authentication: {
    match:
      /\b(auth|login|log in|sign ?in|sign ?up|accounts?|password|sso|oauth)\b/i,
    detail:
      "sign-up, sign-in, sign-out and session expiry, with protected screens unreachable when signed out",
    category: "security",
  },
  database: {
    match: /\b(database|postgres|mysql|sqlite|mongo|supabase|persist|store)\b/i,
    detail:
      "data persists across restarts in the configured database with migrations",
    category: "workflow",
  },
  billing: {
    match:
      /\b(billing|subscriptions?|payments?|checkout|stripe|pricing|plans?)\b/i,
    detail:
      "server-side checkout, signature-verified payment webhooks, and entitlements that gate the paid features",
    category: "monetization",
  },
  ai: {
    match:
      /\b(ai|llm|gpt|model|openai|anthropic|gemini|summari[sz]e|chatbot)\b/i,
    detail:
      "model calls run server-side with provider keys kept secret, bounded tokens/timeouts, and model output treated as untrusted",
    category: "workflow",
  },
  analytics: {
    match: /\b(analytics|metrics|kpi|reports?|reporting|charts?|dashboard)\b/i,
    detail:
      "metrics are computed from real stored data and shown with date filters",
    category: "workflow",
  },
  administration: {
    match: /\b(admin|administrator|back office|moderation)\b/i,
    detail: "an admin area restricted to admin users server-side",
    category: "security",
  },
  teams: {
    match:
      /\b(teams?|team accounts?|organi[sz]ations?|workspaces?|members|multi[- ]tenant)\b/i,
    detail:
      "invite members, assign roles, and isolate each team's data so members never see another team's records",
    category: "security",
  },
  notifications: {
    match: /\b(notifications?|reminders?|alerts?|emails?|push)\b/i,
    detail:
      "notifications are delivered on the triggering event and can be turned off by the user",
    category: "workflow",
  },
  search: {
    match: /\b(search|filter|find)\b/i,
    detail:
      "search and filters return matching records with empty and error states",
    category: "workflow",
  },
  file_uploads: {
    match: /\b(uploads?|attachments?|files?|images?|documents?)\b/i,
    detail:
      "uploads are type- and size-validated, stored outside the web root, and deletable",
    category: "security",
  },
  external_integrations: {
    match: /\b(integrat\w*|webhooks?|sync|api)\b/i,
    detail:
      "credentials are configured via environment, failures are retried and surfaced to the user",
    category: "operations",
  },
  deployment: {
    match: /\b(deploy\w*|hosting|hosted|production)\b/i,
    detail:
      "the app deploys with documented environment variables and a health check",
    category: "operations",
  },
};

function typeCoreRequirements(
  type: ProductType,
  prompt: string,
  facts: PromptFacts,
): string[] {
  const reqs: string[] = [];
  switch (type) {
    case "website":
      reqs.push(
        "Responsive pages with working navigation, the content sections the prompt describes, and a functioning call-to-action or contact path",
      );
      break;
    case "saas_application": {
      const records =
        facts.entities
          .filter((entity) => entity !== "Workspace")
          .slice(0, 4)
          .join(", ") || "records";
      reqs.push(
        /\bteams?\b|\borgani[sz]ation/i.test(prompt)
          ? `Signed-in team members manage their team's ${records} end to end (create, list, edit, delete), scoped to their team`
          : `Signed-in users manage their own ${records} end to end (create, list, edit, delete), private to their account`,
      );
      break;
    }
    case "mobile_app":
      reqs.push(
        /\b(iphone|ipad|ios)\b/i.test(prompt) && !/\bandroid\b/i.test(prompt)
          ? "Runs as a native iPhone app (Expo/React Native, iOS first) with touch navigation between the main screens"
          : /\bandroid\b/i.test(prompt) && !/\b(iphone|ios)\b/i.test(prompt)
            ? "Runs as a native Android app with touch navigation between the main screens"
            : "Runs as a native mobile app on iOS and Android with touch navigation between the main screens",
      );
      reqs.push(
        "Keeps the user's data available offline and syncs or persists it safely on the device",
      );
      break;
    case "desktop_app":
      reqs.push(
        "Installable desktop application with a native window, application menu, and local persistence",
      );
      break;
    case "game":
      reqs.push(
        "Playable game loop in the browser: keyboard/touch controls, collision, scoring, win/lose states and restart",
      );
      if (facts.genre === "platformer")
        reqs.push(
          "Platformer mechanics: run, jump with gravity, solid platforms, hazards or enemies, and reaching the level goal",
        );
      else if (facts.genre)
        reqs.push(
          `Core ${facts.genre} mechanics exactly as the prompt describes`,
        );
      if (/\b2d\b/i.test(prompt))
        reqs.push("Renders in 2D (sprites/tiles) at a stable frame rate");
      break;
    case "ai_agent":
      reqs.push(
        "Agent loop that plans, calls only allow-listed tools, stops at a step/time limit, and shows an audit trail of each step",
      );
      break;
    case "developer_tool":
      reqs.push(
        /\bcli|command line\b/i.test(prompt)
          ? "Command-line interface with --help, validated arguments, meaningful exit codes, and machine-readable output option"
          : "Developer-facing interface with documented usage and reproducible output",
      );
      break;
    case "api":
      reqs.push(
        "HTTP API documented with OpenAPI, validating every request and returning a consistent JSON error format",
      );
      break;
    case "ecommerce_product":
      reqs.push(
        "Product catalog, cart, and server-side checkout that creates an order and shows a confirmation",
      );
      reqs.push(
        "Store admins add, edit, and archive products and see incoming orders with their payment status",
      );
      break;
    case "browser_extension":
      reqs.push(
        "Manifest V3 extension with least-privilege permissions, a popup or options page, and content scripts only on the pages it needs",
      );
      break;
    case "automation_tool":
      if (
        /\b(discord|telegram|slack|whatsapp)\b/i.test(prompt) ||
        /\bbot\b/i.test(prompt)
      )
        reqs.push(
          "Bot connects with a server-side token, handles its commands/events, and backs off on platform rate limits",
        );
      else
        reqs.push(
          "Automation runs its trigger → action steps idempotently with retries and a run history",
        );
      if (facts.schedule)
        reqs.push(
          `Runs on the requested schedule (${facts.schedule}) with a record of each run and its outcome`,
        );
      break;
    case "data_product":
      reqs.push(
        /\bcsv|spreadsheet\b/i.test(prompt)
          ? "CSV upload with header/column detection, type validation, and clear errors for malformed rows"
          : "Data import or connection with validation of the incoming data",
      );
      reqs.push(
        "Interactive charts and summary metrics computed from the imported data, with filters that update every view",
      );
      break;
  }
  return reqs;
}

function featureRequirementText(
  feature: string,
  capabilities: SecondaryCapability[],
  oneTime: boolean,
): {
  text: string;
  category: ProductRequirement["category"];
  covers: SecondaryCapability[];
} {
  const covers = capabilities.filter((capability) =>
    CAPABILITY_REQUIREMENT_DETAIL[capability].match.test(feature),
  );
  const primary = covers[0];
  const detail = primary ? CAPABILITY_REQUIREMENT_DETAIL[primary] : null;
  return {
    text: detail
      ? `${capitalize(feature)}: ${
          primary === "billing" && oneTime
            ? ONE_TIME_BILLING_DETAIL
            : detail.detail
        }`
      : `${capitalize(feature)}, implemented end to end as the prompt describes`,
    category: detail?.category ?? "workflow",
    covers,
  };
}

export function buildPromptRequirements(input: {
  prompt: string;
  type: ProductType;
  typeLabel: string;
  capabilities: SecondaryCapability[];
  facts: PromptFacts;
  stack: string;
}): ProductRequirement[] {
  const { prompt, type, typeLabel, capabilities, facts, stack } = input;
  const items: Array<Omit<ProductRequirement, "id">> = [];
  const audienceText = facts.audience.length ? ` for ${facts.audience[0]}` : "";
  items.push({
    text: `Deliver "${facts.subject}"${audienceText} as a working ${typeLabel} whose primary workflow runs end to end`,
    category: "workflow",
    priority: "must",
  });

  const oneTime =
    facts.monetization.model === "one_time_purchase" ||
    type === "ecommerce_product";
  const covered = new Set<SecondaryCapability>();
  for (const feature of facts.features) {
    const { text, category, covers } = featureRequirementText(
      feature,
      capabilities,
      oneTime,
    );
    covers.forEach((capability) => covered.add(capability));
    items.push({ text, category, priority: "must" });
  }

  for (const text of typeCoreRequirements(type, prompt, facts)) {
    items.push({ text, category: "workflow", priority: "must" });
  }

  const requested: SecondaryCapability[] = [
    "authentication",
    "billing",
    "teams",
    "ai",
    "notifications",
    "search",
    "file_uploads",
    "administration",
    "analytics",
  ];
  for (const capability of requested) {
    if (!capabilities.includes(capability) || covered.has(capability)) continue;
    // A data product's charts already cover analytics.
    if (capability === "analytics" && type === "data_product") continue;
    const detail = CAPABILITY_REQUIREMENT_DETAIL[capability];
    items.push({
      text: `${CAPABILITY_LABELS[capability]}: ${
        capability === "billing" && oneTime
          ? ONE_TIME_BILLING_DETAIL
          : detail.detail
      }`,
      category: detail.category,
      priority: "must",
    });
  }

  for (const integration of facts.integrations) {
    if (
      items.some((item) =>
        item.text.toLowerCase().includes(integration.toLowerCase()),
      )
    )
      continue;
    items.push({
      text: `Integrate with ${integration} using server-side credentials, with failures surfaced instead of silently ignored`,
      category: "operations",
      priority: "must",
    });
  }

  if (type === "api" || type === "mobile_app" || type === "desktop_app") {
    const domainEntities = facts.entities.filter(
      (entity) =>
        ![
          "Workspace",
          "ApiClient",
          "AgentAuditEvent",
          "CommandInvocation",
          "AppSettings",
          "ExtensionSettings",
        ].includes(entity),
    );
    for (const entity of domainEntities.slice(0, 3)) {
      items.push({
        text:
          type === "api"
            ? `${entity} resource: list, get, create, update and delete endpoints with validation and pagination`
            : `${entity} records can be created, viewed, updated and deleted with validation and persistence`,
        category: "workflow",
        priority: type === "api" ? "must" : "should",
      });
    }
  }

  items.push({
    text: "Every screen or command shows real loading, empty, success, and error states",
    category: "quality",
    priority: "must",
  });
  items.push({
    text: "Enforce security boundaries server-side and keep credentials out of client bundles and logs",
    category: "security",
    priority: "must",
  });
  items.push(
    facts.monetization.requested
      ? {
          text:
            `Revenue model: ${facts.monetization.model.replace(/_/g, " ")}${facts.monetization.provider ? ` via ${facts.monetization.provider}` : ""}` +
            (oneTime
              ? ", with orders marked paid only after a verified payment event"
              : ", with plans and entitlements enforced server-side"),
          category: "monetization",
          priority: "must",
        }
      : {
          text: "Do not invent monetization; the prompt did not request payments",
          category: "monetization",
          priority: "should",
        },
  );
  items.push({
    text: `Build, start, health-check, and verify the ${stack} runtime before completion`,
    category: "operations",
    priority: "must",
  });

  const unique = dedupeRequirements(items).slice(0, 20);
  return unique.map((item, index) => ({
    id: `REQ-${String(index + 1).padStart(3, "0")}`,
    ...item,
  }));
}

function dedupeRequirements(
  items: Array<Omit<ProductRequirement, "id">>,
): Array<Omit<ProductRequirement, "id">> {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPromptWorkflows(input: {
  type: ProductType;
  typeLabel: string;
  capabilities: SecondaryCapability[];
  facts: PromptFacts;
}): string[] {
  const { type, capabilities, facts } = input;
  const primaryByType: Record<ProductType, string> = {
    website:
      "Visitor lands, navigates the sections, and completes the call to action",
    saas_application:
      "User signs in, creates and manages records, and sees the results",
    mobile_app:
      "User opens the app, completes the main task on the phone, and sees it saved",
    desktop_app: "User launches the app, works on local data, and saves it",
    game: "Player starts the game, plays, scores, wins or loses, and restarts",
    ai_agent:
      "User gives the agent a goal, the agent runs tool steps, and the user reviews the result",
    developer_tool:
      "Developer runs the tool on their input and gets the generated output",
    api: "Client authenticates, calls the endpoints, and receives validated JSON responses",
    ecommerce_product:
      "Shopper browses products, adds to cart, checks out, and gets an order confirmation",
    browser_extension:
      "User installs the extension, triggers it on a page, and sees the result",
    automation_tool:
      "Trigger fires, the automation performs its actions, and the run is recorded",
    data_product:
      "User imports data, explores charts and filters, and reads the insights",
  };
  const workflows = [`${facts.subject}: ${primaryByType[type]}`];
  for (const feature of facts.features) {
    workflows.push(
      /^[a-z]+s\b/i.test(feature)
        ? `The ${type.replace(/_/g, " ")} ${feature}`
        : `Use ${feature}`,
    );
  }
  if (capabilities.includes("authentication"))
    workflows.push(
      "Create account, authenticate, refresh session, and sign out",
    );
  if (capabilities.includes("teams"))
    workflows.push(
      "Invite a teammate, accept the invite, and collaborate on shared records",
    );
  if (facts.monetization.requested)
    workflows.push(
      facts.monetization.model === "one_time_purchase" ||
        type === "ecommerce_product"
        ? "Pay at checkout server-side and receive the order or purchase confirmation"
        : "Choose a plan, pay server-side, receive access, and manage billing",
    );
  if (capabilities.includes("file_uploads"))
    workflows.push(
      "Upload, validate, persist, retrieve, and delete permitted files",
    );
  if (capabilities.includes("search"))
    workflows.push("Search domain data and display empty/error/result states");
  if (facts.schedule)
    workflows.push(
      `Scheduled run (${facts.schedule}) executes and records its outcome`,
    );
  return dedupe(workflows).slice(0, 10);
}

export function buildPromptSecurity(input: {
  prompt: string;
  type: ProductType;
  capabilities: SecondaryCapability[];
  facts: PromptFacts;
}): string[] {
  const { prompt, type, capabilities, facts } = input;
  const items = [
    "No secrets in browser bundles, generated artifacts, or logs",
    "Authorization is enforced server-side for privileged actions",
    "Validate untrusted input at trust boundaries",
    "Generated product data is isolated from AppForge production data",
  ];
  if (capabilities.includes("authentication"))
    items.push(
      "Passwords are hashed and sessions use secure, http-only cookies or short-lived tokens",
    );
  if (capabilities.includes("teams"))
    items.push(
      "Every query is scoped to the caller's team/organization (tenant isolation tested)",
    );
  if (facts.monetization.requested)
    items.push(
      `${facts.monetization.provider ?? "Payment"} webhooks are signature-verified and idempotent; prices and entitlements are decided server-side`,
    );
  if (
    capabilities.includes("file_uploads") ||
    /\bcsv|spreadsheet\b/i.test(prompt)
  )
    items.push(
      "Uploaded files are size- and type-limited; CSV values are escaped against formula injection on export",
    );
  if (capabilities.includes("ai") || type === "ai_agent")
    items.push(
      "Model output is treated as untrusted input; prompt-injection cannot trigger unapproved tool calls",
    );
  if (type === "browser_extension")
    items.push(
      "Extension requests only the permissions it needs, loads no remote code, and sanitizes page content it reads",
    );
  if (type === "api")
    items.push(
      "Write endpoints require authentication (API key or token) and all endpoints are rate limited",
    );
  if (type === "automation_tool" && /\bbot\b/i.test(prompt))
    items.push(
      "Bot token is stored server-side only; commands validate input and are rate limited per user",
    );
  if (type === "mobile_app")
    items.push(
      "Tokens are stored in the platform secure store (Keychain/Keystore), not plain storage",
    );
  if (type === "game" && facts.entities.includes("Score"))
    items.push(
      "Client-reported scores are validated before they are persisted or ranked",
    );
  if (type === "ecommerce_product")
    items.push(
      "Order totals, taxes, and stock are computed server-side, never trusted from the client",
    );
  if (
    /\b(health|medical|patients?|habits?|finance|budget|expenses?|bank)\b/i.test(
      prompt,
    )
  )
    items.push(
      "Personal data is private to its owner and can be exported and deleted on request",
    );
  return dedupe(items);
}

export function buildPromptNonFunctional(
  type: ProductType,
  prompt: string,
): string[] {
  const items = [
    "Production-safe error handling and observability",
    "Deterministic build and startup commands",
    "No placeholder-only implementation may be treated as complete",
  ];
  if (!["api", "automation_tool", "developer_tool"].includes(type))
    items.push("Responsive, accessible user experience");
  if (type === "game")
    items.push("Targets 60 fps on a mid-range laptop browser");
  if (type === "mobile_app")
    items.push("Usable one-handed on a phone screen; respects safe areas");
  if (type === "api")
    items.push("Documented request/response contracts and versioned routes");
  if (type === "data_product")
    items.push("Charts stay responsive for datasets of at least 10,000 rows");
  if (/\b(real[- ]?time|live)\b/i.test(prompt))
    items.push("Updates appear in near real time without manual refresh");
  return items;
}

export function buildPromptTargetUsers(
  type: ProductType,
  facts: PromptFacts,
  defaults: string[],
): string[] {
  return dedupe([...facts.audience, ...defaults]).slice(0, 5);
}

export function buildPromptMonetization(facts: PromptFacts): string[] {
  if (!facts.monetization.requested) return [];
  const model = facts.monetization.model.replace(/_/g, " ");
  const provider =
    facts.monetization.provider ?? "the configured payment provider";
  const oneTime = facts.monetization.model === "one_time_purchase";
  return [
    `Revenue model: ${model} via ${provider}`,
    "Billing state is server-authoritative",
    "Webhook events are signature-validated and idempotent",
    oneTime
      ? "Orders or purchases are fulfilled only after a verified payment"
      : "Paid functionality is protected by entitlements",
  ];
}

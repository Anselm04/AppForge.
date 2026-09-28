import type { ProductContract } from "./productContract.js";

export type MonetizationPolicy = {
  required: boolean;
  models: Array<
    | "subscription"
    | "one_time"
    | "usage"
    | "trial"
    | "credits"
    | "in_app_purchase"
    | "advertising"
  >;
  provider: string | null;
};

const BILLING_PATH = /(?:^|\/)(?:billing|payments?|monetization)(?:\/|\.|$)/i;
const PRODUCT_PRICE_PATH = /(?:^|\/)(?:billing\/)?(?:catalog|products?|prices?|plans?)(?:\/|\.|$)/i;
const CHECKOUT_PATH = /(?:^|\/)(?:billing\/)?(?:checkout|payments?|purchase)(?:\/|\.|$)/i;
const USAGE_PATH = /(?:^|\/)(?:billing\/)?(?:usage|metering|meters?)(?:\/|\.|$)/i;
const CREDIT_PATH = /(?:^|\/)(?:billing\/)?credits?(?:\/|\.|$)/i;
const ENTITLEMENT_PATH = /(?:^|\/)(?:billing\/)?entitlements?(?:\/|\.|$)/i;
const LIMIT_PATH = /(?:^|\/)(?:billing\/)?(?:limits?|quotas?|access)(?:\/|\.|$)/i;
const PORTAL_PATH = /(?:^|\/)(?:billing\/)?(?:portal|customerPortal|customer_portal)(?:\/|\.|$)/i;
const WEBHOOK_PATH = /(?:^|\/)(?:billing\/)?webhooks?(?:\/|\.|$)|stripe.*webhook/i;
const INVOICE_PATH = /(?:^|\/)(?:billing\/)?invoices?(?:\/|\.|$)/i;
const REFUND_PATH = /(?:^|\/)(?:billing\/)?refunds?(?:\/|\.|$)/i;
const AUDIT_PATH = /(?:^|\/)(?:billing\/)?(?:audit|events?|ledger)(?:\/|\.|$)/i;
const ENV_PATH = /(?:^|\/)\.env(?:\.example|\.sample|\.template)$/i;
const DOC_PATH = /(?:^|\/)docs\/(?:BILLING|MONETIZATION|billing|monetization)\.md$/i;

function allText(files: Record<string,string>): string {
  return Object.entries(files).map(([p,s])=>`// ${p}\n${s}`).join("\n");
}

export function monetizationPolicy(contract: ProductContract): MonetizationPolicy {
  const req = contract.monetizationRequirements.join(" ");
  const prompt = contract.originalPrompt;
  const text = (req + " " + prompt).toLowerCase();
  const models: MonetizationPolicy["models"] = [];
  if (/subscription|recurring|monthly|annual|yearly|per seat|plan/.test(text)) models.push("subscription");
  if (/one[- ]time|single purchase|buy|purchase|checkout/.test(text)) models.push("one_time");
  if (/usage|metered|pay[- ]as[- ]you[- ]go|per request/.test(text)) models.push("usage");
  if (/trial|free trial/.test(text)) models.push("trial");
  if (/credit|token pack|build credit/.test(text)) models.push("credits");
  if (/in[- ]app purchase/.test(text)) models.push("in_app_purchase");
  if (/advertis|\bads?\b|ad-supported/.test(text)) models.push("advertising");
  const required =
    contract.monetizationRequirements.length > 0 ||
    contract.secondaryCapabilities.includes("billing");
  if (required && models.length===0) models.push("subscription");
  const provider =
    contract.integrations.find((x)=>/stripe|paypal|paddle|lemon|app store|google play/i.test(x)) ?? null;
  return { required, models:[...new Set(models)], provider };
}

export function isMonetizationBillingPath(path:string){return BILLING_PATH.test(path);}
export function isMonetizationCatalogPath(path:string){return PRODUCT_PRICE_PATH.test(path);}
export function isMonetizationCheckoutPath(path:string){return CHECKOUT_PATH.test(path);}
export function isMonetizationUsagePath(path:string){return USAGE_PATH.test(path);}
export function isMonetizationCreditPath(path:string){return CREDIT_PATH.test(path);}
export function isMonetizationEntitlementPath(path:string){return ENTITLEMENT_PATH.test(path);}
export function isMonetizationLimitPath(path:string){return LIMIT_PATH.test(path);}
export function isMonetizationPortalPath(path:string){return PORTAL_PATH.test(path);}
export function isMonetizationWebhookPath(path:string){return WEBHOOK_PATH.test(path);}
export function isMonetizationInvoicePath(path:string){return INVOICE_PATH.test(path);}
export function isMonetizationRefundPath(path:string){return REFUND_PATH.test(path);}
export function isMonetizationAuditPath(path:string){return AUDIT_PATH.test(path);}
export function isMonetizationEnvPath(path:string){return ENV_PATH.test(path);}
export function isMonetizationDocsPath(path:string){return DOC_PATH.test(path);}

export function monetizationPlannerInstruction(contract: ProductContract): string {
  const p=monetizationPolicy(contract);
  if(!p.required){
    return [
      "MONETIZATION: not requested.",
      "- Do not activate billing, create checkout, or claim paid plans are live.",
      "- Optional monetization recommendations may be documented separately but must not become implementation tasks or production configuration."
    ].join("\n");
  }
  return [
    "MONETIZATION IMPLEMENTATION — mandatory:",
    "- Requested models: "+p.models.join(", ")+".",
    "- Include a backend or integration-owned billing task.",
    "- Plan server-side product/price catalog, checkout/payment flow, entitlements, access limits, billing webhook, billing event audit ledger, environment config, and docs/BILLING.md.",
    p.models.includes("subscription") ? "- Include subscription plans, customer portal, invoices, failed-payment handling, cancellation, upgrades/downgrades, and server-side entitlement enforcement." : "",
    p.models.includes("one_time") ? "- Include one-time payment fulfillment and refunds tied to verified provider events." : "",
    p.models.includes("usage") ? "- Include metered usage recording, aggregation, billing, and enforced quotas." : "",
    p.models.includes("trial") ? "- Include trial start/end semantics and post-trial entitlement downgrade." : "",
    p.models.includes("credits") ? "- Include credit ledger, grants/purchases/consumption, balance limits, refunds/reconciliation, and idempotency." : "",
    "- Webhooks must verify signatures, deduplicate provider event IDs, and audit outcomes.",
    "- Billing state and entitlements are server-authoritative; client state cannot unlock paid functionality.",
    "- Unpaid users must be denied paid functionality server-side.",
    "- Monetization must remain explicitly unconfigured/inactive until required provider credentials, product/price IDs, webhook secret, persistence and health verification exist."
  ].filter(Boolean).join("\n");
}

export function monetizationCoderInstruction(contract: ProductContract): string {
  const p=monetizationPolicy(contract);
  if(!p.required) return "Do not implement or claim active monetization; it was not requested.";
  return [
    "Monetization implementation requirements:",
    "- Generate provider product and price configuration on the server and validate configured IDs.",
    "- Implement server-authoritative entitlements and access limits; never trust a browser plan/tier flag.",
    "- Reject unpaid/inactive/past-due/canceled users from paid server actions.",
    "- Webhooks must verify provider signatures and process each provider event idempotently with an event ledger.",
    "- Audit billing events without logging secrets or sensitive payment data.",
    "- Expose explicit configured/unconfigured billing health; never report active from environment-variable presence alone.",
    p.models.includes("subscription") ? "- Implement subscription creation, plan changes/upgrades/downgrades, customer portal, invoice paid/failed handling, cancellation and entitlement transitions." : "",
    p.models.includes("one_time") ? "- Implement one-time checkout, verified fulfillment and refund handling." : "",
    p.models.includes("usage") ? "- Implement usage metering, aggregation and quota enforcement." : "",
    p.models.includes("trial") ? "- Implement trial lifecycle and expiration enforcement." : "",
    p.models.includes("credits") ? "- Implement a durable credit ledger with idempotent grants, consumption and refund reconciliation." : "",
    "- Add docs/BILLING.md and .env.example naming required configuration without real secrets."
  ].filter(Boolean).join("\n");
}

export function validateMonetizationArtifact(input:{files:Record<string,string>;contract:ProductContract}):string[]{
  const p=monetizationPolicy(input.contract);
  const files=input.files;
  const entries=Object.entries(files);
  const text=allText(files);
  const problems:string[]=[];
  const recommendations=(input.contract.monetizationRecommendations??[]).join(" ");

  if(!p.required){
    if(/checkout\.sessions|stripe\.subscriptions|paymentintent|billing webhook|customer portal/i.test(text)){
      problems.push("monetization contract: billing implementation exists although monetization was not requested");
    }
    if(/monetization active|billing active|subscription active/i.test(text)){
      problems.push("monetization contract: optional recommendation is being claimed as active monetization");
    }
    if(recommendations && input.contract.monetizationRequirements.length===0){
      return problems;
    }
    return problems;
  }

  const has=(fn:(p:string)=>boolean)=>entries.some(([path])=>fn(path));
  if(!has(isMonetizationCatalogPath)) problems.push("monetization contract: missing product/price catalog");
  if(!has(isMonetizationCheckoutPath)) problems.push("monetization contract: missing payment/checkout implementation");
  if(!has(isMonetizationEntitlementPath)) problems.push("monetization contract: missing entitlement implementation");
  if(!has(isMonetizationLimitPath)) problems.push("monetization contract: missing access-limit/quota implementation");
  if(!has(isMonetizationWebhookPath)) problems.push("monetization contract: missing billing webhook");
  if(!has(isMonetizationAuditPath)) problems.push("monetization contract: missing billing event audit ledger");
  if(!has(isMonetizationEnvPath)) problems.push("monetization contract: missing billing environment example");
  if(!has(isMonetizationDocsPath)) problems.push("monetization contract: missing billing setup documentation");

  if(p.models.includes("subscription")){
    if(!/subscription|plan/i.test(text)) problems.push("monetization contract: missing subscription plan implementation");
    if(!has(isMonetizationPortalPath)) problems.push("monetization contract: missing customer portal");
    if(!has(isMonetizationInvoicePath)) problems.push("monetization contract: missing invoice handling");
    for(const term of ["payment_failed","cancell","upgrade","downgrade"]){
      if(!new RegExp(term,"i").test(text)) problems.push("monetization contract: missing "+term.replace("_"," ")+" handling");
    }
  }
  if(p.models.includes("one_time") && !/one.?time|mode\s*[:=]\s*["']payment|paymentintent/i.test(text))
    problems.push("monetization contract: missing one-time payment flow");
  if(p.models.includes("usage") && !has(isMonetizationUsagePath))
    problems.push("monetization contract: missing usage billing/metering");
  if(p.models.includes("trial") && !/trial|trial_end|trialEnd/i.test(text))
    problems.push("monetization contract: missing trial lifecycle");
  if(p.models.includes("credits") && !has(isMonetizationCreditPath))
    problems.push("monetization contract: missing credit ledger");
  if((p.models.includes("one_time")||p.models.includes("credits")) && !has(isMonetizationRefundPath))
    problems.push("monetization contract: missing refund/reconciliation handling");

  if(!/constructEvent|verifySignature|signature.*verify|webhook.*signature/i.test(text))
    problems.push("monetization contract: billing webhook has no signature verification");
  if(!/idempot|event.?id|processed.?event|duplicate/i.test(text))
    problems.push("monetization contract: billing webhook has no duplicate-event protection");
  if(!/audit|ledger|billing.?event/i.test(text))
    problems.push("monetization contract: billing event auditing is not evident");
  if(!/server.?authoritative|server-side|server side/i.test(text))
    problems.push("monetization contract: billing state is not explicitly server-authoritative");
  if(!/entitlement|canAccess|requirePaid|requireSubscription|access.?limit/i.test(text))
    problems.push("monetization contract: paid functionality has no server entitlement gate");
  if(!/past_due|unpaid|inactive|canceled|cancelled|payment_failed/i.test(text))
    problems.push("monetization contract: unpaid/failed billing states are not denied");
  if(/localStorage.*(?:plan|tier|paid|subscription)|(?:plan|tier|paid|subscription).*localStorage/i.test(text))
    problems.push("monetization contract: client-local billing state is trusted");
  if(/active\s*[:=]\s*true|state\s*[:=]\s*["']active["']/i.test(text) &&
     !/verified|webhook|provider|health/i.test(text))
    problems.push("monetization contract: monetization can be claimed active without verified configuration");
  if(/(?:STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET|PADDLE_API_KEY)\s*=\s*["'][^"']{8,}["']/i.test(text))
    problems.push("monetization contract: hard-coded billing credential detected");

  return [...new Set(problems)];
}

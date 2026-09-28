import { describe, expect, it } from "vitest";
import {
  monetizationCoderInstruction,
  monetizationPlannerInstruction,
  monetizationPolicy,
  validateMonetizationArtifact,
} from "../monetizationImplementation.js";
import {
  buildProductContract,
  validateProductContract,
  type ProductContract,
} from "../productContract.js";

function subscriptionContract(): ProductContract {
  return buildProductContract(
    "Build a paid SaaS app with Stripe subscription plans, a free trial, credits, and team billing",
  );
}

function completeSubscriptionFiles(): Record<string, string> {
  return {
    "billing/catalog.ts": [
      "export const products = [{ id: 'pro_product', name: 'Pro' }];",
      "export const prices = [{ id: process.env.STRIPE_PRICE_ID, product: 'pro_product' }];",
      "export const plans = ['free','pro','enterprise'];",
      "export const configurationState = process.env.STRIPE_PRICE_ID ? 'configured' : 'unconfigured';",
    ].join("\n"),
    "billing/checkout.ts": [
      "export async function checkout(){",
      "  const stripeKey = process.env.STRIPE_SECRET_KEY;",
      "  if(!stripeKey) throw new Error('Billing unconfigured');",
      "  return { serverAuthoritative: true };",
      "}",
    ].join("\n"),
    "billing/entitlements.ts": [
      "export async function requireSubscription(userId:string){",
      "  const serverAuthoritative = true;",
      "  const status = await loadServerSubscription(userId);",
      "  if(['past_due','unpaid','inactive','canceled'].includes(status)) throw new Error('Paid entitlement required');",
      "  return { serverAuthoritative, status };",
      "}",
      "async function loadServerSubscription(_userId:string){ return 'active'; }",
    ].join("\n"),
    "billing/limits.ts": [
      "export const accessLimits={free:10,pro:1000,enterprise:100000};",
      "export function canAccess(limit:number,used:number){return used < limit;}",
    ].join("\n"),
    "billing/portal.ts":
      "export const upgrades='upgrade'; export const downgrades='downgrade'; export const cancellation='cancellation';",
    "billing/webhook.ts": [
      "export function verifySignature(){ return 'constructEvent signature verify'; }",
      "export function processEvent(event:{id:string}){ const eventId=event.id; const idempotency=true; return {eventId,idempotency}; }",
      "export const payment_failed='invoice.payment_failed';",
      "export const canceled='customer.subscription.deleted cancellation';",
      "export const verified='webhook verified';",
    ].join("\n"),
    "billing/invoices.ts":
      "export const invoicePaid='invoice.paid'; export const failed='invoice.payment_failed';",
    "billing/refunds.ts":
      "export async function refund(){ return { refund: true, reconciliation: true }; }",
    "billing/audit.ts":
      "export const ledger='billing event audit ledger'; export function auditBillingEvent(){return 'processed';}",
    "billing/credits.ts":
      "export const creditLedger={grant:true,consume:true,refund:true};",
    "billing/trials.ts":
      "export const trialEnd='trial_end'; export const trial='free trial';",
    "billing/health.ts": [
      "export const configured=true;",
      "export const verified=true;",
      "export const providerHealth='billing health verified';",
    ].join("\n"),
    ".env.example": [
      "STRIPE_SECRET_KEY=",
      "STRIPE_WEBHOOK_SECRET=",
      "STRIPE_PRICE_ID=",
    ].join("\n"),
    "docs/BILLING.md": [
      "Billing setup is server-authoritative.",
      "Products and prices are configured on the server.",
      "Webhook signatures are verified and duplicate event IDs are idempotent.",
      "Invoices, failed payments, cancellation, upgrades, downgrades, refunds and reconciliation are handled.",
      "Entitlements and access limits deny unpaid users.",
      "Billing is unconfigured until provider health is verified.",
    ].join("\n"),
  };
}

describe("Section 21 monetization implementation", () => {
  it("detects requested monetization and keeps recommendations separate", () => {
    const requested = subscriptionContract();
    expect(requested.monetizationRequirements.length).toBeGreaterThan(0);
    expect(requested.monetizationRecommendations).toEqual([]);
    expect(monetizationPolicy(requested).required).toBe(true);

    const optional = buildProductContract(
      "Build a SaaS project management app for teams",
    );
    expect(optional.monetizationRequirements).toEqual([]);
    expect((optional.monetizationRecommendations ?? []).length).toBeGreaterThan(
      0,
    );
    expect((optional.monetizationRecommendations ?? [])[0]).toMatch(
      /Optional recommendation/i,
    );
    expect(monetizationPolicy(optional).required).toBe(false);
  });

  it("never converts optional recommendations into active billing", () => {
    const optional = buildProductContract(
      "Build a SaaS scheduling app for small teams",
    );
    expect(
      validateMonetizationArtifact({
        contract: optional,
        files: {
          "docs/README.md": (optional.monetizationRecommendations ?? []).join(
            "\n",
          ),
        },
      }),
    ).toEqual([]);

    const problems = validateMonetizationArtifact({
      contract: optional,
      files: {
        "src/billing.ts":
          "export const monetizationActive = true; const billing='checkout.sessions';",
      },
    });
    expect(problems).toContain(
      "monetization contract: billing implementation exists although monetization was not requested",
    );
  });

  it("detects subscription, trial and credits from the requested revenue model", () => {
    const policy = monetizationPolicy(subscriptionContract());
    expect(policy.models).toContain("subscription");
    expect(policy.models).toContain("trial");
    expect(policy.models).toContain("credits");
  });

  it("accepts a complete server-authoritative subscription implementation", () => {
    expect(
      validateMonetizationArtifact({
        contract: subscriptionContract(),
        files: completeSubscriptionFiles(),
      }),
    ).toEqual([]);
  });

  it("rejects missing paid-access enforcement and client-trusted billing state", () => {
    const files = completeSubscriptionFiles();
    delete files["billing/entitlements.ts"];
    files["src/Pricing.tsx"] =
      "const plan=localStorage.getItem('plan'); export const paid=plan==='pro';";
    const problems = validateMonetizationArtifact({
      contract: subscriptionContract(),
      files,
    });
    expect(problems).toContain(
      "monetization contract: missing entitlement implementation",
    );
    expect(problems).toContain(
      "monetization contract: client-local billing state is trusted",
    );
  });

  it("rejects unsigned or non-idempotent billing webhooks", () => {
    const files = completeSubscriptionFiles();
    files["billing/webhook.ts"] =
      "export function webhook(event:any){return event;}";
    const problems = validateMonetizationArtifact({
      contract: subscriptionContract(),
      files,
    });
    expect(problems).toContain(
      "monetization contract: billing webhook has no signature verification",
    );
    expect(problems).toContain(
      "monetization contract: billing webhook has no duplicate-event protection",
    );
  });

  it("supports one-time, usage and credit monetization policies when requested", () => {
    const build = (prompt: string) => buildProductContract(prompt);
    expect(
      monetizationPolicy(
        build("Build an API with usage-based metered billing per request"),
      ).models,
    ).toContain("usage");
    expect(
      monetizationPolicy(
        build("Build an online store with one-time Stripe payments"),
      ).models,
    ).toContain("one_time");
    expect(
      monetizationPolicy(
        build("Build a SaaS app that sells build credit packs"),
      ).models,
    ).toContain("credits");
  });

  it("planner and coder require full lifecycle billing behavior", () => {
    for (const text of [
      monetizationPlannerInstruction(subscriptionContract()),
      monetizationCoderInstruction(subscriptionContract()),
    ]) {
      expect(text).toMatch(/product/i);
      expect(text).toMatch(/price/i);
      expect(text).toMatch(/entitlement/i);
      expect(text).toMatch(/access/i);
      expect(text).toMatch(/portal/i);
      expect(text).toMatch(/invoice/i);
      expect(text).toMatch(/failed/i);
      expect(text).toMatch(/cancel/i);
      expect(text).toMatch(/upgrade/i);
      expect(text).toMatch(/downgrade/i);
      expect(text).toMatch(/refund/i);
      expect(text).toMatch(/idempot/i);
      expect(text).toMatch(/audit/i);
      expect(text).toMatch(/unpaid/i);
      expect(text).toMatch(/server/i);
      expect(text).toMatch(/unconfigured/i);
    }
  });
});

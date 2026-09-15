import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const server = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
const validator = readFileSync(
  resolve(process.cwd(), "src/utils/env-validator.ts"),
  "utf8",
);

describe("Stripe webhook startup isolation", () => {
  it("does not import the Stripe webhook module before the HTTP listener starts", () => {
    expect(server).not.toContain(
      'import { stripeWebhookHandler } from "./webhooks/stripe.js"',
    );
    expect(server).toContain('await import("./webhooks/stripe.js")');
  });

  it("keeps production Stripe configuration fail-closed through readiness validation", () => {
    expect(validator).toContain("STRIPE_SECRET_KEY");
    expect(validator).toContain("STRIPE_WEBHOOK_SECRET");
    expect(server).toContain('markStartupDegraded("environment")');
    expect(server).toContain('type: "STARTUP_NOT_READY"');
  });
});

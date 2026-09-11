import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webhook = readFileSync(
  resolve(process.cwd(), "src/webhooks/stripe.ts"),
  "utf8",
);
const server = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");

describe("Stripe webhook server export", () => {
  it("keeps the server import wired to the webhook handler", () => {
    expect(webhook).toContain(
      "export const stripeWebhookHandler = handleStripeWebhook",
    );
    expect(server).toContain(
      'import { stripeWebhookHandler } from "./webhooks/stripe.js"',
    );
  });
});

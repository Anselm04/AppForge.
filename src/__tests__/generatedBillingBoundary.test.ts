import { describe, expect, it } from "vitest";
import {
  billingScaffoldFiles,
  validateBillingScaffold,
} from "../services/saasBillingScaffold.js";

describe("generated billing trust boundary", () => {
  it.each(["next-node", "react-node"])(
    "keeps Stripe pricing and identity server-owned for %s",
    (stack) => {
      const files = billingScaffoldFiles(stack);
      const checkoutPath = stack.includes("next")
        ? "src/app/api/checkout/route.ts"
        : "src/server/routes/billing/checkout.ts";
      const checkout = files[checkoutPath] ?? "";
      const pricing = files["src/pages/PricingPage.tsx"] ?? "";
      const session = files["src/lib/auth/session.ts"] ?? "";
      const manifest = files["billing/stripe-manifest.json"] ?? "";

      expect(checkout).toContain("process.env.STRIPE_PRICE_ID");
      expect(checkout).toContain("getUserIdFromRequest");
      expect(checkout).toContain("Not authenticated");
      expect(checkout).toContain("401");
      expect(checkout).not.toContain("body.priceId");
      expect(checkout).not.toContain("body.userId");
      expect(checkout).not.toContain("customerEmail");
      expect(pricing).not.toContain("VITE_STRIPE_PRICE_ID");
      expect(pricing).not.toContain('localStorage.getItem("userId")');
      expect(pricing).not.toContain('localStorage.getItem("userEmail")');
      expect(session).toContain("createHmac");
      expect(session).toContain("timingSafeEqual");
      expect(session).toContain("SESSION_SECRET");
      expect(session).toContain("HttpOnly");
      expect(session).toContain("Secure");
      expect(manifest).toContain("SESSION_SECRET");
      expect(validateBillingScaffold(files).passed).toBe(true);
    },
  );

  it("rejects a scaffold that lets the browser choose price or billing identity", () => {
    const files = billingScaffoldFiles("next-node");
    files["src/app/api/checkout/route.ts"] = `
      const body = await req.json();
      const price = body.priceId;
      const userId = body.userId;
      await stripe.checkout.sessions.create({
        line_items: [{ price, quantity: 1 }],
        client_reference_id: userId,
      });
    `;

    const result = validateBillingScaffold(files);
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("server-owned Stripe price");
    expect(result.missing).toContain("server-owned billing identity");
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyAppForgeSubscription,
  isAppForgeCreditMetadata,
} from "../services/appForgeStripeOwnership.js";

describe("AppForge Stripe ownership in a shared Stripe account", () => {
  it("accepts a configured AppForge subscription price", () => {
    expect(classifyAppForgeSubscription({}, true)).toBe("appforge");
  });

  it("ignores an unrelated product subscription", () => {
    expect(
      classifyAppForgeSubscription({ product_line: "another-product" }, false),
    ).toBe("foreign");
    expect(classifyAppForgeSubscription({}, false)).toBe("foreign");
  });

  it("fails closed when an AppForge marker carries an unconfigured standard price", () => {
    expect(
      classifyAppForgeSubscription(
        { product_line: "appforge", tier: "starter" },
        false,
      ),
    ).toBe("invalid_appforge");
  });

  it("permits explicitly marked custom AppForge subscriptions", () => {
    expect(
      classifyAppForgeSubscription(
        { product_line: "appforge", tier: "custom" },
        false,
      ),
    ).toBe("appforge");
  });

  it("requires the AppForge product namespace for credit fulfillment", () => {
    expect(isAppForgeCreditMetadata({ product_line: "appforge" })).toBe(true);
    expect(isAppForgeCreditMetadata({ product_line: "other" })).toBe(false);
    expect(isAppForgeCreditMetadata({})).toBe(false);
  });
});

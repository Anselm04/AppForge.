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
        { product_line: "appforge", tier: "starter", userId: "42" },
        false,
      ),
    ).toBe("invalid_appforge");
  });

  it("fails closed when explicitly marked AppForge metadata has no valid user identity", () => {
    expect(
      classifyAppForgeSubscription(
        { product_line: "appforge", tier: "starter" },
        true,
      ),
    ).toBe("invalid_appforge");
    expect(() =>
      isAppForgeCreditMetadata({ product_line: "appforge", credits: "50" }),
    ).toThrow("missing a valid userId");
  });

  it("permits explicitly marked custom AppForge subscriptions", () => {
    expect(
      classifyAppForgeSubscription(
        { product_line: "appforge", tier: "custom", userId: "42" },
        false,
      ),
    ).toBe("appforge");
  });

  it("requires the AppForge product namespace and user identity for credit fulfillment", () => {
    expect(
      isAppForgeCreditMetadata({ product_line: "appforge", userId: "42" }),
    ).toBe(true);
    expect(isAppForgeCreditMetadata({ product_line: "other" })).toBe(false);
    expect(isAppForgeCreditMetadata({})).toBe(false);
  });
});

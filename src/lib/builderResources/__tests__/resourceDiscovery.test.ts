import { describe, expect, it } from "vitest";
import {
  answerBuilderResourceDiscoveryQuestion,
  discoverBuilderResources,
} from "../resourceDiscovery.js";

describe("private Builder Resource discovery questions", () => {
  it("finds authentication compatible with Flutter + Node", () => {
    const result = answerBuilderResourceDiscoveryQuestion({
      capability: "authentication",
      technologyStack: "flutter-node",
      platform: "android",
      productType: "mobile_app",
    });
    expect(result.available).toBe(true);
    expect(result.candidates[0]?.capabilities).toContain("authentication");
  });

  it("finds the generalized booking workflow", () => {
    expect(
      discoverBuilderResources({ integrationPoint: "booking" }).map(
        (resource) => resource.resourceId,
      ),
    ).toContain("module.booking");
  });

  it("finds Stripe-backed billing substance without exposing provider secrets", () => {
    const billing = discoverBuilderResources({
      capability: "billing",
      integrationPoint: "stripe",
    });
    expect(billing.map((resource) => resource.resourceId)).toContain(
      "core.billing",
    );
    expect(JSON.stringify(billing)).not.toContain("sk_live_");
  });

  it("finds mobile notifications, realtime collaboration and education resources with maturity evidence", () => {
    expect(
      answerBuilderResourceDiscoveryQuestion({
        capability: "notifications",
        platform: "android",
      }).available,
    ).toBe(true);
    expect(
      answerBuilderResourceDiscoveryQuestion({ capability: "collab" }).available,
    ).toBe(true);
    const education = answerBuilderResourceDiscoveryQuestion({
      capability: "education",
    });
    expect(education.available).toBe(true);
    expect(education.strongestMaturity).toBeTruthy();
  });
});

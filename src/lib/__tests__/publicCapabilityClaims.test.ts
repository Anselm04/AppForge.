import { describe, expect, it } from "vitest";
import {
  publicClaimForEvidence,
  type CapabilityEvidence,
} from "../publicCapabilityClaims.js";

const base: CapabilityEvidence = {
  adapter: "verified",
  resource: "verified",
  runtime: "verified",
  platform: "verified",
  regressionHealthy: true,
};

describe("public capability claim truth", () => {
  it("uses the least mature evidence dimension", () => {
    expect(
      publicClaimForEvidence({ ...base, runtime: "runnable" }).maturity,
    ).toBe("runnable");
  });

  it("fails closed when evidence is missing", () => {
    expect(
      publicClaimForEvidence({ ...base, platform: undefined }).maturity,
    ).toBe("planned");
    expect(
      publicClaimForEvidence({ ...base, platform: undefined }).canPromise,
    ).toBe(false);
  });

  it("downgrades public promises after a regression", () => {
    const claim = publicClaimForEvidence({ ...base, regressionHealthy: false });
    expect(claim.maturity).toBe("experimental");
    expect(claim.canPromise).toBe(false);
  });

  it("only permits production language for production-certified evidence", () => {
    const claim = publicClaimForEvidence({
      adapter: "production-certified",
      resource: "production-certified",
      runtime: "production-certified",
      platform: "production-certified",
      regressionHealthy: true,
    });
    expect(claim.canPromise).toBe(true);
    expect(claim.customerLabel).toBe("Production certified");
  });
});

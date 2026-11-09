import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assessProductionDeploymentEvidence } from "../services/deployHealth.js";

describe("production evidence must correspond to real functioning billing", () => {
  it("certifies a hosted product without Stripe when the live product works", () => {
    expect(
      assessProductionDeploymentEvidence({
        hostingSmokePassed: true,
        stripeDetected: false,
      }),
    ).toEqual({
      hostingVerified: true,
      productionVerified: true,
      billingVerified: null,
    });
  });

  it("never certifies a Stripe product from a working homepage alone", () => {
    const assessment = assessProductionDeploymentEvidence({
      hostingSmokePassed: true,
      stripeDetected: true,
    });
    expect(assessment.hostingVerified).toBe(true);
    expect(assessment.productionVerified).toBe(false);
    expect(assessment.billingVerified).toBe(false);
  });

  it("does not mistake reachable billing routes for Stripe connectivity", () => {
    expect(
      assessProductionDeploymentEvidence({
        hostingSmokePassed: true,
        stripeDetected: true,
        billingRoutesPassed: true,
        billingConnected: false,
      }).productionVerified,
    ).toBe(false);
  });

  it("does not accept a healthy billing endpoint when routes are broken", () => {
    expect(
      assessProductionDeploymentEvidence({
        hostingSmokePassed: true,
        stripeDetected: true,
        billingRoutesPassed: false,
        billingConnected: true,
      }).productionVerified,
    ).toBe(false);
  });

  it("requires live hosting plus routes and a verified connected billing provider", () => {
    const valid = assessProductionDeploymentEvidence({
      hostingSmokePassed: true,
      stripeDetected: true,
      billingRoutesPassed: true,
      billingConnected: true,
    });
    expect(valid.productionVerified).toBe(true);
    expect(valid.billingVerified).toBe(true);
    expect(
      assessProductionDeploymentEvidence({
        hostingSmokePassed: false,
        stripeDetected: true,
        billingRoutesPassed: true,
        billingConnected: true,
      }).productionVerified,
    ).toBe(false);
  });

  it("connects the actual customer deploy router to the verification evidence", () => {
    const router = readFileSync(
      resolve(process.cwd(), "src/routers/projects.ts"),
      "utf8",
    );
    const deploy = router.slice(
      router.indexOf("deploy: protectedProcedure"),
      router.indexOf("deployOptions: protectedProcedure"),
    );
    expect(deploy).toContain("await verifyDeployedBilling(result.url)");
    expect(deploy).toContain("assessProductionDeploymentEvidence({");
    expect(deploy).toContain("verified: verification.productionVerified");
    expect(deploy).toContain(
      "productionVerified: verification.productionVerified",
    );
    expect(deploy).toContain("billingConnection,");
    expect(deploy).toContain(
      "productionDestination && result.url && readiness.stripeDetected",
    );
  });
});

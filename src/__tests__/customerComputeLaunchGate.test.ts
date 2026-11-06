import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertCustomerComputeLaunchCertified,
  CUSTOMER_COMPUTE_NOT_CERTIFIED,
} from "../services/customerComputeLaunchGate.js";

describe("fail-closed customer provider-cost release gate", () => {
  it("blocks all non-owner builds in production until provider metering is real", () => {
    for (const owner of [false]) {
      expect(() => assertCustomerComputeLaunchCertified(owner, "production"))
        .toThrow(CUSTOMER_COMPUTE_NOT_CERTIFIED);
    }
    expect(() => assertCustomerComputeLaunchCertified(true, "production"))
      .not.toThrow();
  });

  it("permits zero-spend mocked build qualification outside production", () => {
    expect(() => assertCustomerComputeLaunchCertified(false, "test"))
      .not.toThrow();
    expect(() => assertCustomerComputeLaunchCertified(false, "development"))
      .not.toThrow();
  });

  it("blocks missing and unexpected environment names", () => {
    for (const env of ["", "staging", "preview", "qa", "Production"]) {
      expect(() => assertCustomerComputeLaunchCertified(false, env)).toThrow(CUSTOMER_COMPUTE_NOT_CERTIFIED);
    }
  });

  it("guards both customer admission routes and dequeued worker execution", () => {
    const files = [
      "src/routes/generate.ts",
      "src/routers/projects.ts",
      "src/services/build-worker.ts",
    ];
    for (const file of files) {
      const content = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(content).toContain("assertCustomerComputeLaunchCertified(");
    }
    const rest = readFileSync(
      resolve(process.cwd(), "src/routes/generate.ts"),
      "utf8",
    );
    expect(rest.indexOf("assertCustomerComputeLaunchCertified(owner)"))
      .toBeLessThan(rest.indexOf("const { contract } = await enrichProductContract"));
    const trpc = readFileSync(
      resolve(process.cwd(), "src/routers/projects.ts"),
      "utf8",
    );
    expect(trpc.indexOf("assertCustomerComputeLaunchCertified(owner)"))
      .toBeLessThan(trpc.indexOf("await enrichProductContract("));
    expect(trpc).toContain(
      "assertCustomerComputeLaunchCertified(isOwnerEmail(ctx.user.email))",
    );
    const worker = readFileSync(
      resolve(process.cwd(), "src/services/build-worker.ts"),
      "utf8",
    );
    expect(worker.indexOf("assertCustomerComputeLaunchCertified("))
      .toBeLessThan(worker.indexOf("await runAgentPipeline("));
  });
});

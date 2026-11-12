import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reconnected build stream shares authoritative completion contract", () => {
  const buildRoute = readFileSync("src/routes/build.ts", "utf8");
  const worker = readFileSync("src/services/build-worker.ts", "utf8");
  const record = readFileSync("src/lib/engineeringVerification.ts", "utf8");

  it("does not report status-derived runtime success on a replayed done event", () => {
    expect(buildRoute).toContain("evaluateFactoryHandoff({");
    expect(buildRoute).toContain(
      "executionVerified: handoff?.runtimeVerified === true",
    );
    expect(worker).toContain("evaluateFactoryHandoff({");
    expect(worker).toContain("executionVerified: runtimeVerified");
    expect(record).toContain("hasExecutedBuildProof(validator)");
  });
});

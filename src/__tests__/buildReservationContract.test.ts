import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(process.cwd(), "src/routes/build.ts"), "utf8");
const worker = readFileSync(resolve(process.cwd(), "src/services/build-worker.ts"), "utf8");

describe("build reservation contract", () => {
  it("passes the actual charge state from route to worker", () => {
    expect(route).toContain("const reservationCharged = !unlimited");
    expect(route).toContain("if (reservationCharged)");
    expect(route).toContain("reservationCharged,");
    expect(worker).toContain("reservationCharged: boolean");
  });

  it("keeps unlimited and lifetime builds uncharged", () => {
    expect(route).toContain('credits.tier === "lifetime"');
    expect(route).toContain("const reservationCharged = !unlimited");
  });

  it("refunds only attempts that actually deducted a reservation", () => {
    expect(worker).toContain("if (reservationCharged)");
    expect(worker).toContain("build-refund-${projectId}-${createdAt}");
  });
});

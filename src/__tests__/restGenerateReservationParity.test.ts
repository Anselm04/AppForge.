import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/generate.ts", "utf8");
const start = route.indexOf("let charged = false;");
const end = route.indexOf("res.json({\n      id,", start);
const admission = route.slice(start, end);

describe("REST generation reservation accounting parity", () => {
  it("reserves project credits after the actual debit and before enqueue", () => {
    const debit = admission.indexOf("await deductCredits(");
    const charged = admission.indexOf("charged = true;");
    const reserve = admission.indexOf(
      "await updateProjectCreditsReserved(id, BUILD_CREDIT_COST)",
    );
    const enqueue = admission.indexOf("await enqueueBuild(");
    expect(debit).toBeGreaterThan(-1);
    expect(charged).toBeGreaterThan(debit);
    expect(reserve).toBeGreaterThan(charged);
    expect(enqueue).toBeGreaterThan(reserve);
  });

  it("only releases the reservation after the idempotent credit refund", () => {
    const refund = admission.indexOf("await addCredits(");
    const clear = admission.indexOf("await updateProjectCreditsReserved(id, 0)");
    const failed = admission.indexOf("reconciliationRequired = true;");
    expect(refund).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(refund);
    expect(failed).toBeGreaterThan(clear);
  });
});

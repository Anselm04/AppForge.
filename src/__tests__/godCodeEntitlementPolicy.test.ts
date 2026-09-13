import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("owner god code entitlement policy", () => {
  it("keeps god code generation owner-only and supports timed unlimited access", () => {
    const admin = source("src/routers/admin.ts");
    expect(admin).toContain("createCode: ownerOnlyProcedure");
    expect(admin).toContain('"timed_unlimited"');
    expect(admin).toContain("accessDays");
    expect(admin).toContain("trialDays");
  });

  it("derives unlimited access from an active redeemed god code", () => {
    const db = source("src/db.ts");
    expect(db).toContain("getActiveGodCodeEntitlement");
    expect(db).toContain('code.grantType === "timed_unlimited"');
    expect(db).toContain('code.grantType === "lifetime"');
  });

  it("uses active god code entitlement for project gates instead of raw account flags", () => {
    const projects = source("src/routers/projects.ts");
    expect(projects).toContain("getActiveGodCodeEntitlement");
    expect(projects).toContain("godCodeEntitlement.unlimited");
    expect(projects).not.toContain(
      'const unlimited = !!credits.unlimited || credits.tier === "lifetime";',
    );
  });
});

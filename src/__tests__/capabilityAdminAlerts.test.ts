import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("capability security admin alerts", () => {
  it("exposes only owner-MFA-protected incident diagnostics", () => {
    const router = source("src/routers/capabilitySecurity.ts");
    expect(router).toContain("ownerOnlyProcedure");
    expect(router).toContain("listCapabilitySecurityIncidents");
    expect(router).not.toContain("protectedProcedure");
    expect(router).not.toContain("publicProcedure");
  });

  it("renders persistent capability incidents in the AppForge admin dashboard", () => {
    const admin = source("src/pages/Admin.tsx");
    expect(admin).toContain('"security"');
    expect(admin).toContain("Capability security incidents");
    expect(admin).toContain("capabilitySecurity.incidents");
  });
});

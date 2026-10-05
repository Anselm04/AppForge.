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

  it("renders persistent capability incidents in the AppForge admin dashboard shell", () => {
    const app = source("src/App.tsx");
    const banner = source("src/components/CapabilitySecurityBanner.tsx");
    expect(app).toContain("CapabilitySecurityBanner");
    expect(banner).toContain("Capability security incidents");
    expect(banner).toContain("capabilitySecurity.incidents");
    expect(banner).toContain("admin.mfaStatus");
  });
});

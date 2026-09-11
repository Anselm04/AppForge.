import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  resolve(process.cwd(), "src/integrations/runtime.ts"),
  "utf8",
);
const health = readFileSync(
  resolve(process.cwd(), "src/integrations/health.ts"),
  "utf8",
);
const router = readFileSync(
  resolve(process.cwd(), "src/routers/ecosystem.ts"),
  "utf8",
);
const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

describe("Codex Security runtime bridge", () => {
  it("has separate health and review execution configuration", () => {
    expect(health).toContain("CODEX_SECURITY_HEALTH_URL");
    expect(runtime).toContain("CODEX_SECURITY_EXEC_URL");
    expect(runtime).toContain("CODEX_SECURITY_TOKEN");
    expect(envExample).toContain("CODEX_SECURITY_HEALTH_URL=");
    expect(envExample).toContain("CODEX_SECURITY_EXEC_URL=");
  });

  it("exposes a protected project-owned review route", () => {
    expect(router).toContain("runSecurityReview: protectedProcedure");
    expect(router).toContain("project.userId !== ctx.user.id");
    expect(router).toContain(
      "Project source is too large for a single security review",
    );
    expect(router).toContain("runCodexSecurityReview");
  });

  it("does not expose a raw shell execution contract", () => {
    expect(runtime).toContain(
      '"x-appforge-security-runtime": "codex-security"',
    );
    expect(runtime).not.toContain("shellCommand");
    expect(runtime).not.toContain("execSync");
  });
});

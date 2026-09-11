import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  resolve(process.cwd(), "src/integrations/runtime.ts"),
  "utf8",
);
const router = readFileSync(
  resolve(process.cwd(), "src/routers/ecosystem.ts"),
  "utf8",
);
const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

describe("Sprites agent runtime bridge", () => {
  it("has a server-side execution client", () => {
    expect(runtime).toContain("runSpritesAgentTask");
    expect(runtime).toContain("SPRITES_EXEC_URL");
    expect(runtime).toContain("SPRITES_API_TOKEN");
    expect(runtime).toContain('"x-appforge-agent-runtime": "sprites"');
  });

  it("exposes only a protected bounded task route", () => {
    expect(router).toContain("runAgentTask: protectedProcedure");
    expect(router).toContain("max(20_000)");
    expect(router).toContain("Agent task context is too large");
    expect(router).toContain("project.userId !== ctx.user.id");
  });

  it("documents the execution endpoint", () => {
    expect(envExample).toContain("SPRITES_EXEC_URL=");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(
  resolve(process.cwd(), "src/routers/projects.ts"),
  "utf8",
);
const buildPage = readFileSync(
  resolve(process.cwd(), "src/pages/Build.tsx"),
  "utf8",
);
const deploy = router.slice(
  router.indexOf("deploy: protectedProcedure"),
  router.indexOf("deployOptions: protectedProcedure"),
);

describe("preview and actual deployment evidence are distinct", () => {
  it("counts only real production destinations as hosted deployments", () => {
    expect(deploy).toContain("if (productionDestination) {");
    expect(deploy).toContain("await recordDeploy(ctx.user.id)");
    const record = deploy.indexOf("await recordDeploy(ctx.user.id)");
    const guard = deploy.lastIndexOf("if (productionDestination)", record);
    expect(guard).toBeGreaterThan(-1);
    expect(record - guard).toBeLessThan(160);
  });

  it("does not label a preview as a verified live URL in evidence", () => {
    expect(deploy).toContain(
      'kind: productionDestination ? "deployment" : "validation"',
    );
    expect(deploy).toContain("productionVerified:");
    expect(deploy).toContain(
      "liveUrl: productionDestination ? (result.url ?? null) : null",
    );
    expect(deploy).toContain(
      'input.destination === "preview" ? (result.url ?? null) : null',
    );
    expect(deploy).toContain(
      'input.destination === "preview" ? "validation" : "deployment"',
    );
  });

  it("shows the customer an explicit preview label", () => {
    expect(buildPage).toContain('lastDeployDestination === "preview"');
    expect(buildPage).toContain('"Open Preview"');
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { zipFiles } from "../services/deployer.js";

const source = readFileSync(
  resolve(process.cwd(), "src/routers/projects.ts"),
  "utf8",
);
const deploy = source.slice(
  source.indexOf("deploy: protectedProcedure"),
  source.indexOf("download: protectedProcedure"),
);
const zipBranch = deploy.slice(
  deploy.indexOf('if (input.destination === "zip")'),
  deploy.indexOf("const deployableStatuses"),
);
const deploymentBranch = deploy.slice(deploy.indexOf("const deployableStatuses"));

describe("projects.deploy ZIP source backup", () => {
  it("requires project ownership before exporting any working source", () => {
    expect(deploy.indexOf("project.userId !== ctx.user.id")).toBeGreaterThan(-1);
    expect(deploy.indexOf("project.userId !== ctx.user.id")).toBeLessThan(
      deploy.indexOf('if (input.destination === "zip")'),
    );
  });

  it("returns the saved source before validated-only deployment checks", () => {
    expect(zipBranch).toContain("getEditableProjectFiles(input.id)");
    expect(zipBranch).toContain("zipFiles(");
    expect(zipBranch).toContain('sourceStatus: "latest-saved-working-source"');
    expect(zipBranch).toContain("productionCertified: false");
    expect(zipBranch).not.toContain("getCurrentArtifact");
    expect(zipBranch).not.toContain("assertProjectExportComplete");
    expect(deploymentBranch).toContain("getCurrentArtifact(input.id)");
    expect(deploymentBranch).toContain("assertArtifactMatchesWorkingFiles");
  });

  it("refuses credentials and empty source before ZIP creation", () => {
    expect(zipBranch).toContain("Object.keys(workingFiles).length === 0");
    expect(zipBranch).toContain("isSafeTemplatePath(path)");
    expect(zipBranch).toContain("isSafeTemplateContent(content)");
    expect(zipBranch).toContain('code: "PRECONDITION_FAILED"');
  });

  it("preserves newer unvalidated edits verbatim in the source archive", async () => {
    const saved = {
      "src/feature.ts": "export const revision = 3;",
      "README.md": "# Current working copy",
    };
    const archive = await zipFiles("current-project", saved);
    const zip = await JSZip.loadAsync(Buffer.from(archive.base64, "base64"));
    expect(await zip.file("src/feature.ts")?.async("string")).toBe(
      saved["src/feature.ts"],
    );
  });
});

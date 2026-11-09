import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { zipFiles } from "../services/deployer.js";

const routerSource = readFileSync(
  resolve(process.cwd(), "src/routers/projects.ts"),
  "utf8",
);
const downloadProcedure = routerSource.slice(
  routerSource.indexOf("download: protectedProcedure"),
  routerSource.indexOf("// ── Senior Dev Agent: Create Task"),
);

describe("download latest saved customer working source", () => {
  it("uses owner-checked editable source rather than the last validated artifact", () => {
    expect(downloadProcedure).toContain("project.userId !== ctx.user.id");
    expect(downloadProcedure).toContain("getEditableProjectFiles(input.id)");
    expect(downloadProcedure).not.toContain("getCurrentArtifact(input.id)");
    expect(downloadProcedure).not.toContain(
      "assertArtifactMatchesWorkingFiles",
    );
    expect(downloadProcedure).toContain(
      'sourceStatus: "latest-saved-working-source"',
    );
    expect(downloadProcedure).toContain("productionCertified: false");
  });

  it("rejects sensitive paths or credentials before creating the archive", () => {
    expect(downloadProcedure).toContain("isSafeTemplatePath(path)");
    expect(downloadProcedure).toContain("isSafeTemplateContent(content)");
    expect(downloadProcedure).toContain('"PRECONDITION_FAILED"');
  });

  it("archives the newer saved edit verbatim even if it differs from the validated source", async () => {
    const latestWorkingSource = {
      "src/main.ts": "export const revision = 2;",
      "README.md": "# Saved source backup",
    };
    const archive = await zipFiles("Saved project", latestWorkingSource);
    const contents = await JSZip.loadAsync(
      Buffer.from(archive.base64, "base64"),
    );
    expect(await contents.file("src/main.ts")?.async("string")).toBe(
      "export const revision = 2;",
    );
  });
});

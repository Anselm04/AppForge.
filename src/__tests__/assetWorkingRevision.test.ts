import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateAssetAttachment } from "../routers/assets.js";

describe("customer asset upload integrity", () => {
  it("saves uploaded assets through the conflict-safe working editor", () => {
    const source = readFileSync("src/routers/assets.ts", "utf8");
    expect(source).toContain("commitValidatedProjectFileEdit({");
    expect(source).toContain("allowCreate: true");
    expect(source).toContain("skipValidation: true");
    expect(source).not.toContain("updateProjectFiles(input.projectId");
    expect(source).not.toContain("getProjectFiles(input.projectId");
    expect(source).toContain(".delete(schema.projectAssets)");
  });

  it("rejects unsafe asset filenames", () => {
    expect(() =>
      validateAssetAttachment({
        filename: "../escape.svg",
        mimeType: "image/svg+xml",
        content: "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
      }),
    ).toThrow();
  });
});

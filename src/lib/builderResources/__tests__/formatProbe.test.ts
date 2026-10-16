import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as prettier from "prettier";
import { describe, it } from "vitest";

const TARGETS = [
  "src/lib/builderResources/__tests__/domainRuntimeResources.test.ts",
  "src/lib/builderResources/__tests__/goldenResourceLibrary.test.ts",
  "src/lib/builderResources/domainFeatureContracts.ts",
  "src/lib/builderResources/domainRuntimeResources.ts",
  "src/lib/builderResources/resourceMaterialization.ts",
  "src/lib/builderResources/resourcePlanning.ts",
] as const;

describe("temporary Builder Resource formatting probe", () => {
  it("prints exact Prettier patches for remaining changed sources", async () => {
    const directory = mkdtempSync(join(tmpdir(), "appforge-prettier-"));
    try {
      for (const target of TARGETS) {
        const source = readFileSync(target, "utf8");
        const formatted = await prettier.format(source, {
          filepath: target,
        });
        if (source === formatted) continue;

        const originalPath = join(directory, "original.ts");
        const formattedPath = join(directory, "formatted.ts");
        writeFileSync(originalPath, source);
        writeFileSync(formattedPath, formatted);
        const diff = spawnSync(
          "diff",
          ["-u", "--label", target, originalPath, "--label", target, formattedPath],
          { encoding: "utf8" },
        ).stdout;
        console.error(`PRETTIER_PATCH_BEGIN ${target}\n${diff}PRETTIER_PATCH_END ${target}`);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { format } from "prettier";
import { describe, expect, it } from "vitest";

describe("temporary Section 24 format diagnostics", () => {
  it("prints exact Prettier diffs", async () => {
    const paths = [
      "src/__tests__/section24RecoveryRollback.test.ts",
      "src/routers/projects.ts",
      "src/services/recovery.ts",
    ];
    const root = mkdtempSync(join(tmpdir(), "appforge-prettier-"));
    const diffs: string[] = [];

    for (const path of paths) {
      const original = readFileSync(path, "utf8");
      const formatted = await format(original, { filepath: path });
      if (formatted === original) continue;
      const target = join(root, basename(path));
      writeFileSync(target, formatted);
      try {
        execFileSync("diff", ["-u", path, target], { encoding: "utf8" });
      } catch (error) {
        const output = (error as { stdout?: string }).stdout ?? "";
        diffs.push(output);
      }
    }

    console.log(diffs.join("\n"));
    expect(diffs).toEqual([]);
  });
});

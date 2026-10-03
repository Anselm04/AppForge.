import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "prettier";
import { it } from "vitest";

it("prints canonical continuity-test formatting", async () => {
  const target = resolve(
    process.cwd(),
    "src/__tests__/production-build-session-continuity-contract.test.ts",
  );
  const source = readFileSync(target, "utf8");
  throw new Error(await format(source, { parser: "typescript" }));
});

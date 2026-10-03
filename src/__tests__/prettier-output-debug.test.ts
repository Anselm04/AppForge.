import { readFileSync } from "node:fs";
import { format } from "prettier";
import { it } from "vitest";

it("prints canonical continuity-test formatting", async () => {
  const target = new URL(
    "./production-build-session-continuity-contract.test.ts",
    import.meta.url,
  );
  const source = readFileSync(target, "utf8");
  throw new Error(await format(source, { parser: "typescript" }));
});

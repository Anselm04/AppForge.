import { readFileSync } from "node:fs";
import { format } from "prettier";
import { it } from "vitest";

it("prints canonical Prettier output for Section 16 scanner", async () => {
  const source = readFileSync("src/services/requestTaintScanner.ts", "utf8");
  const formatted = await format(source, { parser: "typescript" });
  throw new Error(
    "PRETTIER_OUTPUT_BEGIN\n" + formatted + "\nPRETTIER_OUTPUT_END",
  );
});

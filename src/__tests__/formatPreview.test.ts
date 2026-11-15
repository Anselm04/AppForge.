import { readFileSync } from "node:fs";
import { format } from "prettier";
import { it } from "vitest";

it("prints the exact Prettier form of the generated export test for repair", async () => {
  const source = readFileSync("src/__tests__/generatedExecutableExport.integration.test.ts", "utf8");
  const formatted = await format(source, { parser: "typescript" });
  console.log("APPFORGE_FORMAT_BEGIN" + Buffer.from(formatted).toString("base64") + "APPFORGE_FORMAT_END");
});

import { readFileSync } from "node:fs";
import { format } from "prettier";
import { it } from "vitest";

it("reports exact formatter output for executable export test", async () => {
  const source = readFileSync("src/__tests__/generatedExecutableExport.integration.test.ts", "utf8");
  const output = await format(source, { parser: "typescript" });
  process.stdout.write("APPFORGE_FORMAT_BEGIN" + Buffer.from(output).toString("base64") + "APPFORGE_FORMAT_END\n");
});

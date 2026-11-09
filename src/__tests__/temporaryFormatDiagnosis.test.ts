import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it } from "vitest";

it("temporary: show precise formatting difference in export router", () => {
  const path = "src/routers/github.ts";
  const original = readFileSync(path, "utf8").split("\n");
  const formatted = execFileSync(
    "node_modules/.bin/prettier",
    [path],
    { encoding: "utf8" },
  ).split("\n");
  for (let index = 0; index < Math.max(original.length, formatted.length); index++) {
    if (original[index] !== formatted[index]) {
      console.log("EXPORT_FORMAT_DIAG at line", index + 1);
      console.log("BEFORE:", JSON.stringify(original.slice(Math.max(0, index - 3), index + 15)));
      console.log("EXPECTED:", JSON.stringify(formatted.slice(Math.max(0, index - 3), index + 15)));
      return;
    }
  }
});

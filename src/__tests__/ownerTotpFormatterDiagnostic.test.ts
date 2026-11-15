import { readFileSync } from "node:fs";
import { format } from "prettier";
import { it } from "vitest";

it("emits canonical source formatting for TOTP integration repair", async () => {
  for (const path of [
    "src/services/ownerTotp.ts",
    "src/routers/admin.ts",
    "src/pages/Admin.tsx",
    "src/__tests__/ownerTotp.test.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    const formatted = await format(source, {
      parser: "typescript",
    });
    process.stdout.write(
      "APPFORGE_PRETTIER_" + path.replace(/\//g, "_").replace(/\./g, "_") +
        "_BEGIN" + Buffer.from(formatted).toString("base64") +
        "_END\n",
    );
  }
});

import { readFileSync } from "node:fs";
import { format, resolveConfig, check } from "prettier";
import { it } from "vitest";

it("diagnoses exact CLI formatter settings for owner router", async () => {
  const path = "src/routers/admin.ts";
  const source = readFileSync(path, "utf8");
  const options = {
    ...(await resolveConfig(path)),
    filepath: path,
  };
  const formatted = await format(source, options);
  const accepted = await check(source, options);
  process.stdout.write(
    "APPFORGE_OWNER_ROUTER_CHECK=" + String(accepted) + "\n" +
    "APPFORGE_OWNER_ROUTER_FORMAT_BEGIN" +
    Buffer.from(formatted).toString("base64") +
    "APPFORGE_OWNER_ROUTER_FORMAT_END\n",
  );
});

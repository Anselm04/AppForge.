import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prettier from "prettier";

describe("temporary provider envelope formatting diagnostic", () => {
  it("prints the exact Prettier replacement", async () => {
    const filename = resolve(process.cwd(), "src/lib/providerCostEnvelope.ts");
    const before = readFileSync(filename, "utf8");
    const config = (await prettier.resolveConfig(filename)) ?? {};
    const after = await prettier.format(before, {
      ...config,
      filepath: filename,
    });
    const b = before.split("\n");
    const a = after.split("\n");
    let prefix = 0;
    while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix++;
    let suffix = 0;
    while (suffix < Math.min(a.length, b.length) - prefix &&
      a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++;
    console.log("PROVIDER_PRETTIER_DIFF", JSON.stringify({
      prefix,
      old: b.slice(prefix, b.length - suffix),
      replacement: a.slice(prefix, a.length - suffix),
      suffix,
    }));
  });
});

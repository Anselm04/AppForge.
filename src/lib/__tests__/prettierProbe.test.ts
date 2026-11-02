import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import * as prettier from "prettier";

describe("temporary formatter probe", () => {
  it("prints the canonical twilioSms formatting when it differs", async () => {
    const path = "src/lib/twilioSms.ts";
    const source = await readFile(path, "utf8");
    const formatted = await prettier.format(source, { filepath: path });

    if (formatted !== source) {
      throw new Error(
        `PRETTIER_OUTPUT_BASE64:${Buffer.from(formatted, "utf8").toString("base64")}`,
      );
    }

    expect(formatted).toBe(source);
  });
});

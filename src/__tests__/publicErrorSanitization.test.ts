import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkout = readFileSync(
  resolve(process.cwd(), "src/routes/checkout.ts"),
  "utf8",
);
const generate = readFileSync(
  resolve(process.cwd(), "src/routes/generate.ts"),
  "utf8",
);

describe("public error sanitization", () => {
  it("does not expose raw checkout exceptions", () => {
    expect(checkout).toContain('error: "checkout_failed"');
    expect(checkout).not.toContain("err instanceof Error ? err.message");
  });

  it("does not expose raw generate exceptions", () => {
    expect(generate).toContain('logger.error({ error: err }, "generate_failed")');
    expect(generate).toContain('error: "generate_failed"');
    expect(generate).not.toContain('console.error("generate failed:"');
    expect(generate).not.toContain("err instanceof Error ? err.message");
  });
});

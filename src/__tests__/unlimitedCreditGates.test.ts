import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("unlimited credit entitlement gates", () => {
  it("project chat Senior Dev trigger honors unlimited/lifetime accounts", () => {
    const text = source("src/routers/projectChat.ts");
    expect(text).toContain(
      'const unlimited = !!credits.unlimited || credits.tier === "lifetime";',
    );
    expect(text).toContain(
      "if (!unlimited && credits.balance < SENIOR_DEV_CREDIT_COST)",
    );
  });

  it("main build and Senior Dev start gates honor unlimited/lifetime accounts", () => {
    const createText = source("src/routers/projects.ts");
    const streamText = source("src/routes/build.ts");
    expect(createText).toContain(
      'const unlimited = !!credits.unlimited || credits.tier === "lifetime";',
    );
    expect(streamText).toContain(
      'const seniorUnlimited = !!credits.unlimited || credits.tier === "lifetime";',
    );
    expect(streamText).toContain(
      "if (!seniorUnlimited && credits.balance < SENIOR_DEV_BASE_COST)",
    );
  });
});

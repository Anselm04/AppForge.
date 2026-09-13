import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("owner God Code unlimited entitlement gates", () => {
  it("project chat Senior Dev trigger trusts only an active owner God Code entitlement", () => {
    const text = source("src/routers/projectChat.ts");
    expect(text).toContain("getActiveGodCodeEntitlement");
    expect(text).toContain("const unlimited = godCodeEntitlement.unlimited;");
    expect(text).toContain(
      "if (!unlimited && credits.balance < SENIOR_DEV_CREDIT_COST)",
    );
    expect(text).not.toContain(
      'const unlimited = !!credits.unlimited || credits.tier === "lifetime";',
    );
  });

  it("main build and Senior Dev start gates trust only active owner God Code entitlements", () => {
    const createText = source("src/routers/projects.ts");
    const streamText = source("src/routes/build.ts");
    expect(createText).toContain("getActiveGodCodeEntitlement");
    expect(createText).toContain("const unlimited = godCodeEntitlement.unlimited;");
    expect(streamText).toContain("getActiveGodCodeEntitlement");
    expect(streamText).toContain("const seniorUnlimited = seniorGodCode.unlimited;");
    expect(streamText).toContain(
      "if (!seniorUnlimited && credits.balance < SENIOR_DEV_BASE_COST)",
    );
    expect(createText).not.toContain(
      'const unlimited = !!credits.unlimited || credits.tier === "lifetime";',
    );
  });
});

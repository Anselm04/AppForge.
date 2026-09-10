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
const legacyCompat = readFileSync(
  resolve(process.cwd(), "src/routes/legacyCompat.ts"),
  "utf8",
);
const serverlessCheckout = readFileSync(
  resolve(process.cwd(), "api/checkout.js"),
  "utf8",
);
const buildWorker = readFileSync(
  resolve(process.cwd(), "src/services/build-worker.ts"),
  "utf8",
);

describe("public error sanitization", () => {
  it("does not expose raw checkout exceptions", () => {
    expect(checkout).toContain('error: "checkout_failed"');
    expect(checkout).not.toContain("err instanceof Error ? err.message");
  });

  it("does not expose raw generate exceptions", () => {
    expect(generate).toContain(
      'logger.error({ error: err }, "generate_failed")',
    );
    expect(generate).toContain('error: "generate_failed"');
    expect(generate).not.toContain('console.error("generate failed:"');
    expect(generate).not.toContain("err instanceof Error ? err.message");
  });

  it("does not expose raw compatibility-route exceptions", () => {
    expect(legacyCompat).toContain("legacy_apps_list_failed");
    expect(legacyCompat).toContain("legacy_app_load_failed");
    expect(legacyCompat).toContain("legacy_credits_load_failed");
    expect(legacyCompat).not.toContain("err?.message");
  });

  it("does not expose Stripe provider errors from serverless checkout", () => {
    expect(serverlessCheckout).toContain(
      'error: "Unable to start checkout."',
    );
    expect(serverlessCheckout).not.toContain("session.error?.message");
  });

  it("does not expose raw build-worker exceptions through SSE or project status", () => {
    expect(buildWorker).toContain('error: "build_failed"');
    expect(buildWorker).toContain(
      'message: "Build failed. Please retry or contact support."',
    );
    expect(buildWorker).toContain(
      'updateProjectStatus(projectId, "failed", "build_failed")',
    );
    expect(buildWorker).not.toContain('write("error", { message: msg })');
  });
});

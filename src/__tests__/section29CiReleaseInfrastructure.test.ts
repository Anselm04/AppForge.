import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deployProject } from "../services/deployer.js";

function workflow(path: string): string {
  return readFileSync(path, "utf8");
}

describe("#29 CI and Release Infrastructure", () => {
  it("makes product-factory validation an explicit release prerequisite", () => {
    const ci = workflow(".github/workflows/ci.yml");

    expect(ci).toContain("product_factory_validation:");
    expect(ci).toContain("name: Product Factory Validation");
    expect(ci).toContain("src/lib/__tests__/productContract.test.ts");
    expect(ci).toContain("src/lib/__tests__/productPlan.test.ts");
    expect(ci).toContain("src/__tests__/researchSystem.test.ts");
    expect(ci).toContain("src/__tests__/researchEvidence.test.ts");
    expect(ci).toContain("src/lib/__tests__/generatedProjectStructure.test.ts");
    expect(ci).toContain("src/lib/__tests__/codeGeneration.test.ts");
    expect(ci).toContain("src/lib/__tests__/incompleteProduct.test.ts");
    expect(ci).toContain("src/__tests__/productionIsolation.test.ts");
    expect(ci).toContain("src/__tests__/generatedSecurity.test.ts");
    expect(ci).toContain("src/__tests__/section24RecoveryRollback.test.ts");
    expect(ci).toContain("src/__tests__/selfHealingRecoveryGuardrails.test.ts");
    expect(ci).toContain(
      "needs: [lint, typecheck, test, security, product_factory_validation]",
    );
    expect(ci).toContain(
      "needs: [lint, typecheck, test, security, product_factory_validation, build]",
    );
    expect(ci).toContain(
      'test "${{ needs.product_factory_validation.result }}" = success',
    );
  });

  it("requires SHA-256 integrity evidence for CI and preview artifacts", () => {
    const ci = workflow(".github/workflows/ci.yml");
    const preview = workflow(".github/workflows/deploy-preview.yml");

    for (const source of [ci, preview]) {
      expect(source).toContain("SHA256SUMS.txt");
      expect(source).toContain("sha256sum -c SHA256SUMS.txt");
    }
    expect(ci).toContain("build-output-${{ github.sha }}");
    expect(preview).toContain(
      "preview-build-${{ github.event.pull_request.head.sha }}",
    );
  });

  it("boots a real hermetic PR preview runtime instead of claiming Vercel deployed it", () => {
    const preview = workflow(".github/workflows/deploy-preview.yml");

    expect(preview).toContain(
      "Boot exact PR preview deployment and require liveness",
    );
    expect(preview).toContain("node dist/server.js");
    expect(preview).toContain("http://127.0.0.1:3200/api/health/live");
    expect(preview).not.toContain(
      "Vercel GitHub app handles preview URLs for this PR",
    );
  });

  it("blocks production unless exact-sha CI and security evidence are green", () => {
    const production = workflow(".github/workflows/deploy-production.yml");

    expect(production).toContain("actions: read");
    expect(production).toContain(
      "Require successful exact-SHA CI and security evidence",
    );
    expect(production).toContain(
      'require_workflow_success "ci.yml" "CI Pipeline"',
    );
    expect(production).toContain(
      'require_workflow_success "security.yml" "Security Scanning"',
    );
    expect(production).toContain("select(.head_sha == $sha)");
    expect(production).toContain(
      '[ "$status" = "completed" ] && [ "$conclusion" = "success" ]',
    );
    expect(production).toContain(
      "No successful completed $label run found for exact release SHA $RELEASE_SHA.",
    );
    expect(production).toContain("Refuse stale release SHA");
    expect(production).toContain("Refuse stale deploy SHA");
    expect(production).toContain("Verify Fly is running the released commit");
    expect(production).not.toContain("continue-on-error: true");
  });

  it("waits for dependency-aware production readiness and exposes the failure reason", () => {
    const production = workflow(".github/workflows/deploy-production.yml");

    expect(production).toContain("Waiting for production readiness");
    expect(production).toContain('"$URL/api/health/ready"');
    expect(production).toContain('if [ "$readiness_status" = "200" ]');
    expect(production).toContain("cat \"$readiness_body\" || true");
    expect(production).toContain("Production readiness check failed after deploy");
    expect(production).not.toContain(
      'curl --fail --silent --show-error --retry 3 --retry-delay 2 --retry-all-errors --max-time 10 "$URL/api/health/ready" >/dev/null',
    );
  });

  it("keeps the real AppForge preview deployment path deterministic", async () => {
    await expect(
      deployProject({
        destination: "preview",
        projectName: "Section 29 Preview",
        projectId: 29,
        previewBaseUrl: "https://preview.example.test/",
        files: {
          "package.json": "{}",
        },
      }),
    ).resolves.toEqual({
      destination: "preview",
      url: "https://preview.example.test/apps/29",
    });

    await expect(
      deployProject({
        destination: "preview",
        projectName: "Missing Project",
        previewBaseUrl: "https://preview.example.test",
        files: {
          "package.json": "{}",
        },
      }),
    ).rejects.toThrow(/projectId required for preview deploy/i);
  });
});

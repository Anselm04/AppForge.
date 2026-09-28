import { describe, expect, it } from "vitest";
import { getStackScaffold } from "../../services/stackScaffolds.js";
import {
  createDeploymentAuditRecord,
  createProductionDeploymentManifest,
  validateDeploymentSource,
} from "../deploymentImplementation.js";
import {
  validateProductContract,
  type ProductContract,
} from "../productContract.js";

function contract(overrides: Partial<ProductContract> = {}): ProductContract {
  return validateProductContract({
    version: 2,
    originalPrompt:
      "Build a production SaaS task tracker with authentication, database persistence, health checks and deployment.",
    productType: "saas_application",
    productFamilies: ["frontend", "backend", "database", "deployment"],
    targetUsers: ["Teams"],
    userRoles: ["member", "admin"],
    coreWorkflows: ["Create tasks", "Complete tasks"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Members can create tasks.",
        category: "workflow",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["Production-ready runtime"],
    dataModels: ["Task"],
    integrations: [],
    securityRequirements: ["Validate all input"],
    deploymentRequirements: [
      "Deploy a runnable artifact over HTTPS with health verification.",
    ],
    monetizationRequirements: [],
    selectedTechnologyStack: "react-node",
    researchRequirements: [],
    runtimeRequirements: ["Browser and Node runtime"],
    secondaryCapabilities: ["authentication", "database", "deployment"],
    intentConfidence: 0.99,
    canonicalInterpretation: "A production team task-tracking SaaS.",
    ...overrides,
  });
}

function filesFor(c: ProductContract): Record<string, string> {
  return {
    ...getStackScaffold(c.selectedTechnologyStack, c.productType),
    "database/schema.sql":
      "CREATE TABLE tasks (id text primary key, title text not null);",
  };
}

describe("Section 22 deployment implementation", () => {
  it("accepts stack/runtime metadata and required environment artifacts", () => {
    const c = contract();
    expect(
      validateDeploymentSource({
        files: filesFor(c),
        productContract: c,
        destination: "fly",
      }),
    ).toEqual([]);
  });

  it("rejects untrusted or unsupported destinations before provider contact", () => {
    const c = contract();
    const files = filesFor(c);

    expect(
      validateDeploymentSource({
        files,
        productContract: c,
        destination: "attacker-host",
      }),
    ).toContain("untrusted production destination attacker-host");

    expect(
      validateDeploymentSource({
        files,
        productContract: c,
        destination: "github-pages",
      }).some((problem) =>
        /does not support deployment destination/.test(problem),
      ),
    ).toBe(true);
  });

  it("fails closed when required environment/config artifacts are missing", () => {
    const c = contract();
    const files = filesFor(c);
    delete files[".env.example"];

    expect(
      validateDeploymentSource({
        files,
        productContract: c,
        destination: "fly",
      }),
    ).toContain("missing required environment/config artifact .env.example");
  });

  it("requires database migration/schema evidence for database-backed products", () => {
    const c = contract();
    const files = filesFor(c);
    delete files["database/schema.sql"];

    expect(
      validateDeploymentSource({
        files,
        productContract: c,
        destination: "fly",
      }),
    ).toContain("database-backed deployment has no migration/schema artifact");
  });

  it("materializes the full production deployment policy and artifact identity", () => {
    const c = contract();
    const manifest = createProductionDeploymentManifest({
      files: filesFor(c),
      productContract: c,
      destination: "fly",
      artifactSha256: "a".repeat(64),
      artifactVersion: 7,
    });

    expect(manifest.version).toBe(2);
    expect(manifest.stack).toBe("react-node");
    expect(manifest.environment.failClosedWhenMissing).toBe(true);
    expect(manifest.tls).toEqual({ required: true, forceHttps: true });
    expect(manifest.assets.verifyReferencedAssets).toBe(true);
    expect(manifest.database.required).toBe(true);
    expect(manifest.workers.requireSingleWriterOrIdempotency).toBe(true);
    expect(manifest.scheduledJobs.requireSingleWriterOrIdempotency).toBe(true);
    expect(manifest.scaling).toEqual({
      minInstances: 1,
      maxInstances: 3,
      autoscale: true,
    });
    expect(manifest.resources.memoryMb).toBe(512);
    expect(manifest.reliability).toMatchObject({
      deployAttempts: 3,
      deployTimeoutMs: 300000,
      healthTimeoutMs: 15000,
      rollbackStrategy: "previous_verified_artifact",
      rollbackRequired: true,
    });
    expect(manifest.tracking).toMatchObject({
      artifactHashAlgorithm: "sha256",
      artifactSha256: "a".repeat(64),
      artifactVersion: 7,
      auditRequired: true,
    });
  });

  it("creates a versioned deployment audit record after verification", () => {
    const c = contract();
    const manifest = createProductionDeploymentManifest({
      files: filesFor(c),
      productContract: c,
      destination: "fly",
      artifactSha256: "b".repeat(64),
      artifactVersion: 9,
    });
    const audit = createDeploymentAuditRecord({
      projectId: 123,
      manifest,
      liveUrl: "https://example.test/",
      verifiedAt: "2026-09-28T06:00:00.000Z",
    });

    expect(audit).toMatchObject({
      event: "production_deployment_verified",
      destination: "fly",
      stack: "react-node",
      artifactSha256: "b".repeat(64),
      artifactVersion: 9,
      verifiedAt: "2026-09-28T06:00:00.000Z",
      liveUrl: "https://example.test/",
    });
    expect(audit.id).toMatch(/^[a-f0-9]{24}$/);
  });

  it("rejects scheduled jobs when the selected runtime cannot host them", () => {
    const c = contract({
      originalPrompt: "Build a static website with a daily scheduled job.",
      productType: "website",
      productFamilies: ["frontend", "deployment"],
      dataModels: [],
      selectedTechnologyStack: "static-site",
      secondaryCapabilities: ["deployment"],
      canonicalInterpretation: "A static website with a daily scheduled job.",
    });

    expect(
      validateDeploymentSource({
        files: filesFor(c),
        productContract: c,
        destination: "fly",
      }),
    ).toContain("stack static-site does not support requested scheduled jobs");
  });
});

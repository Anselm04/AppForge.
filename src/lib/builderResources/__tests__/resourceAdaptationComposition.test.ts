import { describe, expect, it } from "vitest";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifestInput,
} from "../resourceManifest.js";
import {
  adaptBuilderResource,
  type ResourceAdaptationRequest,
} from "../resourceAdaptation.js";
import { composeBuilderResources } from "../resourceComposition.js";

function resource(
  id: string,
  options: {
    configurableFields?: string[];
    composition?: BuilderResourceManifestInput["composition"];
  } = {},
): BuilderResourceManifestInput {
  return {
    identity: {
      resourceId: id,
      name: id,
      category: "core",
      resourceType: "module",
      version: "1.0.0",
    },
    compatibility: {
      supportedProductTypes: ["*"],
      supportedTechnologyStacks: ["flutter-node"],
      supportedRuntimes: ["flutter", "node"],
      supportedPlatforms: ["android", "ios", "web"],
      incompatibleCombinations: [],
      minimumRuntimeToolVersions: {},
    },
    capabilities: {
      capabilitiesProvided: ["mobile"],
      optionalCapabilities: [],
      dependencies: [],
      integrationPoints: [],
    },
    contracts: {
      inputContract: {},
      outputContract: {},
      apiContract: null,
      dataContract: null,
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: options.configurableFields ?? [
        "branding.primaryColor",
      ],
      replacementPoints: ["ui.header"],
      brandingHooks: ["branding.primaryColor"],
      localizationHooks: ["locale.default"],
      authorizationHooks: ["auth.roles"],
      databaseHooks: ["database.tablePrefix"],
      extensionPoints: ["feature.extra"],
    },
    composition: options.composition ?? {
      routes: [],
      databaseMigrations: [],
      environmentVariables: [],
      packages: {},
      stateNamespaces: [],
      navigationKeys: [],
      permissions: [],
      stylingTokens: [],
      platformCapabilities: [],
      deploymentRequirements: [],
    },
    evidence: {
      unitTests: ["unit"],
      integrationTests: ["integration"],
      behavioralTests: ["behavior"],
      buildEvidence: ["build"],
      runtimeEvidence: ["runtime"],
      securityEvidence: ["security"],
      accessibilityEvidence: [],
      performanceEvidence: [],
      reproducibilityEvidence: ["repro"],
      lastVerifiedAt: "2026-10-16T00:00:00.000Z",
      evidenceLedgerIds: ["ledger"],
      adapterEvidence: {
        discovered: true,
        installVerified: true,
        compileOrBuildVerified: true,
        testsVerified: true,
        runtimeVerified: true,
        packageVerified: true,
        deploymentVerified: true,
        securityScanVerified: true,
        behavioralVerified: true,
        reproducibleBuild: true,
      },
    },
    governance: {
      provenance: "appforge-internal",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: [],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: "production-certified",
      quarantine: null,
    },
  };
}

describe("Builder Resource adaptation", () => {
  it("accepts declared adaptation points and records a deterministic adaptation plan", () => {
    const source = parseBuilderResourceManifest(
      resource("core.profile", {
        configurableFields: ["profile.fields", "branding.primaryColor"],
      }),
    );
    const request: ResourceAdaptationRequest = {
      resource: source,
      configuration: {
        "profile.fields": ["displayName", "phone"],
        "branding.primaryColor": "#c4a35a",
      },
      productId: "product-123",
    };

    const plan = adaptBuilderResource(request);

    expect(plan.resourceId).toBe("core.profile");
    expect(plan.resourceVersion).toBe("1.0.0");
    expect(plan.productId).toBe("product-123");
    expect(plan.changes.map((change) => change.path)).toEqual([
      "branding.primaryColor",
      "profile.fields",
    ]);
    expect(plan.adaptationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects undeclared adaptation points instead of silently mutating a proven resource", () => {
    const source = parseBuilderResourceManifest(resource("core.profile"));

    expect(() =>
      adaptBuilderResource({
        resource: source,
        configuration: { "database.rawSql": "drop table users" },
        productId: "product-123",
      }),
    ).toThrow(/not an allowed adaptation point/i);
  });
});

describe("Builder Resource composition", () => {
  it("combines compatible resources into one deterministic composition plan", () => {
    const auth = parseBuilderResourceManifest(
      resource("core.auth", {
        composition: {
          routes: ["POST /api/auth/login"],
          databaseMigrations: ["001_auth.sql"],
          environmentVariables: ["AUTH_ISSUER"],
          packages: { zod: "^3.23.8" },
          stateNamespaces: ["auth"],
          navigationKeys: ["login"],
          permissions: ["secure-storage"],
          stylingTokens: ["auth.surface"],
          platformCapabilities: ["biometrics"],
          deploymentRequirements: ["https"],
        },
      }),
    );
    const billing = parseBuilderResourceManifest(
      resource("core.billing", {
        composition: {
          routes: ["POST /api/billing/checkout"],
          databaseMigrations: ["002_billing.sql"],
          environmentVariables: ["STRIPE_SECRET_KEY"],
          packages: { stripe: "^23.0.0", zod: "^3.23.8" },
          stateNamespaces: ["billing"],
          navigationKeys: ["pricing"],
          permissions: [],
          stylingTokens: ["billing.price"],
          platformCapabilities: [],
          deploymentRequirements: ["webhooks"],
        },
      }),
    );

    const composition = composeBuilderResources([auth, billing]);

    expect(composition.ok).toBe(true);
    expect(composition.conflicts).toEqual([]);
    expect(composition.resources).toEqual([
      "core.auth@1.0.0",
      "core.billing@1.0.0",
    ]);
    expect(composition.environmentVariables).toEqual([
      "AUTH_ISSUER",
      "STRIPE_SECRET_KEY",
    ]);
    expect(composition.packages).toEqual({ stripe: "^23.0.0", zod: "^3.23.8" });
  });

  it("detects route, migration, package, state and navigation conflicts before planning viability", () => {
    const first = parseBuilderResourceManifest(
      resource("first", {
        composition: {
          routes: ["POST /api/action"],
          databaseMigrations: ["001_shared.sql"],
          environmentVariables: [],
          packages: { example: "^1.0.0" },
          stateNamespaces: ["shared"],
          navigationKeys: ["home"],
          permissions: [],
          stylingTokens: [],
          platformCapabilities: [],
          deploymentRequirements: [],
        },
      }),
    );
    const second = parseBuilderResourceManifest(
      resource("second", {
        composition: {
          routes: ["POST /api/action"],
          databaseMigrations: ["001_shared.sql"],
          environmentVariables: [],
          packages: { example: "^2.0.0" },
          stateNamespaces: ["shared"],
          navigationKeys: ["home"],
          permissions: [],
          stylingTokens: [],
          platformCapabilities: [],
          deploymentRequirements: [],
        },
      }),
    );

    const composition = composeBuilderResources([first, second]);

    expect(composition.ok).toBe(false);
    expect(
      composition.conflicts.map((conflict) => conflict.kind).sort(),
    ).toEqual([
      "database-migration",
      "navigation",
      "package-version",
      "route",
      "state-namespace",
    ]);
  });
});

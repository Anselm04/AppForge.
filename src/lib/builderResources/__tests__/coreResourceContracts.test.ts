import { describe, expect, it } from "vitest";
import { CORE_BUILDER_RESOURCE_CAPABILITY_IDS } from "../resourceCapabilities.js";
import { CORE_RESOURCE_CONTRACTS, authorizationResourceSchema, webhookResourceSchema } from "../coreResourceContracts.js";
import { SUBSTANTIAL_CORE_RESOURCES } from "../substantialCoreResources.js";

describe("substantive core Builder Resource packs", () => {
  it("provides a validation contract and source-backed resource for every requested core capability", () => {
    expect(Object.keys(CORE_RESOURCE_CONTRACTS).sort()).toEqual(
      [...CORE_BUILDER_RESOURCE_CAPABILITY_IDS].sort(),
    );
    expect(SUBSTANTIAL_CORE_RESOURCES).toHaveLength(
      CORE_BUILDER_RESOURCE_CAPABILITY_IDS.length,
    );
    for (const capability of CORE_BUILDER_RESOURCE_CAPABILITY_IDS) {
      expect(CORE_RESOURCE_CONTRACTS[capability].safeParse({}).success).toBe(false);
      const resource = SUBSTANTIAL_CORE_RESOURCES.find((candidate) =>
        candidate.capabilities.capabilitiesProvided.includes(capability),
      );
      expect(resource?.implementation.sourcePaths).toContain(
        "src/lib/builderResources/coreResourceContracts.ts",
      );
      expect(resource?.implementation.requiresLiveLibraryAtRuntime).toBe(false);
    }
  });

  it("requires default-deny ownership-aware authorization", () => {
    expect(
      authorizationResourceSchema.safeParse({
        roles: [
          { id: "user", permissions: ["booking:read", "booking:write"] },
        ],
        ownership: { enforced: true, ownerField: "userId" },
        tenancy: { enabled: false, tenantField: null },
        defaultDeny: true,
        policyChecks: ["authenticated", "owns-record"],
        auditDeniedActions: true,
      }).success,
    ).toBe(true);
  });

  it("requires signature verification and replay-safe webhook state", () => {
    expect(
      webhookResourceSchema.safeParse({
        endpoints: [
          {
            id: "stripe",
            path: "/webhooks/stripe",
            signatureScheme: "stripe-signature",
            allowedEvents: ["checkout.session.completed"],
          },
        ],
        deduplication: {
          enabled: true,
          eventIdField: "id",
          ledgerRetentionDays: 30,
        },
        retry: { safe: true, maxAttempts: 5 },
        replayProtection: true,
        eventLedger: true,
      }).success,
    ).toBe(true);
  });

  it("contains an explicit authorization resource id for reference compositions", () => {
    expect(
      SUBSTANTIAL_CORE_RESOURCES.some(
        (resource) => resource.identity.resourceId === "core.authorization",
      ),
    ).toBe(true);
  });
});

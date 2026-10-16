import { describe, expect, it, vi } from "vitest";
import {
  buildCustomerDataExport,
  type CustomerDataExportLoaders,
} from "../customerDataExport.js";

function loaders(
  overrides: Partial<CustomerDataExportLoaders> = {},
): CustomerDataExportLoaders {
  return {
    getUserById: vi.fn(async () => ({
      id: 7,
      openId: "provider-user-id",
      email: "customer@example.com",
      name: "Customer",
      picture: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    })),
    getProjectsByUserId: vi.fn(async () => [
      {
        id: 101,
        userId: 7,
        title: "Owned project",
        description: "Customer-owned product",
        status: "validated",
        techStack: "flutter_node",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-02T00:00:00.000Z"),
      },
    ]),
    getProjectFiles: vi.fn(async () => ({
      "lib/main.dart": "void main() {}",
    })),
    getBuildHistory: vi.fn(async () => [
      {
        projectId: 101,
        version: 3,
        status: "validated",
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
      },
    ]),
    getSubscriptionByUserId: vi.fn(async () => ({
      userId: 7,
      stripeCustomerId: "cus_secret_internal_reference",
      stripeSubscriptionId: "sub_secret_internal_reference",
      status: "active",
      tier: "builder",
      trialEnd: null,
      currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
    })),
    getUserCredits: vi.fn(async () => ({
      userId: 7,
      balance: 42,
      tier: "builder",
      monthlyAllowance: 66,
      unlimited: false,
    })),
    getCreditTransactions: vi.fn(async () => [
      {
        userId: 7,
        amount: -1,
        type: "build",
        projectId: 101,
        stripePaymentIntentId: "pi_secret_internal_reference",
        description: "Build credit",
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
      },
    ]),
    getGithubConnection: vi.fn(async () => ({
      userId: 7,
      githubUsername: "customer-gh",
      accessToken: "encrypted-provider-secret",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    })),
    ...overrides,
  };
}

describe("buildCustomerDataExport", () => {
  it("exports owned profile, projects, source, build history and safe billing/provider metadata", async () => {
    const result = await buildCustomerDataExport(7, loaders());

    expect(result.profile).toMatchObject({
      id: 7,
      email: "customer@example.com",
      name: "Customer",
    });
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.files).toEqual({
      "lib/main.dart": "void main() {}",
    });
    expect(result.projects[0]?.buildHistory).toHaveLength(1);
    expect(result.billing).toMatchObject({
      tier: "builder",
      status: "active",
      creditBalance: 42,
    });
    expect(result.connections.github).toMatchObject({
      username: "customer-gh",
      status: "connected",
    });
  });

  it("never exports provider credentials, internal payment references or auth identity IDs", async () => {
    const result = await buildCustomerDataExport(7, loaders());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("encrypted-provider-secret");
    expect(serialized).not.toContain("cus_secret_internal_reference");
    expect(serialized).not.toContain("sub_secret_internal_reference");
    expect(serialized).not.toContain("pi_secret_internal_reference");
    expect(serialized).not.toContain("provider-user-id");
    expect(serialized).not.toContain("accessToken");
  });

  it("fails closed if any project returned by a loader belongs to another tenant", async () => {
    const unsafe = loaders({
      getProjectsByUserId: vi.fn(async () => [
        {
          id: 999,
          userId: 8,
          title: "Other tenant",
          description: null,
          status: "validated",
          techStack: "react",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    });

    await expect(buildCustomerDataExport(7, unsafe)).rejects.toThrow(
      /ownership/i,
    );
    expect(unsafe.getProjectFiles).not.toHaveBeenCalled();
  });

  it("fails closed when the requested account does not exist or has a mismatched id", async () => {
    await expect(
      buildCustomerDataExport(
        7,
        loaders({ getUserById: vi.fn(async () => undefined) }),
      ),
    ).rejects.toThrow(/account/i);

    await expect(
      buildCustomerDataExport(
        7,
        loaders({
          getUserById: vi.fn(async () => ({
            id: 8,
            email: "other@example.com",
          })),
        }),
      ),
    ).rejects.toThrow(/ownership/i);
  });
});

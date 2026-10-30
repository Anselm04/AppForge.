import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("postgres", () => ({ default: vi.fn(() => ({})) }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({
    transaction: async (run: (tx: unknown) => unknown) =>
      run({
        execute: vi.fn(),
        query: { users: { findFirst: mocks.find } },
        update: () => ({ set: mocks.set }),
      }),
  }),
}));
vi.mock("../services/buildExecutionLease.js", () => ({
  createBuildExecutionDatabase: (db: unknown) => db,
}));
import { upsertUserFromAuth } from "../db.js";

describe("display-name persistence across authentication", () => {
  beforeEach(() => {
    mocks.set.mockReturnValue({
      where: () => ({ returning: mocks.returning }),
    });
    mocks.returning.mockResolvedValue([{ id: 7, name: "My saved name" }]);
  });

  it("preserves the customer's saved display name on the next authenticated request", async () => {
    mocks.find.mockResolvedValue({
      id: 7,
      name: "My saved name",
      email: "customer@example.com",
    });
    await upsertUserFromAuth({
      openId: "identity-1",
      email: "customer@example.com",
      name: "Provider default",
    });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My saved name" }),
    );
  });

  it("uses provider metadata when no name has been set yet", async () => {
    mocks.find.mockResolvedValue({
      id: 7,
      name: null,
      email: "customer@example.com",
    });
    await upsertUserFromAuth({
      openId: "identity-1",
      name: "Provider default",
    });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Provider default" }),
    );
  });
});

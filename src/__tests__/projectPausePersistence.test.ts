import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  set: vi.fn(),
  where: vi.fn().mockResolvedValue(undefined),
  findFirst: vi.fn(),
}));
vi.mock("postgres", () => ({ default: vi.fn(() => ({})) }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({
    update: () => ({ set: database.set }),
    query: { projects: { findFirst: database.findFirst } },
  }),
}));
import { getProjectById, updateProjectStatus } from "../db.js";

beforeEach(() => {
  vi.clearAllMocks();
  database.set.mockReturnValue({ where: database.where });
});

describe("durable build pause recovery", () => {
  it("persists plan approval as a pause reason so review and resume are available", async () => {
    await updateProjectStatus(68, "paused", "approval_required");
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paused",
        pauseReason: "approval_required",
      }),
    );
  });
  it("clears the pause reason when a build resumes", async () => {
    await updateProjectStatus(68, "running");
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running", pauseReason: null }),
    );
  });
  it("recovers previously persisted approval pauses without changing ownership", async () => {
    database.findFirst.mockResolvedValue({
      id: 68,
      userId: 9,
      status: "paused",
      pauseReason: null,
      errorMessage: "approval_required",
    });
    expect(await getProjectById(68)).toEqual(
      expect.objectContaining({ userId: 9, pauseReason: "approval_required" }),
    );
  });
  it("does not reinterpret arbitrary errors or running projects as approval pauses", async () => {
    database.findFirst.mockResolvedValue({
      status: "running",
      pauseReason: null,
      errorMessage: "approval_required",
    });
    expect((await getProjectById(68))?.pauseReason).toBeNull();
    database.findFirst.mockResolvedValue({
      status: "paused",
      pauseReason: null,
      errorMessage: "database_error",
    });
    expect((await getProjectById(68))?.pauseReason).toBeNull();
  });
});

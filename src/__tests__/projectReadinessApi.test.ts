import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  getProjectById: vi.fn(),
  getProjectsByUserId: vi.fn(),
}));
vi.mock("../db.js", () => ({ ...database, db: {} }));
const options = {
  zip: { configured: true },
  fly: { configured: true },
  preview: { configured: true },
  unsupported: { configured: true },
};
vi.mock("../services/deployer.js", () => ({
  listDeployDestinations: () => options,
}));
vi.mock("../services/accountLifecycleService.js", () => ({
  getAccountLifecycleState: async () => "active",
}));
const { projectsRouter } = await import("../routers/projects.js");
const caller = projectsRouter.createCaller({
  req: {} as never,
  res: {} as never,
  user: { id: 7, email: "maker@example.com", name: "Maker" },
});

beforeEach(() => vi.resetAllMocks());

describe("project readiness API", () => {
  it("normalizes stale get/list responses without mutating their stored objects", async () => {
    const project = {
      id: 1,
      userId: 7,
      techStack: "flutter-node",
      status: "production-certified",
      outputMaturity: "certified",
    };
    database.getProjectById.mockResolvedValue(project);
    database.getProjectsByUserId.mockResolvedValue([project]);
    expect(await caller.get({ id: 1 })).toMatchObject({
      status: "validated",
      outputMaturity: "structural",
    });
    expect(await caller.list()).toEqual([
      expect.objectContaining({
        status: "validated",
        outputMaturity: "structural",
      }),
    ]);
    expect(project.status).toBe("production-certified");
    expect(database.getProjectsByUserId).toHaveBeenCalledWith(7);
  });

  it("filters authoritative per-project deployment options and keeps legacy global discovery", async () => {
    database.getProjectById.mockResolvedValue({
      id: 1,
      userId: 7,
      techStack: "flutter-node",
    });
    expect(await caller.deployOptions({ id: 1 })).toEqual({ zip: options.zip });
    database.getProjectById.mockResolvedValue({
      id: 1,
      userId: 7,
      techStack: "react-node",
    });
    expect(await caller.deployOptions({ id: 1 })).toEqual({
      zip: options.zip,
      fly: options.fly,
      preview: options.preview,
    });
    expect(await caller.deployOptions()).toEqual(options);
  });

  it("rejects other users and missing projects before disclosing scoped options", async () => {
    database.getProjectById.mockResolvedValue({
      id: 1,
      userId: 8,
      techStack: "react-node",
    });
    await expect(caller.deployOptions({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.get({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    database.getProjectById.mockResolvedValue(null);
    await expect(caller.deployOptions({ id: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createManagerRouter,
  type ManagerRouterDependencies,
} from "../routes/managerIntegration.js";
import type { ManagerCommandRecord } from "../services/managerCommands.js";
const commands = new Map<string, ManagerCommandRecord>();
const call = vi.fn();
const getUser = vi.fn();
const env = {
  APPFORGE_MANAGER_TOKEN: "fixture-manager-token-with-32-characters",
  APPFORGE_MANAGER_USER_ID: "1",
  APPFORGE_MANAGER_SCOPES: "read,build,plan,repair,recover,preview",
  APPFORGE_MANAGER_DAILY_ACTION_LIMIT: "3",
  PUBLIC_APP_URL: "https://appforge.example.test",
};
const ledger = {
  async reserve(userId: number, input: any, limit: number) {
    const key = `${userId}:${input.requestId}`;
    const row = commands.get(key);
    if (row) {
      if (row.inputHash !== input.inputHash)
        throw Error("manager_idempotency_conflict");
      return { fresh: false, record: row };
    }
    if ([...commands.values()].length >= limit)
      throw Error("manager_daily_limit_reached");
    const record = {
      ...input,
      userId,
      status: "executing",
      createdAt: new Date().toISOString(),
    } as ManagerCommandRecord;
    commands.set(key, record);
    return { fresh: true, record };
  },
  async complete(userId: number, id: string, result: any) {
    Object.assign(commands.get(`${userId}:${id}`)!, {
      status: "completed",
      result,
    });
  },
  async fail(userId: number, id: string, error: string, uncertain = false) {
    Object.assign(commands.get(`${userId}:${id}`)!, {
      status: uncertain ? "executing" : "failed",
      error,
    });
  },
  async get(userId: number, id: string) {
    return commands.get(`${userId}:${id}`) || null;
  },
};
function router(overrides: Partial<ManagerRouterDependencies> = {}) {
  return createManagerRouter({ env, getUser, call, ledger, ...overrides });
}
async function request(
  path: string,
  method = "GET",
  body: any = undefined,
  headers: Record<string, string> = {},
) {
  const r = router();
  let status = 200;
  let result: any;
  const req: any = {
    method,
    url: path,
    originalUrl: "/integrations/manager" + path,
    path,
    body,
    headers: {
      authorization: `Bearer ${env.APPFORGE_MANAGER_TOKEN}`,
      ...headers,
    },
    get(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };
  const res: any = {
    setHeader: vi.fn(),
    status(code: number) {
      status = code;
      return this;
    },
    json(value: any) {
      result = value;
      return this;
    },
  };
  await new Promise<void>((resolve, reject) => {
    const json = res.json;
    res.json = function (value: any) {
      json.call(this, value);
      resolve();
      return this;
    };
    r(req, res, (e: any) => (e ? reject(e) : resolve()));
  });
  return { status, body: result };
}
beforeEach(() => {
  commands.clear();
  call.mockReset();
  getUser.mockReset().mockResolvedValue({
    id: 1,
    email: "anselm.perkins@gmail.com",
    name: "Company owner",
    isBanned: false,
  });
  call.mockImplementation(async (_user, action, input) =>
    action === "create"
      ? { id: 10, status: "running" }
      : action === "list"
        ? []
        : { id: 10, status: "validated" },
  );
});
describe("bounded autonomous AppForge Manager control", () => {
  it("rejects missing or incorrect credentials without looking up company data", async () => {
    const r = await request("/projects", "GET", undefined, {
      authorization: "Bearer wrong",
    });
    expect(r.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it("rejects browser origin and cookie-only access", async () => {
    expect(
      (
        await request("/projects", "GET", undefined, {
          origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/projects", "GET", undefined, {
          authorization: "",
          cookie: "owner-session=anything",
        })
      ).status,
    ).toBe(401);
  });
  it("binds reads to the configured owner account", async () => {
    const r = await request("/projects");
    expect(r.status).toBe(200);
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      "list",
      undefined,
      expect.anything(),
    );
    getUser.mockResolvedValue({ id: 1, email: "other@example.com" });
    expect((await request("/projects")).status).toBe(403);
  });
  it("deduplicates a completed build and rejects reuse with different input", async () => {
    const command = {
      requestId: "request-1",
      action: "build",
      input: {
        title: "Progress tracker",
        description: "Build a course progress tracker",
        productType: "website",
        techStack: "react-node",
      },
    };
    expect((await request("/commands", "POST", command)).status).toBe(202);
    expect((await request("/commands", "POST", command)).status).toBe(200);
    expect(call).toHaveBeenCalledTimes(1);
    expect(
      (
        await request("/commands", "POST", {
          ...command,
          input: { ...command.input, description: "A different application" },
        })
      ).status,
    ).toBe(409);
  });
  it("blocks unscoped and destructive operations", async () => {
    const initial = env.APPFORGE_MANAGER_SCOPES;
    try {
      env.APPFORGE_MANAGER_SCOPES = "read";
      expect(
        (
          await request("/commands", "POST", {
            requestId: "request-2",
            action: "build",
            input: { title: "App", description: "Build a website" },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request("/commands", "POST", {
            requestId: "request-3",
            action: "delete",
            input: { id: 10 },
          })
        ).status,
      ).toBe(400);
      expect(call).not.toHaveBeenCalled();
    } finally {
      env.APPFORGE_MANAGER_SCOPES = initial;
    }
  });
  it("does not replay a command with an uncertain outcome", async () => {
    commands.set("1:pending", {
      userId: 1,
      requestId: "pending",
      action: "build",
      inputHash: "test",
      status: "executing",
      createdAt: new Date().toISOString(),
    });
    const r = await request("/commands/pending");
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("executing");
    expect(call).not.toHaveBeenCalled();
  });
  it("never reports a queued build as verified delivery", async () => {
    await request("/jobs", "POST", {
      taskId: "task-1",
      action: "improve",
      payload: {
        description: "Build a course tracker",
        productType: "website",
        techStack: "react-node",
      },
    });
    call.mockImplementation(async () => ({ status: "building" }));
    const r = await request("/jobs/task-1");
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("running");
    expect(r.body.evidenceUrl).toBeUndefined();
  });
  it("keeps production deployment outside the default preview-only scope", async () => {
    expect(
      (
        await request("/commands", "POST", {
          requestId: "deploy-1",
          action: "deploy",
          input: { id: 10, destination: "fly" },
        })
      ).status,
    ).toBe(403);
    expect(call).not.toHaveBeenCalled();
  });
  it("enforces the configured daily action bound", async () => {
    const prior = env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT;
    try {
      env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT = "1";
      expect(
        (
          await request("/commands", "POST", {
            requestId: "bounded-1",
            action: "build",
            input: { title: "First", description: "Build a first product" },
          })
        ).status,
      ).toBe(202);
      expect(
        (
          await request("/commands", "POST", {
            requestId: "bounded-2",
            action: "build",
            input: { title: "Second", description: "Build a second product" },
          })
        ).status,
      ).toBe(429);
      expect(call).toHaveBeenCalledTimes(1);
    } finally {
      env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT = prior;
    }
  });
  it("requires a verified current artifact before completing a Manager build job", async () => {
    await request("/jobs", "POST", {
      taskId: "verified-job",
      action: "improve",
      payload: {
        description: "Build a course tracker",
        productType: "website",
        techStack: "react-node",
      },
    });
    call.mockImplementation(async (_user, action) =>
      action === "artifact"
        ? { snapshotId: 5, version: 1, sha256: "a".repeat(64) }
        : { id: 10, status: "validated" },
    );
    const result = await request("/jobs/verified-job");
    expect(result.body).toMatchObject({
      taskId: "verified-job",
      status: "verified",
      deliverableKind: "source_artifact",
      productionReady: false,
      projectId: 10,
    });
    expect(result.body.evidenceUrl).toBe(
      "https://appforge.example.test/integrations/manager/projects/10/evidence",
    );
  });
  it("keeps a lost provider response uncertain and never executes the same command twice", async () => {
    const command = {
      requestId: "lost-response",
      action: "build",
      input: { title: "Tracker", description: "Build a course tracker" },
    };
    call.mockRejectedValueOnce(new Error("private network details"));
    expect((await request("/commands", "POST", command)).status).toBe(503);
    expect((await request("/commands", "POST", command)).status).toBe(202);
    expect(call).toHaveBeenCalledTimes(1);
    expect((await request("/commands/lost-response")).body.status).toBe(
      "executing",
    );
  });
});

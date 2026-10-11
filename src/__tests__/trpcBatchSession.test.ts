import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("../lib/auth.js", () => ({
  ensureFreshSession: vi.fn(),
  getAccessToken: () => null,
  refreshSession: auth.refresh,
}));
vi.mock("../lib/csrf.js", () => ({
  clearCsrfToken: vi.fn(),
  withCsrfHeaders: async (headers: Headers) => headers,
}));
import { trpc } from "../utils/trpc.js";
const denied = {
  error: {
    message: "Not authenticated",
    code: -32001,
    data: { code: "UNAUTHORIZED", httpStatus: 401 },
  },
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("mixed tRPC authentication failures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    auth.refresh.mockReset();
  });
  it("refreshes and retries only the denied query in an HTTP 207 batch", async () => {
    auth.refresh.mockResolvedValue({ user: { id: "owner" } });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockReset()
      .mockResolvedValueOnce(
        response([{ result: { data: null } }, denied], 207),
      )
      .mockResolvedValueOnce(response([{ result: { data: { id: 68 } } }]));
    const [user, project] = await Promise.all([
      trpc.auth.me.query(),
      trpc.projects.get.query({ id: 68 }),
    ]);
    expect(user).toBeNull();
    expect(project).toEqual({ id: 68 });
    expect(auth.refresh).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain("projects.get");
    expect(String(fetch.mock.calls[1][0])).not.toContain("auth.me");
  });
  it("does not loop when the refreshed session is still denied", async () => {
    auth.refresh.mockResolvedValue({ user: { id: "owner" } });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockReset()
      .mockImplementation(async () => response([denied], 207));
    await expect(trpc.projects.get.query({ id: 68 })).rejects.toThrow(
      "Not authenticated",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(auth.refresh).toHaveBeenCalledOnce();
  });
  it("does not replay a mutation after an operation-level authentication error", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockReset()
      .mockImplementation(async () => response([denied], 207));
    await expect(
      trpc.projects.resumeApprovedBuild.mutate({ projectId: 68 }),
    ).rejects.toThrow("Not authenticated");
    expect(fetch).toHaveBeenCalledOnce();
    expect(auth.refresh).not.toHaveBeenCalled();
  });
  it("does not retry when session renewal fails", async () => {
    auth.refresh.mockResolvedValue(null);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockReset()
      .mockImplementation(async () => response([denied], 207));
    await expect(trpc.projects.get.query({ id: 68 })).rejects.toThrow(
      "Not authenticated",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not restart a cancelled read after delayed session renewal", async () => {
    let renew!: (value: { user: { id: string } }) => void;
    auth.refresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          renew = resolve;
        }),
    );
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockReset()
      .mockImplementation(async () => response([denied], 207));
    const controller = new AbortController();
    const query = trpc.projects.get.query(
      { id: 68 },
      { signal: controller.signal },
    );
    const rejected = expect(query).rejects.toThrow();
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalledOnce());
    controller.abort();
    renew({ user: { id: "owner" } });
    await rejected;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetch).toHaveBeenCalledOnce();
  });
});

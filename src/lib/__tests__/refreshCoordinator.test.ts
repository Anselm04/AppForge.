import { afterEach, describe, expect, it, vi } from "vitest";
import { coordinateRefreshAcrossMachines } from "../refreshCoordinator.js";

class MemoryRefreshStore {
  private values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean },
  ): Promise<string | null> {
    if (options?.NX && this.values.has(key)) return null;
    this.values.set(key, value);
    return "OK";
  }

  async eval(
    _script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<number> {
    const [key] = options.keys;
    const [owner] = options.arguments;
    if (key && this.values.get(key) === owner) {
      this.values.delete(key);
      return 1;
    }
    return 0;
  }
}

describe("cross-machine refresh coordination", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rotates a one-time provider refresh token only once for concurrent machines", async () => {
    const store = new MemoryRefreshStore();
    let rotations = 0;
    const rotate = async () => {
      rotations += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      return {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        user: { id: "user-1" },
      };
    };

    const [first, second] = await Promise.all([
      coordinateRefreshAcrossMachines("sha256-digest", rotate, store),
      coordinateRefreshAcrossMachines("sha256-digest", rotate, store),
    ]);

    expect(rotations).toBe(1);
    expect(first).toEqual(second);
    expect(first?.refreshToken).toBe("new-refresh");
  });

  it("reuses a cached rotated session without invoking the provider again", async () => {
    const store = new MemoryRefreshStore();
    let rotations = 0;
    const rotate = async () => {
      rotations += 1;
      return { accessToken: "a", refreshToken: "r", user: { id: "u" } };
    };

    const first = await coordinateRefreshAcrossMachines(
      "same-digest",
      rotate,
      store,
    );
    const second = await coordinateRefreshAcrossMachines(
      "same-digest",
      rotate,
      store,
    );

    expect(first).toEqual(second);
    expect(rotations).toBe(1);
  });

  it("keeps local development functional when Redis is intentionally not configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REDIS_URL", "");
    const rotate = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      coordinateRefreshAcrossMachines("digest", rotate, null),
    ).resolves.toEqual({ ok: true });
    expect(rotate).toHaveBeenCalledTimes(1);
  });

  it("fails closed in production when Redis is configured but coordination is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://configured.example:6379");
    const rotate = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      coordinateRefreshAcrossMachines("digest", rotate, null),
    ).resolves.toBeNull();
    expect(rotate).not.toHaveBeenCalled();
  });
});

import express from "express";
import { request } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminMfaRateLimit } from "../middleware/adminMfaRateLimit.js";
import { createLocalRateLimiter } from "../middleware/rateLimiter.js";

describe("admin MFA HTTP abuse boundary", () => {
  let server: Server;
  let executed = 0;
  const call = (path: string): Promise<number> =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          port: (server.address() as AddressInfo).port,
          host: "127.0.0.1",
          path,
          method: "POST",
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode!));
        },
      );
      req.on("error", reject);
      req.end();
    });

  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "development");
    executed = 0;
    const app = express();
    const limiter = (max: number) =>
      createLocalRateLimiter({ windowMs: 600_000, max, message: "Limited" });
    app.use("/api/trpc", adminMfaRateLimit(limiter(3), limiter(10)));
    app.use((_req, res) => {
      executed += 1;
      res.sendStatus(204);
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    vi.unstubAllEnvs();
  });

  it("limits SMS sends to three even with tRPC's single-operation batch flag", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1)
      expect(await call("/api/trpc/admin.requestMfa?batch=1")).toBe(204);
    expect(await call("/api/trpc/admin.requestMfa")).toBe(429);
    expect(executed).toBe(3);
  });

  it("limits verification attempts to ten with a separate bucket", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect(await call("/api/trpc/admin.verifyMfa")).toBe(204);
    expect(await call("/api/trpc/admin.verifyMfa")).toBe(429);
    expect(await call("/api/trpc/admin.requestMfa")).toBe(204);
    expect(executed).toBe(11);
  });

  it.each([
    "auth.me,admin.requestMfa",
    "admin.requestMfa,auth.me",
    "admin.verifyMfa,admin.verifyMfa",
    "auth.me%2Cadmin.verifyMfa",
    "admin.requestMfa,admin.verifyMfa",
  ])("rejects MFA batch %s without executing any operation", async (path) => {
    expect(await call(`/api/trpc/${path}?batch=1`)).toBe(400);
    expect(executed).toBe(0);
  });

  it("preserves ordinary customer batches", async () => {
    expect(await call("/api/trpc/auth.me,projects.list?batch=1")).toBe(204);
    expect(executed).toBe(1);
  });
});

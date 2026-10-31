import express from "express";
import rateLimit from "express-rate-limit";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicAssetsRouter } from "./publicAssets.js";
import { request } from "node:http";

describe("public assets and application request budgets", () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "appforge-assets-"));
    await mkdir(path.join(directory, "assets"));
    await mkdir(path.join(directory, "branding"));
    await writeFile(
      path.join(directory, "assets", "app.js"),
      "console.log('app');",
    );
    await writeFile(path.join(directory, "branding", "logo.svg"), "<svg/>");
    await writeFile(path.join(directory, "index.html"), "private fallback");
  });
  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function withServer(
    check: (
      get: (url: string, method?: string) => Promise<number>,
    ) => Promise<void>,
  ) {
    const app = express();
    app.use(createPublicAssetsRouter(directory));
    app.use(rateLimit({ windowMs: 60_000, limit: 2 }));
    app.use((_req, res) => {
      res.sendStatus(401);
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      await check(
        (url, method = "GET") =>
          new Promise<number>((resolve, reject) => {
            const req = request(
              { host: "127.0.0.1", port, path: url, method },
              (res) => {
                res.resume();
                res.on("end", () => resolve(res.statusCode!));
              },
            );
            req.on("error", reject);
            req.end();
          }),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }

  it("keeps existing bundles and images available without exhausting the API budget", async () => {
    await withServer(async (get) => {
      for (let i = 0; i < 4; i++) {
        expect(await get("/assets/app.js")).toBe(200);
        expect(await get("/branding/logo.svg", "HEAD")).toBe(200);
      }
      expect(await get("/api/protected")).toBe(401);
      expect(await get("/api/protected")).toBe(401);
      expect(await get("/api/protected")).toBe(429);
      expect(await get("/assets/app.js")).toBe(200);
    });
  });

  it.each(["/assets/missing.js", "/index.html", "/assets/../index.html"])(
    "keeps missing or non-asset paths under the normal budget: %s",
    async (url) => {
      await withServer(async (get) => {
        expect(await get(url)).toBe(401);
        expect(await get(url)).toBe(401);
        expect(await get(url)).toBe(429);
      });
    },
  );

  it("keeps writes to asset paths under the normal budget", async () => {
    await withServer(async (get) => {
      expect(await get("/assets/app.js", "POST")).toBe(401);
      expect(await get("/assets/app.js", "POST")).toBe(401);
      expect(await get("/assets/app.js", "POST")).toBe(429);
    });
  });
});

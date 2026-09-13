import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSuccessfulDeployStatus,
  probeDeployUrl,
  runPostDeploySmokeTest,
} from "../services/deployHealth.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("production deployment health gate", () => {
  it("accepts only real successful or redirect responses", () => {
    expect(isSuccessfulDeployStatus(200)).toBe(true);
    expect(isSuccessfulDeployStatus(204)).toBe(true);
    expect(isSuccessfulDeployStatus(302)).toBe(true);
    expect(isSuccessfulDeployStatus(401)).toBe(false);
    expect(isSuccessfulDeployStatus(403)).toBe(false);
    expect(isSuccessfulDeployStatus(404)).toBe(false);
    expect(isSuccessfulDeployStatus(500)).toBe(false);
    expect(isSuccessfulDeployStatus(503)).toBe(false);
  });

  it("does not report a missing generated product as healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );

    const result = await probeDeployUrl("https://generated.example.test");

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it("rejects an empty production root even when HTTP status is successful", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("   ", { status: 200 })),
    );

    const result = await runPostDeploySmokeTest(
      "https://generated.example.test",
    );

    expect(result.ok).toBe(false);
    expect(result.root.statusCode).toBe(200);
    expect(result.root.error).toBe("Empty response body");
  });

  it("allows apps without a dedicated /health route when root works", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("app", { status: 200 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPostDeploySmokeTest(
      "https://generated.example.test/",
    );

    expect(result.ok).toBe(true);
    expect(result.root.statusCode).toBe(200);
    expect(result.health).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails when an advertised health endpoint is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("app", { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPostDeploySmokeTest(
      "https://generated.example.test",
    );

    expect(result.ok).toBe(false);
    expect(result.root.ok).toBe(true);
    expect(result.health?.statusCode).toBe(503);
  });
});

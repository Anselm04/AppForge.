import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAuthenticatedUser } from "./requireAuthenticatedUser.js";

type MockResponse = Pick<Response, "setHeader" | "status" | "json">;

function createResponse() {
  const response: Partial<MockResponse> & { statusCode?: number; body?: unknown } = {};
  response.setHeader = vi.fn();
  response.status = vi.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response as Response;
  }) as Response["status"];
  response.json = vi.fn((body: unknown) => {
    response.body = body;
    return response as Response;
  }) as Response["json"];
  return response as Response & { statusCode?: number; body?: unknown };
}

describe("requireAuthenticatedUser", () => {
  it("fails closed with 401 and no-store when identity is absent", () => {
    const req = {} as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireAuthenticatedUser(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Not authenticated",
      code: "AUTH_REQUIRED",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed when a malformed user object has no internal id", () => {
    const req = { user: { email: "user@example.com" } } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireAuthenticatedUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a verified AppForge user through", () => {
    const req = {
      user: {
        id: 42,
        email: "user@example.com",
        name: "User",
        supabaseUid: "supabase-user-id",
      },
    } as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireAuthenticatedUser(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

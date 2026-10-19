import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
import { validateBody, validateRequest } from "../validationMiddleware";

describe("validation middleware", () => {
  function response() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  it("returns field issues and rejects invalid input without calling the handler", () => {
    const schema = z.object({
      users: z.array(z.object({ email: z.string().email() })),
    });
    const req = { body: { users: [{ email: "invalid" }] } } as Request;
    const res = response();
    const next = vi.fn();
    validateBody(schema)(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "VALIDATION_ERROR",
        errors: [
          expect.objectContaining({
            field: "users.0.email",
            message: expect.any(String),
            code: "invalid_format",
          }),
        ],
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("applies parsed transformations and strips undeclared body fields", () => {
    const req = { body: { name: "  Alice  ", admin: true } } as Request;
    const res = response();
    const next = vi.fn();
    validateBody(z.object({ name: z.string().trim().min(1) }))(
      req,
      res as unknown as Response,
      next,
    );
    expect(req.body).toEqual({ name: "Alice" });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("collects body, query and parameter failures before rejecting a request", () => {
    const req = {
      body: { amount: -1 },
      query: { page: "0" },
      params: { id: "bad" },
    } as unknown as Request;
    const res = response();
    const next = vi.fn();
    validateRequest({
      body: z.object({ amount: z.number().positive() }),
      query: z.object({ page: z.coerce.number().int().positive() }),
      params: z.object({ id: z.string().uuid() }),
    })(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(
      res.json.mock.calls[0][0].errors.map(
        (issue: { field: string }) => issue.field,
      ),
    ).toEqual(["amount", "page", "id"]);
    expect(next).not.toHaveBeenCalled();
  });
});

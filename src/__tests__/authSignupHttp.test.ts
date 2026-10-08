import express from "express";
import { request, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const delivery = vi.hoisted(() => ({ signup: vi.fn(), resend: vi.fn() }));
vi.mock("../services/authEmailDelivery.js", () => ({
  createSignupConfirmation: delivery.signup,
  resendSignupConfirmation: delivery.resend,
}));
import { authSignupRouter } from "../routes/authSignup.js";

describe("signup and resend HTTP boundary", () => {
  let server: Server;
  let origin: string;
  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PUBLIC_APP_URL", "https://trusted.example.com");
    delivery.signup.mockResolvedValue({
      userId: "test-user",
      confirmationSent: true,
    });
    delivery.resend.mockResolvedValue(undefined);
    const app = express();
    app.use(express.json());
    app.use(authSignupRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing listener");
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const post = (path: string, body: object) =>
    new Promise<{ status: number }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = request(
        origin + path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Host: "attacker.example.com",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          res.resume();
          res.once("end", () => resolve({ status: res.statusCode || 0 }));
        },
      );
      req.once("error", reject);
      req.end(payload);
    });

  it("ignores a spoofed Host when generating confirmation links", async () => {
    const response = await post("/signup", {
      email: "test@example.com",
      password: "StrongPassword1!",
      next: "/account",
    });
    expect(response.status).toBe(202);
    expect(delivery.signup).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectTo: "https://trusted.example.com/login?next=%2Faccount",
      }),
    );
  });

  it("shares one abuse bucket between signup and resend", async () => {
    for (let index = 0; index < 9; index++) {
      const response = await post("/resend-verification", {
        email: "test@example.com",
      });
      expect(response.status).toBe(202);
    }
    const blocked = await post("/signup", {
      email: "test@example.com",
      password: "StrongPassword1!",
    });
    expect(blocked.status).toBe(429);
    expect(delivery.signup).not.toHaveBeenCalled();
  });
});

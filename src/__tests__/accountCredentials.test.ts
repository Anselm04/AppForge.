import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  state: vi.fn(),
  reauthenticate: vi.fn(),
}));
vi.mock("../services/accountCredentials.js", () => ({
  updateAccountCredentials: mocks.update,
  requestAccountReauthentication: mocks.reauthenticate,
}));
vi.mock("../services/accountLifecycleService.js", () => ({
  getAccountLifecycleState: mocks.state,
}));
import { accountRouter } from "../routers/account.js";

function caller(
  options: {
    token?: string;
    phoneVerified?: boolean;
    authenticated?: boolean;
  } = {},
) {
  return accountRouter.createCaller({
    req: { authAccessToken: options.token } as Request,
    res: {} as Response,
    user:
      options.authenticated === false
        ? null
        : {
            id: 7,
            supabaseUid: "identity-1",
            email: "customer@example.com",
            name: "Customer",
            phoneVerified: options.phoneVerified ?? true,
          },
  });
}

describe("cookie-backed account credential changes", () => {
  beforeEach(() => {
    mocks.state.mockResolvedValue("active");
    mocks.update.mockResolvedValue(undefined);
  });

  it("changes a password using the server-validated token after cookie refresh", async () => {
    await expect(
      caller({ token: "rotated-cookie-token" }).changePassword({
        password: "NewPassword123!",
      }),
    ).resolves.toEqual({ updated: true });
    expect(mocks.update).toHaveBeenCalledWith("rotated-cookie-token", {
      password: "NewPassword123!",
    });
  });

  it("requests an email change without locally marking the email verified", async () => {
    await expect(
      caller({ token: "cookie-token" }).changeEmail({
        email: " New@Example.com ",
      }),
    ).resolves.toEqual({ confirmationRequired: true });
    expect(mocks.update).toHaveBeenCalledWith("cookie-token", {
      email: "new@example.com",
    });
  });

  it("rejects missing server-validated tokens", async () => {
    await expect(
      caller().changePassword({ password: "NewPassword123!" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    { authenticated: false },
    { token: "cookie-token", phoneVerified: false },
  ])("blocks unauthenticated or unverified accounts", async (options) => {
    await expect(
      caller(options).changeEmail({ email: "new@example.com" }),
    ).rejects.toBeDefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["pending", "completed"])(
    "blocks credential changes for %s deletion",
    async (state) => {
      mocks.state.mockResolvedValue(state);
      await expect(
        caller({ token: "cookie-token" }).changePassword({
          password: "NewPassword123!",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("validates password length before contacting the provider", async () => {
    await expect(
      caller({ token: "cookie-token" }).changePassword({ password: "short" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requests password verification for the current server-authenticated account", async () => {
    mocks.reauthenticate.mockResolvedValue(undefined);
    await expect(
      caller({ token: "cookie-token" }).requestPasswordVerification(),
    ).resolves.toEqual({ sent: true });
    expect(mocks.reauthenticate).toHaveBeenCalledWith("cookie-token");
  });

  it("forwards the password verification code to the identity provider", async () => {
    await caller({ token: "cookie-token" }).changePassword({
      password: "NewPassword123!",
      nonce: "123456",
    });
    expect(mocks.update).toHaveBeenCalledWith("cookie-token", {
      password: "NewPassword123!",
      nonce: "123456",
    });
  });
});

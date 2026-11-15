import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response as ExpressResponse } from "express";

const mocks = vi.hoisted(() => ({
  setSessionCookies: vi.fn(),
  setAdminMfaCookie: vi.fn(),
}));
vi.mock("../middleware/supabaseAuth.js", () => ({
  setSessionCookies: mocks.setSessionCookies,
}));
vi.mock("../lib/adminMfa.js", () => ({
  setAdminMfaCookie: mocks.setAdminMfaCookie,
}));

import {
  ownerTotpStatus,
  enrollOwnerTotp,
  verifyOwnerTotp,
} from "../services/ownerTotp.js";

const ownerUid = "123e4567-e89b-42d3-a456-426614174000";
const factorId = "123e4567-e89b-42d3-a456-426614174001";
const challengeId = "123e4567-e89b-42d3-a456-426614174002";

function token(
  aal: string,
  sub = ownerUid,
  session_id = "owner-session",
): string {
  return [
    "header",
    Buffer.from(JSON.stringify({ sub, session_id, aal })).toString("base64url"),
    "signature",
  ].join(".");
}
const primary = token("aal1");
const elevated = token("aal2");

function ownerRequest(): Request {
  return { authAccessToken: primary } as Request;
}
function fakeResponse(): ExpressResponse {
  return {} as ExpressResponse;
}
function response(value: unknown, status = 200): globalThis.Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
const factor = {
  id: factorId,
  factor_type: "totp",
  status: "verified",
};

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://local-auth.example");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("owner authenticator step-up, without Twilio", () => {
  it("lists only the verified factors belonging to the authenticated owner", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        id: ownerUid,
        factors: [
          factor,
          { id: challengeId, factor_type: "phone", status: "verified" },
        ],
      }),
    );
    await expect(
      ownerTotpStatus(ownerRequest(), ownerUid, fetcher),
    ).resolves.toEqual({
      enrolled: true,
      factorCount: 1,
      factorId,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://local-auth.example/auth/v1/user");
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      `Bearer ${primary}`,
    );
  });

  it("rejects a Supabase identity mismatch before enrollment", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ id: "another-user", factors: [] }));
    await expect(
      enrollOwnerTotp(ownerRequest(), ownerUid, fetcher),
    ).rejects.toThrow("owner identity mismatch");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("creates a new unverified factor without storing its secret on the server", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ id: ownerUid, factors: [] }))
      .mockResolvedValueOnce(
        response({
          id: factorId,
          type: "totp",
          totp: {
            secret: "EXAMPLESECRET",
            uri: "otpauth://totp/AppForge:Owner?secret=EXAMPLESECRET",
          },
        }),
      );
    await expect(
      enrollOwnerTotp(ownerRequest(), ownerUid, fetcher),
    ).resolves.toEqual({
      factorId,
      secret: "EXAMPLESECRET",
      uri: "otpauth://totp/AppForge:Owner?secret=EXAMPLESECRET",
    });
    expect(fetcher.mock.calls[1][0]).toBe(
      "https://local-auth.example/auth/v1/factors",
    );
    const body = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(body.factor_type).toBe("totp");
    expect(JSON.stringify(body)).not.toContain("EXAMPLESECRET");
  });

  it("verifies the actual Supabase challenge and signs the owner cookie only after AAL2", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ id: ownerUid, factors: [factor] }))
      .mockResolvedValueOnce(response({ id: challengeId }))
      .mockResolvedValueOnce(
        response({ access_token: elevated, refresh_token: "new-refresh" }),
      )
      .mockResolvedValueOnce(response({ id: ownerUid }));
    const req = ownerRequest();
    const res = fakeResponse();
    const result = await verifyOwnerTotp(
      req,
      res,
      7,
      ownerUid,
      factorId,
      "123456",
      fetcher,
    );
    expect(result.access_token).toBe(elevated);
    expect(req.authAccessToken).toBe(elevated);
    expect(mocks.setSessionCookies).toHaveBeenCalledWith(
      res,
      elevated,
      "new-refresh",
    );
    expect(mocks.setAdminMfaCookie).toHaveBeenCalledWith(req, res, 7);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(String(fetcher.mock.calls[1][0])).toContain("/challenge");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({
      challenge_id: challengeId,
      code: "123456",
    });
  });

  it("cannot unlock admin using an AAL1 response or a different session", async () => {
    for (const rejectedToken of [
      token("aal1"),
      token("aal2", ownerUid, "different-session"),
      token("aal2", "attacker-user"),
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response({ id: ownerUid, factors: [factor] }))
        .mockResolvedValueOnce(response({ id: challengeId }))
        .mockResolvedValueOnce(
          response({ access_token: rejectedToken, refresh_token: "refresh" }),
        );
      await expect(
        verifyOwnerTotp(
          ownerRequest(),
          fakeResponse(),
          7,
          ownerUid,
          factorId,
          "123456",
          fetcher,
        ),
      ).rejects.toThrow("session identity is inconsistent");
    }
    expect(mocks.setSessionCookies).not.toHaveBeenCalled();
    expect(mocks.setAdminMfaCookie).not.toHaveBeenCalled();
  });

  it("rejects unowned factors, invalid codes and failure responses without granting access", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ id: ownerUid, factors: [factor] }));
    await expect(
      verifyOwnerTotp(
        ownerRequest(),
        fakeResponse(),
        7,
        ownerUid,
        challengeId,
        "123456",
        fetcher,
      ),
    ).rejects.toThrow("not owned");
    await expect(
      verifyOwnerTotp(
        ownerRequest(),
        fakeResponse(),
        7,
        ownerUid,
        factorId,
        "abc456",
        fetcher,
      ),
    ).rejects.toThrow("Invalid authenticator");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mocks.setAdminMfaCookie).not.toHaveBeenCalled();
  });
});

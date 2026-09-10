import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
} from "../auth.js";
import { parseSseFrame, readSseBody } from "../authedSse.js";
import { supabaseClient } from "../supabase-client.js";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
}

describe("generate auth helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes JWT only through Authorization headers", () => {
    window.localStorage.setItem(
      "appforge.session",
      JSON.stringify({
        accessToken: "jwt-token",
        user: { id: "u1", email: "owner@example.com" },
      }),
    );
    expect(getAccessToken()).toBe("jwt-token");
    expect(authHeaders()).toEqual({ Authorization: "Bearer jwt-token" });
  });

  it("sends unsigned users to /login with next preserved (not signup)", () => {
    expect(loginPathWithReturn("/")).toBe("/login?next=%2F");
  });

  it("clears an expired session when refresh fails", async () => {
    const expiredToken = "e30.eyJleHAiOjF9.sig";
    window.localStorage.setItem(
      "appforge.session",
      JSON.stringify({
        accessToken: expiredToken,
        refreshToken: "refresh-token",
        user: { id: "u1" },
      }),
    );
    vi.spyOn(supabaseClient, "refreshSession").mockRejectedValue(
      new Error("refresh failed"),
    );
    const signOutSpy = vi
      .spyOn(supabaseClient, "signOut")
      .mockResolvedValue({});

    await expect(ensureFreshSession()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem("appforge.session")).toBeNull();
    expect(signOutSpy).toHaveBeenCalledWith(expiredToken);
  });

  it("parses SSE agent frames used by generate", () => {
    const parsed = parseSseFrame(
      'event: agent\ndata: {"agent":"Planner","type":"start"}',
    );
    expect(parsed?.event).toBe("agent");
    expect(parsed?.data).toContain("Planner");
  });

  it("reads CRLF-delimited SSE frames", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: agent\r\ndata: {"type":"start"}\r\n\r\n'),
        );
        controller.close();
      },
    });
    const events: Array<{ event: string; data: string }> = [];

    await readSseBody(body, (event, data) => {
      events.push({ event, data });
    });

    expect(events).toEqual([
      { event: "agent", data: '{"type":"start"}' },
    ]);
  });
});

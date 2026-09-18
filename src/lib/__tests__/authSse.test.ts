import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
} from "../auth.js";
import { parseSseFrame, readSseBody } from "../authedSse.js";

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

  it("does not restore authentication tokens from browser storage", () => {
    window.localStorage.setItem(
      "appforge.session",
      JSON.stringify({
        accessToken: "jwt-token",
        refreshToken: "refresh-token",
        user: { id: "u1", email: "owner@example.com" },
      }),
    );
    expect(getAccessToken()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it("sends unsigned users to /login with next preserved (not signup)", () => {
    expect(loginPathWithReturn("/")).toBe("/login?next=%2F");
  });

  it("restores only a non-secret user marker for cookie-authenticated requests", async () => {
    window.localStorage.setItem(
      "appforge.user",
      JSON.stringify({ id: "u1", email: "owner@example.com" }),
    );

    const session = await ensureFreshSession();
    expect(session?.user.id).toBe("u1");
    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem("appforge.session")).toBeNull();
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

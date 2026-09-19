import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
  signOut,
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
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    // Reset module-level cachedSession between cases.
    signOut();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not restore tokens from localStorage appforge.session blobs", () => {
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

  it("restores bearer from sessionStorage appforge.accessToken across reloads", () => {
    // Minimal JWT: header.payload.sig with sub claim
    const payload = btoa(JSON.stringify({ sub: "u1", email: "owner@example.com", exp: Math.floor(Date.now()/1000) + 3600 }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `eyJhbGciOiJub25lIn0.${payload}.x`;
    window.sessionStorage.setItem("appforge.accessToken", token);
    expect(getAccessToken()).toBe(token);
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${token}` });
  });

  it("sends unsigned users to /login with next preserved (not signup)", () => {
    expect(loginPathWithReturn("/")).toBe("/login?next=%2F");
  });

  it("hydrates cookie sessions via /api/auth/me without requiring an in-memory JWT", async () => {
    window.localStorage.setItem(
      "appforge.user",
      JSON.stringify({ id: "u1", email: "owner@example.com" }),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) {
        return new Response(
          JSON.stringify({
            id: 1,
            email: "owner@example.com",
            supabaseUid: "u1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await ensureFreshSession();
    expect(session?.user.id).toBe("u1");
    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem("appforge.session")).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
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

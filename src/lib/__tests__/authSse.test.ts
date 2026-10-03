import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
  signOut,
} from "../auth.js";
import { consumeAuthedSse, parseSseFrame, readSseBody } from "../authedSse.js";
import { clearCsrfToken } from "../csrf.js";

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

function fakeJwt(sub: string, email: string, expSecondsFromNow = 3600) {
  const payload = btoa(
    JSON.stringify({
      sub,
      email,
      exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `eyJhbGciOiJub25lIn0.${payload}.x`;
}

describe("generate auth helpers", () => {
  beforeEach(() => {
    signOut();
    clearCsrfToken();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: memoryStorage(),
    });
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

  it("restores bearer from sessionStorage appforge.access-token across reloads", () => {
    const token = fakeJwt("u1", "owner@example.com");
    window.sessionStorage.setItem("appforge.access-token", token);
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
    expect(
      fetchMock.mock.calls.some(([url]) => String(url) === "/api/auth/me"),
    ).toBe(true);
  });

  it("clears a stale user marker when /api/auth/me rejects the session", async () => {
    window.localStorage.setItem(
      "appforge.user",
      JSON.stringify({ id: "u1", email: "owner@example.com" }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const session = await ensureFreshSession();
    expect(session).toBeNull();
    expect(window.localStorage.getItem("appforge.user")).toBeNull();
    expect(window.sessionStorage.getItem("appforge.access-token")).toBeNull();
  });

  it("keeps a fresh sessionStorage bearer without probing /api/auth/me", async () => {
    const token = fakeJwt("u1", "owner@example.com");
    window.sessionStorage.setItem("appforge.access-token", token);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const session = await ensureFreshSession();
    expect(session?.accessToken).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows cookie-authenticated SSE when no browser bearer token is available", async () => {
    window.localStorage.setItem(
      "appforge.user",
      JSON.stringify({ id: "u1", email: "owner@example.com" }),
    );

    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return new Response(
          JSON.stringify({
            id: 1,
            email: "owner@example.com",
            supabaseUid: "u1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/build/123") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode('event: done\ndata: {"ok":true}\n\n'),
              );
              controller.close();
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const events: Array<{ event: string; data: string }> = [];
    await consumeAuthedSse("/api/build/123", (event, data) => {
      events.push({ event, data });
    });

    const calls = fetchMock.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit?]
    >;
    const sseCall = calls.find(([url]) => String(url) === "/api/build/123");
    expect(sseCall).toBeTruthy();
    const options = sseCall?.[1] ?? {};
    expect(options.credentials).toBe("same-origin");
    expect(new Headers(options.headers).has("Authorization")).toBe(false);
    expect(events).toEqual([{ event: "done", data: '{"ok":true}' }]);
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

    expect(events).toEqual([{ event: "agent", data: '{"type":"start"}' }]);
  });
});

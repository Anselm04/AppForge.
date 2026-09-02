import { describe, it, expect, beforeEach } from "vitest";
import { authedUrl, getAccessToken, loginPathWithReturn } from "../auth.js";
import { parseSseFrame } from "../authedSse.js";

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

  it("sends JWT on generate SSE URL when a session exists", () => {
    window.localStorage.setItem(
      "appforge.session",
      JSON.stringify({
        accessToken: "jwt-token",
        user: { id: "u1", email: "owner@example.com" },
      }),
    );
    expect(getAccessToken()).toBe("jwt-token");
    expect(authedUrl("/api/build/42")).toBe("/api/build/42?token=jwt-token");
  });

  it("sends unsigned users to /login with next preserved (not signup)", () => {
    expect(loginPathWithReturn("/")).toBe("/login?next=%2F");
  });

  it("parses SSE agent frames used by generate", () => {
    const parsed = parseSseFrame(
      'event: agent\ndata: {"agent":"Planner","type":"start"}',
    );
    expect(parsed?.event).toBe("agent");
    expect(parsed?.data).toContain("Planner");
  });
});

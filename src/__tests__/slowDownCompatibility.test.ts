import { describe, expect, it } from "vitest";
import { createSlowDown, slowDownMiddleware } from "../middleware/slowDown.js";

describe("express-slow-down compatibility", () => {
  it("constructs the default middleware without throwing", () => {
    expect(() => createSlowDown()).not.toThrow();
  });

  it("constructs every production slowdown profile without throwing", () => {
    expect(() => slowDownMiddleware.gentle()).not.toThrow();
    expect(() => slowDownMiddleware.aggressive()).not.toThrow();
    expect(() => slowDownMiddleware.api()).not.toThrow();
  });
});

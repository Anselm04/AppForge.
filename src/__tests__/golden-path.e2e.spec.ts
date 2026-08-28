import { test, expect } from "vitest";

test("home route module exports", async () => {
  const mod = await import("../pages/Home.js");
  expect(mod).toBeDefined();
});

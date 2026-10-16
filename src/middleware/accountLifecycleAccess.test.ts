import { describe, expect, it } from "vitest";
import { accountLifecycleAllowsAccess } from "./accountLifecycleAccess.js";

describe("account lifecycle access boundary", () => {
  it("allows active accounts", () => {
    expect(accountLifecycleAllowsAccess("active")).toBe(true);
  });

  it.each(["pending", "completed"] as const)(
    "blocks %s accounts even when an access JWT is still valid",
    (state) => {
      expect(accountLifecycleAllowsAccess(state)).toBe(false);
    },
  );
});

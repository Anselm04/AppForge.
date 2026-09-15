import { describe, expect, it } from "vitest";
import {
  isPresenceFresh,
  isWritableCollaborationRole,
  validateVersionMetadata,
} from "../services/collaborationRuntime.js";

describe("collaboration runtime guardrails", () => {
  it("allows only owner and editor roles to create versions", () => {
    expect(isWritableCollaborationRole("owner")).toBe(true);
    expect(isWritableCollaborationRole("editor")).toBe(true);
    expect(isWritableCollaborationRole("viewer")).toBe(false);
    expect(isWritableCollaborationRole(null)).toBe(false);
  });

  it("expires stale presence heartbeats", () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    expect(isPresenceFresh(new Date("2026-09-14T23:59:00.000Z"), now)).toBe(
      true,
    );
    expect(isPresenceFresh(new Date("2026-09-14T23:58:00.000Z"), now)).toBe(
      false,
    );
  });

  it("rejects oversized version metadata", () => {
    expect(validateVersionMetadata({ label: "checkpoint" })).toEqual({
      label: "checkpoint",
    });
    expect(() =>
      validateVersionMetadata({ payload: "x".repeat(25_000) }),
    ).toThrow("Version metadata is too large");
  });
});

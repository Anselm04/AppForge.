import { beforeEach, describe, expect, it } from "vitest";
import {
  getStartupReadiness,
  markStartupDegraded,
  markStartupReady,
  resetStartupReadinessForTests,
} from "../services/startupState.js";

describe("startup readiness state", () => {
  beforeEach(() => resetStartupReadinessForTests());

  it("starts fail-closed while the HTTP process is booting", () => {
    expect(getStartupReadiness()).toMatchObject({
      ready: false,
      phase: "booting",
      reason: "initializing",
    });
  });

  it("records dependency degradation without declaring the process dead", () => {
    markStartupDegraded("database_schema");
    expect(getStartupReadiness()).toMatchObject({
      ready: false,
      phase: "degraded",
      reason: "database_schema",
    });
  });

  it("becomes ready only after initialization succeeds", () => {
    markStartupDegraded("database_schema");
    markStartupReady();
    expect(getStartupReadiness()).toMatchObject({
      ready: true,
      phase: "ready",
      reason: null,
    });
  });
});

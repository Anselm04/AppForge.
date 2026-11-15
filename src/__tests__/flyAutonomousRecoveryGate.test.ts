import { describe, expect, it } from "vitest";
import { flyAutonomousRecoveryAuthorized } from "../lib/flyAutonomousRecoveryGate.js";

describe("disconnected Fly.io autonomous recovery safety gate", () => {
  const approved = {
    APPFORGE_FLY_OWNER_RECONNECTED: "true",
    APPFORGE_AUTONOMOUS_PRODUCTION_DEPLOY: "true",
    FLY_API_TOKEN: "provider-token-present-but-never-used",
  };

  it("does not treat a legacy token alone as permission to deploy", () => {
    expect(flyAutonomousRecoveryAuthorized({ FLY_API_TOKEN: "token" })).toBe(
      false,
    );
    expect(flyAutonomousRecoveryAuthorized({})).toBe(false);
  });

  it("requires two explicit owner-controlled permissions and a configured token", () => {
    expect(flyAutonomousRecoveryAuthorized(approved)).toBe(true);
    for (const key of Object.keys(approved)) {
      expect(flyAutonomousRecoveryAuthorized({ ...approved, [key]: "" })).toBe(
        false,
      );
    }
    expect(
      flyAutonomousRecoveryAuthorized({
        ...approved,
        APPFORGE_FLY_OWNER_RECONNECTED: "false",
      }),
    ).toBe(false);
    expect(
      flyAutonomousRecoveryAuthorized({
        ...approved,
        APPFORGE_AUTONOMOUS_PRODUCTION_DEPLOY: "false",
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  createIncident,
  redactOperationalContext,
  severityForImpact,
} from "../incidentResponse.js";

describe("incident response", () => {
  it("maps critical customer-wide security or data-loss impact to SEV-1", () => {
    expect(severityForImpact({ customersAffected: "many", dataRisk: true, serviceDown: true })).toBe("SEV-1");
  });

  it("creates an incident with the full response lifecycle", () => {
    const incident = createIncident({
      summary: "Build queue is not progressing",
      severity: "SEV-2",
      affectedServices: ["build-queue"],
    });
    expect(incident.status).toBe("detected");
    expect(incident.responseStages).toEqual([
      "detect",
      "triage",
      "contain",
      "communicate",
      "recover",
      "evidence",
      "root-cause",
      "corrective-action",
      "regression-test",
    ]);
  });

  it("redacts secrets and direct personal identifiers from operational context", () => {
    const redacted = redactOperationalContext({
      email: "person@example.com",
      accessToken: "abc",
      password: "secret",
      queueAgeSeconds: 45,
      nested: { apiKey: "key", status: "failed" },
    });
    expect(JSON.stringify(redacted)).not.toContain("person@example.com");
    expect(JSON.stringify(redacted)).not.toContain("secret");
    expect(JSON.stringify(redacted)).toContain("45");
    expect(JSON.stringify(redacted)).toContain("failed");
  });
});

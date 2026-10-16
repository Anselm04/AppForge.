import { describe, expect, it } from "vitest";
import {
  DATA_RETENTION_REGISTRY,
  getRetentionRule,
  type RetentionDataKind,
} from "../dataRetention.js";

const REQUIRED_KINDS: RetentionDataKind[] = [
  "account_profile",
  "billing_records",
  "generated_projects",
  "generated_source_artifacts",
  "build_history",
  "application_logs",
  "security_events",
  "support_records",
  "analytics",
  "backups",
  "temporary_build_files",
  "uploaded_assets",
  "auth_tokens_sessions",
  "oauth_connections",
];

describe("DATA_RETENTION_REGISTRY", () => {
  it("defines one authoritative rule for every production-completeness data class", () => {
    expect(Object.keys(DATA_RETENTION_REGISTRY).sort()).toEqual(
      [...REQUIRED_KINDS].sort(),
    );

    for (const kind of REQUIRED_KINDS) {
      const rule = getRetentionRule(kind);
      expect(rule.kind).toBe(kind);
      expect(rule.owner.length).toBeGreaterThan(0);
      expect(rule.storage.length).toBeGreaterThan(0);
      expect(rule.retention.length).toBeGreaterThan(0);
      expect(rule.deletionBehavior.length).toBeGreaterThan(0);
      expect(rule.reason.length).toBeGreaterThan(0);
      expect(rule.backupBehavior.length).toBeGreaterThan(0);
      expect(rule.anonymizationBehavior.length).toBeGreaterThan(0);
      expect(typeof rule.customerExportEligible).toBe("boolean");
    }
  });

  it("never marks secrets or live authentication material as customer-exportable", () => {
    expect(
      getRetentionRule("auth_tokens_sessions").customerExportEligible,
    ).toBe(false);
    expect(getRetentionRule("oauth_connections").customerExportEligible).toBe(
      true,
    );
    expect(getRetentionRule("oauth_connections").exportFields).not.toContain(
      "accessToken",
    );
  });

  it("does not claim a legal or compliance certification", () => {
    const serialized = JSON.stringify(DATA_RETENTION_REGISTRY).toLowerCase();
    expect(serialized).not.toContain("gdpr compliant");
    expect(serialized).not.toContain("ccpa compliant");
    expect(serialized).not.toContain("soc 2 compliant");
    expect(serialized).not.toContain("hipaa compliant");
  });
});

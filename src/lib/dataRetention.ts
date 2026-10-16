export const RETENTION_DATA_KINDS = [
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
] as const;

export type RetentionDataKind = (typeof RETENTION_DATA_KINDS)[number];

export type DataRetentionRule = {
  kind: RetentionDataKind;
  owner: string;
  storage: string;
  retention: string;
  deletionBehavior: string;
  reason: string;
  backupBehavior: string;
  anonymizationBehavior: string;
  customerExportEligible: boolean;
  exportFields?: readonly string[];
};

export const DATA_RETENTION_REGISTRY: Record<
  RetentionDataKind,
  DataRetentionRule
> = {
  account_profile: {
    kind: "account_profile",
    owner: "AppForge account service",
    storage: "primary AppForge PostgreSQL users/account preference records",
    retention:
      "while the account is active; removed or anonymized during completed account deletion",
    deletionBehavior:
      "delete customer-facing profile values after deletion prerequisites complete; retain only detached audit references where separately required",
    reason:
      "account operation, authentication linkage and customer preferences",
    backupBehavior:
      "may remain in encrypted backups until the backup expires under the backup retention rule",
    anonymizationBehavior:
      "replace retained references with non-reversible internal subject identifiers where practical",
    customerExportEligible: true,
    exportFields: ["id", "email", "name", "createdAt", "updatedAt"],
  },
  billing_records: {
    kind: "billing_records",
    owner: "AppForge billing service",
    storage:
      "AppForge PostgreSQL billing/credit ledger plus Stripe customer records",
    retention:
      "seven years after the relevant transaction by default, subject to qualified accounting/legal review and provider requirements",
    deletionBehavior:
      "do not destroy required transaction evidence; detach or anonymize customer profile references where lawful and operationally safe",
    reason:
      "billing reconciliation, refunds, accounting, tax and dispute evidence",
    backupBehavior:
      "retained records follow encrypted backup expiry in addition to their primary-store retention",
    anonymizationBehavior:
      "remove unnecessary profile fields while preserving transaction identifiers and amounts required for reconciliation",
    customerExportEligible: true,
    exportFields: [
      "tier",
      "status",
      "trialEnd",
      "currentPeriodEnd",
      "creditBalance",
      "creditTransactions",
    ],
  },
  generated_projects: {
    kind: "generated_projects",
    owner: "AppForge project service",
    storage: "primary AppForge PostgreSQL project records",
    retention:
      "while owned by an active account, until customer deletion, or until an explicit project-deletion policy removes the project",
    deletionBehavior:
      "delete customer-owned project records when the account deletion policy selects deletion and no transfer/retention rule applies",
    reason: "customer product ownership, resume, modification and recovery",
    backupBehavior:
      "deleted projects can persist only inside encrypted backups until backup expiry",
    anonymizationBehavior:
      "not used for ordinary project deletion; retained operational evidence must remove customer-identifying content where possible",
    customerExportEligible: true,
    exportFields: [
      "id",
      "title",
      "description",
      "status",
      "techStack",
      "createdAt",
      "updatedAt",
    ],
  },
  generated_source_artifacts: {
    kind: "generated_source_artifacts",
    owner: "AppForge artifact/project services",
    storage:
      "project file/artifact persistence and configured artifact storage",
    retention:
      "for the lifetime of the owning project/account unless the customer deletes the project/account or an explicit artifact expiry applies",
    deletionBehavior:
      "delete customer-owned source/artifacts with the owning project unless a customer-controlled transfer/export completes first",
    reason:
      "source ownership, preview, deployment, export, update and rollback",
    backupBehavior:
      "deleted artifact content may remain in encrypted backups until backup expiry",
    anonymizationBehavior:
      "prefer deletion because generated source may contain customer-specific content",
    customerExportEligible: true,
    exportFields: ["files", "artifactVersion", "artifactIntegrity"],
  },
  build_history: {
    kind: "build_history",
    owner: "AppForge build orchestration service",
    storage:
      "PostgreSQL build runs/events/snapshots and bounded operational delivery stores",
    retention:
      "customer-visible project build history follows the project lifecycle; transient delivery data expires under its queue/cache policy",
    deletionBehavior:
      "remove customer-owned build content with project/account deletion unless a minimal detached audit record is required",
    reason:
      "resume, support, failure diagnosis, recovery and product-history integrity",
    backupBehavior:
      "primary-history deletions age out with encrypted backup expiry",
    anonymizationBehavior:
      "retained audit records must remove prompts, source and direct customer identifiers unless necessary for a documented security purpose",
    customerExportEligible: true,
    exportFields: ["status", "stage", "timestamps", "customerVisibleEvents"],
  },
  application_logs: {
    kind: "application_logs",
    owner: "AppForge operations",
    storage: "configured application logging/error-reporting providers",
    retention:
      "30 days by default unless the configured provider uses a shorter period",
    deletionBehavior:
      "expire automatically; targeted deletion is performed where supported if a log contains unnecessary personal data",
    reason: "short-term reliability diagnostics and incident investigation",
    backupBehavior:
      "logs are not intentionally copied into customer-data backups",
    anonymizationBehavior:
      "structured redaction must remove secrets and minimize direct identifiers before emission",
    customerExportEligible: false,
  },
  security_events: {
    kind: "security_events",
    owner: "AppForge security/operations",
    storage: "security audit/event persistence and configured security tooling",
    retention: "24 months by default, subject to incident/legal review",
    deletionBehavior:
      "retain minimum event evidence needed for security accountability; remove unrelated payload data",
    reason: "security investigation, abuse prevention and auditability",
    backupBehavior:
      "retained security records can be included in encrypted operational backups until backup expiry",
    anonymizationBehavior:
      "use internal subject IDs and minimize email/IP/payload data when full identity is no longer necessary",
    customerExportEligible: false,
  },
  support_records: {
    kind: "support_records",
    owner: "AppForge support/operations",
    storage: "AppForge support-case persistence",
    retention: "24 months after case closure by default",
    deletionBehavior:
      "remove attachments and unnecessary personal content at account deletion or case-retention expiry while preserving minimal resolution metrics if needed",
    reason:
      "customer support continuity, dispute resolution and prevention actions",
    backupBehavior:
      "support records age out of encrypted backups with the normal backup cycle",
    anonymizationBehavior:
      "detach closed-case analytics from direct customer identifiers after the case no longer requires identity",
    customerExportEligible: true,
    exportFields: [
      "caseId",
      "status",
      "category",
      "customerVisibleSummary",
      "resolution",
      "timestamps",
    ],
  },
  analytics: {
    kind: "analytics",
    owner: "AppForge product/operations",
    storage: "configured first-party/third-party analytics stores",
    retention:
      "13 months by default for identifiable analytics; aggregated metrics may be retained longer",
    deletionBehavior:
      "delete or detach user-level analytics when supported during account deletion; aggregated non-identifying statistics can remain",
    reason: "product reliability, usage measurement and capacity planning",
    backupBehavior:
      "analytics provider backup behavior follows provider configuration",
    anonymizationBehavior:
      "prefer aggregate or pseudonymous identifiers and remove direct profile fields",
    customerExportEligible: false,
  },
  backups: {
    kind: "backups",
    owner: "AppForge operations/recovery",
    storage:
      "encrypted database/off-site recovery backups configured by AppForge",
    retention:
      "35 days by default unless a shorter verified recovery policy is configured",
    deletionBehavior:
      "backups expire as immutable recovery units; individual records are not silently rewritten inside historical backup sets",
    reason: "disaster recovery and data-loss protection",
    backupBehavior: "this rule governs the backup copies themselves",
    anonymizationBehavior:
      "restored data must immediately re-apply current deletion/anonymization state before customer access is enabled",
    customerExportEligible: false,
  },
  temporary_build_files: {
    kind: "temporary_build_files",
    owner: "AppForge build/sandbox service",
    storage: "ephemeral build/sandbox workspace",
    retention:
      "24 hours maximum after the build attempt finishes unless an active recovery process needs a shorter bounded extension",
    deletionBehavior:
      "destroy workspace content after completion/failure/expiry",
    reason: "temporary compilation, validation and packaging",
    backupBehavior:
      "temporary build workspaces are not intentionally backed up",
    anonymizationBehavior: "not applicable; delete the workspace",
    customerExportEligible: false,
  },
  uploaded_assets: {
    kind: "uploaded_assets",
    owner: "AppForge asset/project service",
    storage: "configured AppForge asset storage and project metadata",
    retention: "while referenced by the owning project/account",
    deletionBehavior:
      "delete customer-owned assets when their project/account is deleted unless explicitly transferred/exported",
    reason: "customer product generation and editing",
    backupBehavior:
      "deleted assets may remain only in encrypted backups until backup expiry",
    anonymizationBehavior:
      "prefer deletion because assets can contain customer or end-user content",
    customerExportEligible: true,
    exportFields: [
      "name",
      "type",
      "size",
      "projectId",
      "customerOwnedLocation",
    ],
  },
  auth_tokens_sessions: {
    kind: "auth_tokens_sessions",
    owner: "Supabase Auth and AppForge session service",
    storage: "identity provider plus AppForge HttpOnly/session state",
    retention:
      "until token/session expiry, explicit revocation, logout-all or account deletion",
    deletionBehavior:
      "revoke and remove active session material during account deletion",
    reason: "authentication and session security",
    backupBehavior:
      "live authentication tokens must not be copied into customer exports or application backups",
    anonymizationBehavior: "not applicable; revoke/delete secret material",
    customerExportEligible: false,
  },
  oauth_connections: {
    kind: "oauth_connections",
    owner: "AppForge integration/auth services",
    storage:
      "provider metadata plus encrypted credential storage where required",
    retention: "until disconnect, credential revocation or account deletion",
    deletionBehavior:
      "revoke provider authorization where supported and delete AppForge credential material",
    reason: "customer-authorized provider integrations and source export",
    backupBehavior:
      "encrypted credential records can exist in recovery backups until backup expiry but must remain inaccessible outside controlled restore",
    anonymizationBehavior:
      "delete credentials; retained audit metadata should identify only provider/type and non-secret connection status",
    customerExportEligible: true,
    exportFields: [
      "provider",
      "username",
      "connectedAt",
      "updatedAt",
      "status",
    ],
  },
};

export function getRetentionRule(kind: RetentionDataKind): DataRetentionRule {
  return DATA_RETENTION_REGISTRY[kind];
}

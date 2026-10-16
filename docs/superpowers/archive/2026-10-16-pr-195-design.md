# Final Production Completeness — Architecture Design

Date: 2026-10-16
Status: Approved architecture, implementation not yet started
Baseline main commit: `27c4c32ad957b9e1d79c9596a45d392252cd59b0`
Scope owner: AppForge production-completeness programme

## 1. Purpose

This design completes the lifecycle and production-readiness layer around the existing AppForge product factory without expanding product categories or replacing systems that are already working.

The target customer lifecycle is:

`ACCOUNT CREATION → PRODUCT GENERATION → PRODUCT OWNERSHIP → PRODUCT UPDATES → DATA LIFECYCLE → SUPPORT → BILLING → INCIDENT HANDLING → ROLLBACK → LONG-TERM MAINTENANCE → SAFE CUSTOMER EXIT`

The programme must make this lifecycle safe, understandable, auditable, recoverable and supportable for a non-technical customer.

This is not a rewrite. The implementation must preserve and extend confirmed working systems.

## 2. Scope lock

In scope:

1. AppForge customer account lifecycle and personal-data lifecycle.
2. AppForge's own public legal, privacy, trust, support and policy surfaces.
3. One authoritative capability-claim truth mechanism.
4. Safe generated-product change, upgrade, migration, compatibility and rollback lifecycle.
5. Customer-facing operational failure handling, credit settlement, support and incident handling.
6. Final fresh production-completeness audit with evidence.

Out of scope unless required by one of the six areas above:

- adding new product categories;
- broad UI redesign;
- changing the preferred generated architecture;
- replacing ProductContract, ProductPlan, RequirementManifest or specialist-agent coordination;
- replacing the Builder Resource Library;
- replacing existing sandbox/build validation;
- replacing billing, credits or entitlement foundations;
- replacing deployment, recovery, export or auth systems that are already correct;
- adding paid infrastructure, subscriptions or commercial services without explicit owner approval.

## 3. Existing systems that are authoritative and must be preserved

The current codebase already has a substantial domain model and production machinery. This programme must compose with it rather than duplicate it.

The primary AppForge domain model already includes users, subscriptions, GitHub connections, user credits, credit transactions, projects, ProductContract, PromptIntent, ResearchRecord, ProductPlan, AgentCoordinationRecord, RequirementManifest and artifact-integrity state. Projects already track build lifecycle state, failure stage, output maturity, generated files, artifact version/integrity, credit reservation/spend, build capabilities and planning state.

Existing systems that remain authoritative include:

- ProductContract and ProductPlan;
- requirement manifests;
- specialist agents and agent coordination;
- iterative repair and self-healing;
- Builder Resource Library and resource-version evidence;
- sandbox isolation and build validation;
- adapter maturity/evidence;
- project snapshots/artifact integrity;
- billing, subscriptions, credits and entitlements;
- Stripe webhook idempotency mechanisms;
- deployment and recovery machinery;
- export paths;
- existing successful authentication paths;
- existing database-migration safety and rollback primitives;
- existing security/compliance record mechanisms where suitable;
- existing help centre and operational runbooks.

The connected Supabase project remains an important live dependency and identity/data integration, but this design does not create a second competing AppForge domain model in Supabase when canonical AppForge entities already exist in the primary Drizzle/Postgres schema.

## 4. Architectural principles

### 4.1 Extend, do not duplicate

Every new lifecycle feature must first locate the current source of truth and extend it. New tables or services are permitted only when the responsibility does not already exist.

### 4.2 Fail closed on truth and safety

Public capability claims, destructive data actions, destructive migrations, unsupported rollbacks and uncertain billing settlements must default to the safer state when evidence is missing, stale or contradictory.

### 4.3 One owner, one tenancy boundary

Every user-controlled resource must be guarded by server-side ownership checks. Client-provided user IDs are never sufficient authorization. Cross-tenant access must fail without revealing resource contents.

### 4.4 Idempotent lifecycle operations

Account deletion, data export creation, billing settlement, support-case transitions, migrations and incident operations must be safe to retry. External events and retries must not duplicate charges, refunds, exports, migrations or destructive actions.

### 4.5 Preserve the last known-good state

Generated-product changes must not silently destroy a working project. A change either reaches a verified new state or leaves/reconstructs a known-good state through rollback or a proven forward repair path.

### 4.6 Evidence before claims

Internal maturity, production certification and public marketing claims must all derive from recorded evidence. A new resource version, adapter version, generated artifact or runtime regression cannot inherit stronger evidence merely because an older version had it.

### 4.7 NZ$0 additional deliberate spend by default

Prefer existing services, current plans, repository code, current databases and current observability. No paid upgrade or new commercial dependency is authorized by this programme.

## 5. Current-state findings that drive this design

The Phase 0 audit found substantial foundations alongside several real lifecycle gaps.

### 5.1 Account lifecycle

Existing account UI supports current-user inspection, password change, reauthentication and session revocation. Password reset/recovery paths exist. However, the audited AppForge account surface does not yet provide a complete customer-owned lifecycle for profile/preferences, verified email change, customer data export and safe account deletion.

### 5.2 AppForge legal/trust surfaces

A public help route exists, but dedicated AppForge-owned privacy and terms routes were not found on the audited baseline. Generated-product compliance scaffolding must not be mistaken for AppForge's own policy surfaces.

### 5.3 Capability truth

Strong maturity/evidence mechanisms already exist in adapters, resource governance and production certification. The missing layer is one authoritative public-claim resolver that combines those signals and automatically downgrades claims when evidence regresses or becomes stale.

### 5.4 Product updates and rollback

AppForge already has snapshots, iterative rollback behavior, database migration rollback requirements, recovery rules and production-certification invalidation concepts. The missing lifecycle layer is a canonical ChangeContract plus compatibility/update coordination across requirements, data, API, UI, permissions, billing, platform and resource versions.

### 5.5 Support and incidents

A Help Center and operational/security runbooks exist, and compliance/security incident records are already used. A customer-owned support-case model and one consistent incident-severity/governance model were not found.

### 5.6 Billing failure settlement

Billing, subscriptions, credits, reservations, webhook idempotency and refund paths already exist. The remaining need is a single explicit settlement policy covering build failure classes so a user can always understand whether credits were spent, released, refunded or pending reconciliation.

### 5.7 Security configuration

The connected Supabase project reports leaked-password protection as disabled. This is an external/configuration hardening item to verify and resolve through supported configuration mechanisms, not a reason to redesign authentication.

## 6. Component design

## 6.1 Account Lifecycle Service

Create a narrow account-lifecycle service that orchestrates existing auth, user, project, subscription, credit and integration systems.

Responsibilities:

- profile/preferences update using existing user identity;
- verified email-change workflow;
- destructive-action reauthentication;
- data-export request and generation;
- account-deletion workflow;
- global session revocation;
- integration/token revocation where AppForge owns the credential;
- subscription/entitlement shutdown coordination;
- lifecycle audit events;
- retry-safe failure recovery.

The service must not own login or replace the existing auth router/provider.

### Email change

Required behavior:

1. User starts change from an authenticated account.
2. Fresh authentication is required.
3. New address must be verified through the configured identity provider flow.
4. Until verification succeeds, the existing verified address remains authoritative wherever the provider supports that behavior.
5. Security notifications are sent to the appropriate existing/new address when supported by the configured provider.
6. Duplicate/occupied email failures are handled without exposing another account's details.
7. Sessions are re-evaluated according to provider security semantics.

### Customer data export

The export must be customer-readable and machine-readable where practical.

Include only data owned by or directly about that customer, for example:

- account/profile data;
- project metadata;
- ProductContract/ProductPlan/RequirementManifest data;
- generated project artifacts that the customer is entitled to export;
- build/snapshot history suitable for customer disclosure;
- billing/subscription/credit history that AppForge is permitted to disclose;
- support cases and customer-visible communications;
- relevant settings/preferences.

Exclude:

- secrets and credentials;
- other users' data;
- internal security signals whose disclosure would weaken defenses;
- proprietary internal prompts/reasoning not part of the customer's product artifact;
- shared infrastructure data unrelated to the customer.

Exports must be scoped server-side and must not be guessable by URL or identifier.

### Account deletion

Account deletion must be an idempotent orchestrated process, not a single uncontrolled cascade.

The flow must:

1. require recent authentication;
2. show clear consequences before confirmation;
3. prevent new builds/actions once destructive processing begins;
4. revoke or end sessions;
5. disable future billing/subscription behavior through existing billing controls;
6. disable entitlements and unused access according to existing billing/refund policy;
7. resolve or cancel active jobs safely;
8. delete, anonymize or retain records according to the retention registry;
9. revoke AppForge-owned external tokens where possible;
10. delete the identity using the supported identity-provider mechanism only after dependent cleanup is in a recoverable state;
11. record a non-sensitive completion/audit marker where legally/operationally necessary;
12. remain safe if any individual step is retried.

Financial, fraud/security and legally required records must not be indiscriminately destroyed if retention is necessary. Where identity linkage is no longer needed, records should be anonymized or pseudonymized rather than left attached to the deleted profile.

## 6.2 Data Retention Registry

Create one version-controlled retention registry describing each relevant AppForge data class.

Each entry must define:

- data class;
- source of truth;
- purpose;
- customer-visible or internal classification;
- normal retention rule;
- deletion behavior;
- anonymization behavior;
- legal/financial/security exception if any;
- owning service;
- verification test or evidence source.

The registry should be code/config plus documentation, not a parallel data warehouse.

Runtime deletion orchestration may require a small lifecycle ledger for retry state and auditability, but the retention policy itself remains version controlled.

## 6.3 AppForge Legal and Trust Content Layer

Add public, version-controlled AppForge-owned surfaces for the actual service.

Required routes/content:

- Privacy Policy;
- Terms of Service;
- Acceptable Use Policy where behavior requires it;
- Refund/Billing policy or billing terms where not already fully covered;
- Security/Trust information limited to verified practices;
- Support/contact information.

Rules:

- pages must describe AppForge's real behavior;
- generated-customer-app legal templates are never reused as AppForge policy by implication;
- no unsupported certifications or regulatory claims;
- do not claim SOC 2, ISO 27001, GDPR compliance, CCPA compliance, WCAG conformance or similar status unless separately verified and approved;
- policy effective date/version must be visible;
- material future policy changes should be traceable in source control;
- text should be written so legal counsel can later revise it without changing application logic.

## 6.4 Capability Claim Resolver

Create one authoritative resolver used by public surfaces and internal customer-facing capability presentation.

Inputs may include:

- adapter maturity/evidence;
- Builder Resource Library maturity/evidence;
- runtime/build evidence;
- packaging/deployment evidence;
- target platform evidence;
- capability-specific verification;
- artifact/version identity;
- freshness/validity of evidence.

The resolver produces a conservative claim state such as:

- not supported;
- experimental;
- supported with limitations;
- verified;
- production-ready/certified only where exact evidence permits.

The resolver must never infer a stronger public claim from marketing copy or static configuration alone.

Regression rule:

If required evidence is invalidated, stale, version-mismatched or failed, the public claim automatically falls to the highest still-supported state.

All public capability lists/pricing comparisons/build-target selectors that make factual support claims must use this resolver or a projection produced by it.

## 6.5 ChangeContract

Introduce a canonical `ChangeContract` for modifications to an existing generated product.

The ChangeContract references:

- project identity;
- current known-good artifact/snapshot version;
- current ProductContract;
- requested change;
- added requirements;
- changed requirements;
- removed requirements;
- affected resource versions;
- affected adapters/platforms;
- data/schema impact;
- API compatibility impact;
- UI/UX impact;
- permission/security impact;
- billing/monetization impact;
- deployment impact;
- rollback constraints;
- required validation/certification gates;
- approval requirements for destructive/high-risk operations.

The ChangeContract is not a replacement for ProductContract. It is the explicit delta between a known product state and a requested future state.

## 6.6 Compatibility Analyzer

Before applying a ChangeContract, analyze compatibility.

The analyzer classifies changes such as:

- additive/non-breaking;
- behavior-changing but compatible;
- API breaking;
- data migration required;
- destructive data migration;
- security/permission-sensitive;
- billing-sensitive;
- platform/deployment-sensitive;
- unsupported/unknown.

Unknown/high-risk changes fail closed into a review/approval or safe-repair path rather than silently proceeding.

### API governance

Generated APIs need explicit compatibility checks where an existing consumer could break.

At minimum:

- compare externally exposed routes/contracts when available;
- identify removed/renamed required fields/endpoints;
- identify incompatible type/validation changes;
- require explicit versioning or migration strategy for breaking changes;
- record compatibility outcome in change evidence.

## 6.7 Upgrade and Migration Coordinator

Coordinate a product update through the existing build, resource, snapshot, migration and validation systems.

Lifecycle:

1. capture current known-good version;
2. create/validate ChangeContract;
3. resolve resource/adapter versions explicitly;
4. run compatibility analysis;
5. generate migration/update plan;
6. require approval for destructive/high-risk operations;
7. create pre-change recovery point where required;
8. execute in isolated build/sandbox context;
9. run focused validation;
10. run required broader validation;
11. promote only if evidence gates pass;
12. otherwise roll back or perform a proven safe forward repair;
13. persist resulting product/change/version evidence.

### Database migrations

Reuse the existing migration-agent safety rules.

Additional lifecycle requirements:

- destructive migrations are explicitly classified;
- a tested backup/recovery path is required before production destructive migration;
- every migration has a rollback or documented forward-fix strategy;
- inability to prove a safe rollback must be visible before execution;
- migration evidence is bound to the exact product version.

### Resource upgrades

Generated products pin resource versions used for the known-good build.

A newer library resource version is not silently substituted into an existing customer product merely because it exists. Upgrade occurs through ChangeContract/update planning and must re-earn the required evidence for the resulting product version.

## 6.8 Failure Settlement Policy

Create one explicit policy for credit/billing disposition when builds fail.

The policy maps failure class/stage to outcomes such as:

- reservation released without charge;
- charged work retained because value was delivered;
- automatic refund/re-credit;
- retry without a second charge;
- manual reconciliation required;
- customer action required.

It must reuse current credit reservation/transaction and Stripe idempotency foundations.

Required properties:

- one settlement decision per billable operation;
- idempotency across worker retries/webhook retries;
- no duplicate refunds;
- no duplicate consumption on retry;
- customer-visible explanation;
- internal audit trail;
- explicit behavior for provider outage, validation failure, user cancellation, credits exhausted, deployment failure and worker timeout/crash.

## 6.9 Customer Failure Envelope

Expose a safe, understandable failure status to the customer without exposing sensitive internal logs.

Suggested fields:

- stage;
- status;
- concise explanation;
- whether AppForge is retrying;
- whether customer action is required;
- whether the last known-good project is safe;
- credit disposition;
- recommended next action;
- support-case link where applicable.

Detailed traces remain internal and access-controlled.

## 6.10 Support Case Model

Add a minimal tenancy-safe support-case system integrated with the existing Help Center rather than replacing it.

A support case should support:

- customer owner;
- optional project/build reference;
- category;
- severity/impact;
- status;
- customer message;
- internal notes separated from customer-visible content;
- timestamps;
- resolution summary;
- optional incident association.

Server-side tenancy checks are mandatory.

Do not create a large CRM. This is an AppForge operational support primitive.

## 6.11 Incident Severity and Response Model

Reuse existing recovery/security/compliance runbooks and records, adding one shared severity vocabulary and lifecycle.

Suggested operational severity:

- SEV-1: widespread critical outage, severe data/security risk, or billing integrity failure;
- SEV-2: major degradation or significant customer impact without SEV-1 scope;
- SEV-3: limited customer impact with workaround or contained failure;
- SEV-4: low-impact operational defect/investigation.

Incident records need:

- severity;
- affected systems;
- start/detection/resolution timestamps;
- owner/status;
- customer impact summary;
- mitigations;
- recovery actions;
- customer communication decision;
- post-incident follow-up.

Existing compliance/security records should be extended/reused where that provides one source of truth. Do not create parallel incident databases if the current schema can represent the required fields safely.

## 6.12 Observability Integration

Before adding telemetry, inventory current logging, error tracking, metrics, PostHog/Sentry/Datadog integrations and provider diagnostics.

Only fill missing signals required for lifecycle decisions, such as:

- account deletion failures;
- export generation failures;
- build settlement discrepancies;
- migration failures;
- rollback failures;
- support/incident state;
- capability-evidence regression.

Avoid parallel observability stacks and avoid transmitting secrets or unnecessary personal data.

## 7. Data-model strategy

The implementation plan must audit the full existing Drizzle schema before creating migrations.

Likely new persistent concepts are:

- account lifecycle operation state/ledger if required for idempotent deletion/export processing;
- support cases;
- ChangeContract/change records;
- product change/version evidence not already representable by snapshots;
- incident fields only if current compliance records cannot safely carry them.

The following should preferentially be represented without new tables:

- retention policy: version-controlled registry/config;
- capability claim policy: resolver code + existing evidence stores;
- failure settlement rules: version-controlled policy + existing credit transactions/reservations;
- legal/trust copy: version-controlled content/routes.

No schema migration is authorized merely because a concept appears in this design. The implementation plan must prove the existing schema cannot represent the requirement cleanly before introducing a new table.

## 8. Security requirements

The programme must explicitly test:

- IDOR/cross-tenant access attempts;
- account export cross-tenant isolation;
- support-case tenancy;
- session revocation after destructive account actions;
- reauthentication requirements;
- CSRF/origin rules for lifecycle mutations;
- privilege checks for admin/incident operations;
- secret/token exclusion from exports and customer-facing errors;
- webhook replay/idempotency;
- deletion retry behavior;
- migration authorization and destructive-change approval;
- rollback authorization;
- capability-claim fail-closed behavior.

The Supabase leaked-password-protection warning must be treated as a tracked external configuration gap. It should be enabled only through a supported provider configuration path after verifying compatibility with existing auth flows.

## 9. Test strategy

Implementation follows focused tests first, then broad validation.

### 9.1 Account lifecycle

Tests must cover:

- successful profile update;
- successful and failed verified email change;
- duplicate email behavior;
- fresh-auth requirement;
- export completeness and secret exclusion;
- export tenant isolation;
- deletion happy path;
- deletion interrupted/retried at each external step;
- active build handling during deletion;
- billing/entitlement shutdown;
- session invalidation;
- retained/anonymized financial/security records.

### 9.2 Legal/trust

Tests must verify public availability, route stability, effective-version metadata and no unsupported claims introduced by page content.

### 9.3 Capability claims

Tests must prove:

- claim cannot exceed weakest required evidence;
- version mismatch invalidates inherited evidence;
- failed verification downgrades claim;
- stale evidence behaves according to policy;
- public UI consumes the resolver rather than hard-coded optimistic claims.

### 9.4 Product changes

Tests must cover:

- additive feature change;
- changed requirement;
- removed requirement;
- API breaking change;
- resource-version upgrade;
- safe database migration;
- destructive migration requiring approval;
- failed migration rollback;
- rollback-not-safe forward-fix classification;
- certification invalidation and re-certification;
- persistence of resulting ChangeContract/evidence.

### 9.5 Billing and failures

Tests must cover duplicate/delayed Stripe events, worker retry, provider outage, timeout/crash, deployment failure, user cancellation and validation failure with exactly one financial disposition.

### 9.6 Support and incidents

Tests must cover case ownership, internal/customer-visible separation, incident severity transitions, incident association and unauthorized access.

### 9.7 Broad verification

After focused suites pass:

- unit tests;
- integration tests;
- customer-flow/e2e tests;
- build/typecheck/lint as applicable;
- security checks;
- recovery tests;
- production canary/smoke tests where current environment access permits;
- external dependency verification.

## 10. External dependency verification

The programme must maintain a current dependency/evidence table for externally controlled capabilities such as:

- Supabase authentication/email settings;
- social sign-in providers;
- Stripe behavior/configuration;
- production database/recovery configuration;
- deployment providers;
- email delivery;
- GitHub integration;
- observability providers;
- any platform capability requiring third-party credentials/approval.

A source-code configuration test is not proof that the external service works in production.

Where live verification cannot be performed, final evidence must state the exact blocker and must not convert it into a passing result.

## 11. Programme evidence

The canonical programme evidence file is:

`programme-evidence/final-production-completeness.md`

It must be maintained throughout implementation and finalized with:

- starting baseline;
- scope completed;
- architecture preserved;
- migrations/changes introduced;
- tests and commands run;
- production/live checks performed;
- external systems verified;
- failures found and repaired;
- unresolved external/manual blockers;
- deliberate additional spend (target NZ$0);
- final production-completeness verdict.

The verdict must be conservative. Code presence is not equivalent to production proof.

## 12. Implementation sequence

The implementation plan should break work into reviewable vertical slices in this order:

1. lock baseline and create evidence scaffold;
2. audit full canonical persistence/auth/billing/observability paths required by the design;
3. account lifecycle + data retention/export/deletion;
4. AppForge legal/trust/public policy surfaces;
5. capability claim resolver and public projection;
6. ChangeContract + compatibility analyzer;
7. update/migration/resource-upgrade lifecycle integration;
8. failure settlement + customer failure envelope;
9. support cases + incident severity/governance;
10. focused security/failure-path validation;
11. broad regression/recovery validation;
12. fresh production completeness audit;
13. resolve all internally actionable findings from that audit;
14. finalize programme evidence and conservative readiness verdict.

Each slice must begin by locating the existing implementation it extends and must contain tests that prove the new lifecycle behavior.

## 13. Completion standard

The programme is complete only when evidence shows that a normal non-technical customer can:

- sign up and verify their account;
- sign in and recover access;
- pay/receive the correct entitlement;
- generate a product;
- leave and later return to it;
- request a meaningful product change through a controlled lifecycle;
- preserve or recover a last known-good version when a change fails;
- understand build failures and credit disposition;
- deploy/recover through supported flows;
- obtain support;
- manage/cancel billing;
- export their product and customer-held data where applicable;
- safely delete their AppForge account;
- rely on public capability statements that do not exceed current evidence.

AppForge must protect user/project data throughout those transitions and must not require the customer to become a developer to repair ordinary lifecycle failures.

## 14. Explicit non-goals for final certification

The final audit must not fail this programme merely because AppForge lacks unrelated future product categories, marketplace expansion or speculative enterprise features.

Conversely, it must not mark the programme complete while hiding an unverified lifecycle dependency behind a TODO, optimistic documentation or a mocked test.

The purpose is production completeness for the defined lifecycle, not feature-count inflation.

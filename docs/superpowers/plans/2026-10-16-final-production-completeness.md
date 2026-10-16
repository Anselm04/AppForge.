# AppForge Final Production Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete only the approved production-readiness and lifecycle programme from account creation through long-term product ownership, support, billing, rollback and safe customer exit without rebuilding working AppForge systems.

**Architecture:** Extend existing AppForge auth, billing, project history, recovery, capability evidence, Builder Resource Library, observability and deployment systems. Add narrowly-scoped authoritative lifecycle registries/contracts where the current repository has genuine gaps, then prove the complete customer and failure journeys before issuing a production-readiness verdict.

**Tech Stack:** TypeScript, React, tRPC, Drizzle/Postgres, Supabase Auth, Stripe, Vitest, existing AppForge CI/security/recovery tooling.

**Spec:** `docs/superpowers/specs/2026-10-16-final-production-completeness-design.md`

## Global Constraints

- Repository: `Anselm04/AppForge.`
- Baseline `main`: `d2fae207e103bac5f3bd9692bc6ca5ccafba29fb`.
- Branch: `production-completeness-programme`.
- NZ$0 additional deliberate spend unless the user explicitly approves otherwise.
- Do not rebuild or duplicate working systems.
- Preserve ProductContract, ProductPlan, requirement manifests, specialist agents, iterative repair, Builder Resource Library, sandbox isolation, adapter maturity, billing, credits, entitlements, deployment, recovery, exports and successful authentication paths.
- Do not claim legal/compliance or production readiness without evidence.
- Run focused tests before broader tests; fix the smallest responsible scope.
- Stay strictly inside Phases 0–14 of the approved programme.

## Review Focus

- Account deletion must not cascade away financial/security records that require retention; tests must prove retained records are anonymized/detached and no longer customer-accessible.
- Customer export must never include provider/AppForge secrets or another tenant's data; tests must include malicious/cross-tenant export attempts.
- Public capability claims must automatically downgrade when evidence is stale, missing or quarantined; tests must pin fail-closed behavior.
- Generated-product migrations must preserve customer data across destructive-looking changes and explicitly choose rollback vs forward recovery; migration tests own this.
- Credit settlement must be idempotent across duplicate/retried failures and must not charge customers for AppForge-caused failures; settlement tests own this.

---

### Task 1: Phase 0 evidence baseline and audit record

**Files:**
- Create: `programme-evidence/final-production-completeness.md`
- Modify only if needed: `docs/RECOVERY_INVENTORY.md`

**Interfaces:**
- Consumes: baseline SHA and current repository evidence.
- Produces: authoritative programme evidence document used by all later tasks.

- [ ] Record baseline SHA, audited systems, preserved working functionality, genuine gaps, open external blockers and current readiness boundary.
- [ ] Record that uncommitted Linux-desktop state cannot be observed through GitHub and therefore `main` is the immutable programme baseline.
- [ ] Verify evidence contains no unsupported readiness claim.
- [ ] Commit.

### Task 2: Phase 1 retention registry and customer export

**Files:**
- Create: `src/lib/dataRetention.ts`
- Create: `src/lib/customerDataExport.ts`
- Create: `src/lib/__tests__/dataRetention.test.ts`
- Create: `src/lib/__tests__/customerDataExport.test.ts`
- Modify: `src/routers/index.ts`
- Modify or create focused account router following existing router conventions.

**Interfaces:**
- Produces: `DATA_RETENTION_REGISTRY`, `getRetentionRule(kind)`, `buildCustomerDataExport(userId)`.

- [ ] Write failing tests covering every required data class, export eligibility, secret exclusion and cross-tenant denial.
- [ ] Implement machine-readable retention registry with owner, storage, retention rule, deletion, reason, backup, anonymization and export behavior.
- [ ] Implement customer-data export using current ownership checks and existing project/export data sources.
- [ ] Exclude AppForge/provider secrets, tokens, encrypted credentials, internal security material and other tenants.
- [ ] Run focused tests; commit.

### Task 3: Phase 1 profile, preferences, email change and deletion lifecycle

**Files:**
- Modify: `src/db/schema.ts`
- Add migration under repository's existing migration convention.
- Create: `src/services/accountLifecycle.ts`
- Create: `src/routers/account.ts`
- Modify: `src/routers/index.ts`
- Modify: `src/pages/Account.tsx`
- Modify: `src/pages/Settings.tsx`
- Create focused tests under existing router/service/page test locations.

**Interfaces:**
- Produces: profile/preferences update, verified email-change initiation/reconciliation, deletion request/execute contract, deletion status.

- [ ] Write failing tests for editable persisted profile/preferences, verified email transition, stale/invalid email-change recovery and safe errors.
- [ ] Write failing tests proving deletion stops/promotes no pending builds, revokes sessions/tokens, disables entitlements, handles projects/artifacts per retention registry, removes OAuth connections and does not expose orphan records.
- [ ] Add only required persisted preference/deletion state fields.
- [ ] Implement account lifecycle service and protected router.
- [ ] Update Account/Settings UX with explicit irreversible confirmation and status messaging.
- [ ] Verify existing password/session paths still pass.
- [ ] Commit.

### Task 4: Phase 2 AppForge public legal/trust routes

**Files:**
- Create public policy source/version module under `src/lib/`.
- Create pages: Privacy, Terms, Acceptable Use, Refund Policy, Security/Trust as appropriate to actual behavior.
- Modify: `src/App.tsx`
- Modify: `src/components/SiteFooter.tsx`
- Add route/content tests.

**Interfaces:**
- Produces stable public `/privacy`, `/terms`, `/acceptable-use`, `/refund-policy`, `/security`, existing `/help` support surface.

- [ ] Write route tests proving unauthenticated access and stable content version metadata.
- [ ] Author internally consistent content describing actual AppForge behavior and qualified-legal-review status; no fake compliance claims.
- [ ] Add footer links.
- [ ] Verify OAuth redirect expectations in code and document only unprovable provider-console steps in evidence.
- [ ] Commit.

### Task 5: Phase 3 capability-claim truth resolver

**Files:**
- Create: `src/lib/capabilityClaims.ts`
- Create: `src/lib/__tests__/capabilityClaims.test.ts`
- Modify: `src/routers/capabilities.ts`
- Modify public feature presentation files only where required.

**Interfaces:**
- Produces: `resolveCapabilityClaim(input)` with internal maturity, customer-safe wording, limitations, prerequisites, evidence freshness and downgrade reason.

- [ ] Write failing tests for missing, stale, regressed and quarantined evidence.
- [ ] Reuse existing adapter/resource/certification evidence; do not create a parallel maturity model.
- [ ] Make public capability responses fail closed/downgrade automatically.
- [ ] Bind static landing/feature claims to resolved evidence or neutral bounded wording.
- [ ] Commit.

### Task 6: Phase 4 generated-product ChangeContract

**Files:**
- Create: `src/lib/changeContract.ts`
- Create: `src/lib/__tests__/changeContract.test.ts`
- Modify project persistence/schema only as needed to persist immutable change records.
- Modify iteration/planning entry point to consume ChangeContract for existing-project updates.

**Interfaces:**
- Produces machine-readable ChangeContract linked to original ProductContract and project history.

- [ ] Write failing schema/tests for added/changed/removed requirements, compatibility, data/API/UI/platform/billing/permission/security/resource and recovery impacts.
- [ ] Implement immutable change-contract creation and persistence.
- [ ] Feed change contract into planning/specialist/regression path without rewriting original ProductContract.
- [ ] Commit.

### Task 7: Phase 5 migration and API compatibility safety

**Files:**
- Extend existing migration agent/database policy files.
- Create focused migration-analysis and API-compatibility modules/tests if no authoritative equivalent exists.

**Interfaces:**
- Produces schema-change classification, migration safety plan and API breaking-change strategy.

- [ ] Add tests for add field, rename field, split table, enum change, relationship, field removal, unique constraint, index and authorization/RLS change.
- [ ] Require pre-change recovery evidence for destructive operations and rollback or explicit forward-fix strategy.
- [ ] Separate seed-data changes from customer records.
- [ ] Add API contract diff tests for compatible extension, versioning, coordinated release and explicit breaking upgrade.
- [ ] Commit.

### Task 8: Phase 6 resource upgrade and safe rollback lifecycle

**Files:**
- Extend Builder Resource usage/version metadata and project evolution/recovery modules.
- Add focused resource-upgrade and rollback tests.

**Interfaces:**
- Produces explicit resource upgrade plan and code/database/provider/webhook/job/feature-flag/resource recovery plan.

- [ ] Prove exact consumed resource versions remain pinned for existing products.
- [ ] Prevent silent replacement by newer library versions.
- [ ] Implement candidate impact analysis, migration/adaptation, regression/behavior comparison and explicit recovery strategy.
- [ ] Reject rollback claims when data state makes rollback unsafe; require forward recovery.
- [ ] Commit.

### Task 9: Phase 7 support cases and failed-build customer experience

**Files:**
- Add support-case schema/migration only if no persistent support model exists.
- Create support service/router and customer-safe build-failure mapper.
- Modify Build/Admin/Help surfaces only where required.
- Add tenancy and redaction tests.

**Interfaces:**
- Produces support case CRUD under strict authorization and customer-safe build failure status.

- [ ] Test stage/retry/action/credit/project-safety/next-step messaging without raw internal provider garbage.
- [ ] Implement support case fields from approved scope, cross-tenant denial and linked evidence references.
- [ ] Keep internal technical notes owner/support-only.
- [ ] Commit.

### Task 10: Phase 8 credit/failure settlement

**Files:**
- Extend existing credit ledger/build settlement modules.
- Add focused idempotency/failure-policy tests.

**Interfaces:**
- Produces one authoritative settlement classification/result consumed by build completion/failure paths.

- [ ] Test early failure, AppForge defect, provider outage, customer invalid credentials, external rejection, timeout, interruption, duplicate event, retry success and cancellation.
- [ ] Ensure AppForge-caused failures restore/reserve credits fairly.
- [ ] Ensure duplicate/replayed events cannot double-refund or double-charge.
- [ ] Commit.

### Task 11: Phase 9 incident response, observability and abuse controls

**Files:**
- Create/extend incident model/runbook only where existing conventions are insufficient.
- Extend telemetry/metrics/rate-limit tests at existing locations.

**Interfaces:**
- Produces SEV classification and incident lifecycle using existing logs/metrics/Sentry/recovery.

- [ ] Reuse existing SEV convention if found; otherwise implement SEV-1..4 from the spec.
- [ ] Cover detection, triage, containment, communication, recovery, escalation, evidence, RCA, corrective action and regression test linkage.
- [ ] Audit metrics/logs for auth, billing, webhook, provider, queue, deployment and build failures with sensitive-data redaction.
- [ ] Validate abuse controls for signup/login/reset/build/API/provider cost/upload/prompt/webhook.
- [ ] Commit.

### Task 12: Phases 10–11 complete customer and failure journeys

**Files:**
- Add/extend integration/e2e tests under existing test conventions.
- Update programme evidence.

**Interfaces:**
- Produces executable ordinary-customer and failure-path evidence.

- [ ] Test full discover→delete journey with non-owner customer identity.
- [ ] Test refresh/new-device/session-expiry and return/resume behavior.
- [ ] Test requested failure classes and data-loss scenarios.
- [ ] Record any externally blocked live-provider steps instead of simulating success.
- [ ] Commit.

### Task 13: Phase 12 security, privacy, accessibility, performance and business-rule audits

**Files:**
- Add focused regression tests/scripts where gaps are found.
- Update programme evidence.

**Interfaces:**
- Produces evidence-backed audit results; no certification by assertion.

- [ ] Re-run auth/authz/tenancy/IDOR/RLS/session/CSRF/XSS/injection/SSRF/upload/secrets/webhooks/OAuth/dependency/isolation/log/admin/backup validation.
- [ ] Audit actual PII, analytics, deletion/export/retention/backups/third-party/OAuth/support behavior.
- [ ] Audit keyboard/focus/labels/contrast/errors/screen-reader/responsive/reduced-motion behavior without claiming formal WCAG conformance.
- [ ] Measure landing/login/dashboard/project/build-stream/large-log/large-project/export/resource-query performance and fix only real programme-scope bottlenecks.
- [ ] Verify pricing, credit quantities, owner isolation, trials, plan changes/cancellation/failures/refunds and Stripe duplicate/delayed events.
- [ ] Commit.

### Task 14: Phases 13–14 fresh final-gap audit and verdict

**Files:**
- Finalize: `programme-evidence/final-production-completeness.md`
- Create external-dependency map in evidence or a dedicated referenced document.

**Interfaces:**
- Produces final evidence and exact production-readiness verdict.

- [ ] Freshly trace what can still stop a non-technical customer from first visit through long-term ownership and safe exit.
- [ ] Create definitive actual external-dependency map with purpose, required/optional, auth, secrets, sandbox, manual action, failure, fallback, cost and policy/licensing constraints.
- [ ] Run focused suites, broad tests, build, security gates and relevant CI checks available at NZ$0.
- [ ] Record remaining manual/external blockers exactly; do not fake live verification.
- [ ] Distinguish repository implementation complete, automated verification complete, external/manual verification complete and paying-customer production-ready.
- [ ] Commit final evidence.
- [ ] Open programme PR against `main` and allow CI/security checks to determine merge readiness.

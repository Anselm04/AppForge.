# AppForge Final Production Completeness — Reconcile and Certify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the existing PR #194 production-completeness implementation with current `main`, verify every approved lifecycle requirement against code and tests, fix only proven gaps, and produce an evidence-backed merge/readiness verdict.

**Architecture:** Treat PR #194 (`production-completeness-programme`, head `8b7266afb97b3ad8426cbbcfa31c6a45799dcda1`) as the candidate implementation rather than rebuilding its 49 changed files. Rebase/merge it onto current `main` (`27c4c32ad957b9e1d79c9596a45d392252cd59b0`), then review and repair by subsystem while preserving the existing ProductContract/ProductPlan, Builder Resource Library, auth, billing, credits, snapshots, recovery, deployment and export foundations.

**Tech Stack:** TypeScript 5.9, React 18, React Router 7, tRPC 11, Drizzle/Postgres, Supabase Auth, Stripe, BullMQ, Vitest 4, existing AppForge CI/security/recovery tooling.

**Spec:** `docs/superpowers/specs/2026-10-16-final-production-completeness-design.md`

**Candidate implementation:** PR #194, branch `production-completeness-programme`, base originally `d2fae207e103bac5f3bd9692bc6ca5ccafba29fb`, currently 83 commits ahead of the merge base and 3 commits behind current `main`.

## Global Constraints

- Repository: `Anselm04/AppForge.`
- Current audited `main`: `27c4c32ad957b9e1d79c9596a45d392252cd59b0`.
- NZ$0 additional deliberate spend unless explicitly approved by the owner.
- Do not add product categories or broad unrelated refactors.
- Preserve ProductContract, ProductPlan, requirement manifests, specialist agents, iterative repair, Builder Resource Library, sandbox isolation, adapter maturity, billing, credits, entitlements, deployment, recovery, exports and successful authentication paths.
- Do not create a second AppForge system of record in Supabase where canonical Drizzle/Postgres entities already exist.
- Do not claim legal/compliance certification or production readiness without evidence.
- Customer-facing capability claims, destructive lifecycle actions, migration safety and settlement logic fail closed when evidence is missing or contradictory.
- Run focused tests first, then `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run test:e2e`, and `npm run build` where the environment permits.
- External provider/live-production facts that cannot be proved automatically must remain explicit blockers in `programme-evidence/final-production-completeness.md`.

## Review Focus

- **Cross-tenant account/export/support access:** another authenticated user must receive no data and no existence-leaking detail. Owning tests: Tasks 3 and 7.
- **Retrying destructive lifecycle work:** duplicate account-deletion, settlement, incident or migration events must remain idempotent and never double-delete/double-refund/double-charge. Owning tests: Tasks 3, 6 and 7.
- **Evidence regression:** stale, quarantined, version-mismatched or failed evidence must automatically lower public capability claims. Owning tests: Task 4.
- **Unsafe rollback:** when data state cannot safely roll back, the system must choose an explicit forward-repair path rather than pretend rollback is safe. Owning tests: Task 5.
- **Branch reconciliation:** the three commits added to `main` after PR #194 branched must be retained and their Fly-capacity regression protections must continue to pass. Owning tests: Task 1.

---

### Task 1: Reconcile PR #194 onto current main without losing either side

**Files:**
- Existing candidate branch: `production-completeness-programme`
- Current `main` commits after merge base: `43b68d44...`, `36324c87...`, `27c4c32...`
- Review conflicts in any overlapping files before accepting resolutions.

**Interfaces:**
- Consumes: current `main` and PR #194 head.
- Produces: one reconciled implementation branch containing both production-completeness work and the later Fly-capacity fixes.

- [ ] **Step 1: Create an isolated worktree/branch from current `main` and bring in PR #194.**

Run:
```bash
git fetch origin
git worktree add ../appforge-production-completeness -b production-completeness-reconciled origin/main
cd ../appforge-production-completeness
git merge --no-ff origin/production-completeness-programme
```
Expected: either a clean merge or explicit conflicts; never silently discard either side.

- [ ] **Step 2: Resolve each conflict by preserving current-main capacity-guard fixes and approved lifecycle behavior.**

For every conflicted file, compare `origin/main`, `origin/production-completeness-programme`, and the approved spec before editing. Do not select an entire side wholesale when both contain valid changes.

- [ ] **Step 3: Verify the three post-branch main commits remain represented.**

Run:
```bash
git log --oneline --decorate -20
npm test -- --run src/__tests__/*capacity* 2>/dev/null || true
```
Expected: reconciled history contains the current-main capacity work; any relevant capacity tests that exist pass.

- [ ] **Step 4: Run immediate structural gates.**

Run:
```bash
npm ci
npm run typecheck
```
Expected: PASS. If dependencies cannot be installed in the current environment, record the environment blocker and use CI for the same gate rather than weakening it.

- [ ] **Step 5: Commit only reconciliation changes.**

```bash
git add -A
git commit -m "chore: reconcile production completeness with current main"
```

### Task 2: Baseline candidate-to-spec coverage audit before modifying behavior

**Files:**
- Read: `docs/superpowers/specs/2026-10-16-final-production-completeness-design.md`
- Read: `docs/superpowers/plans/2026-10-16-final-production-completeness.md`
- Read/update: `programme-evidence/final-production-completeness.md`
- Inspect all 49 files changed by PR #194.

**Interfaces:**
- Consumes: reconciled candidate branch.
- Produces: evidence matrix marking each approved requirement `implemented`, `tested`, `externally-blocked`, or `gap`.

- [ ] **Step 1: Build the requirement matrix from the approved design sections 6.1–6.12 plus final audit requirements.**
- [ ] **Step 2: Map every requirement to concrete files/tests; never infer implementation from filenames alone.**
- [ ] **Step 3: Mark any unproven item as a gap or external blocker instead of complete.**
- [ ] **Step 4: Update the evidence document with the reconciled baseline SHA and matrix status.**
- [ ] **Step 5: Commit the audit-only evidence change.**

### Task 3: Account lifecycle, retention and customer export certification

**Files:**
- `src/lib/accountLifecycle.ts`
- `src/lib/dataRetention.ts`
- `src/lib/customerDataExport.ts`
- `src/services/accountLifecycleService.ts`
- `src/services/supabaseAccountAdmin.ts`
- `src/routers/account.ts`
- `src/middleware/accountLifecycleAccess.ts`
- `src/pages/Account.tsx`
- `drizzle/0007_account_lifecycle.sql`
- Tests: `src/lib/__tests__/accountLifecycle.test.ts`, `src/lib/__tests__/dataRetention.test.ts`, `src/lib/__tests__/customerDataExport.test.ts`, `src/__tests__/accountExportRouter.test.ts`, `src/middleware/accountLifecycleAccess.test.ts`

**Interfaces:**
- Consumes: existing auth/session, users/projects/subscriptions/credits/integrations and retention rules.
- Produces: profile/preferences update, verified email change, secure customer export, idempotent safe account deletion and lifecycle access denial during deletion.

- [ ] **Step 1: Add/fix failing tests for cross-tenant export, secret exclusion, duplicate deletion requests, deletion retries, retained financial/security records and session/token revocation.**

Run:
```bash
npx vitest run src/lib/__tests__/accountLifecycle.test.ts src/lib/__tests__/dataRetention.test.ts src/lib/__tests__/customerDataExport.test.ts src/__tests__/accountExportRouter.test.ts src/middleware/accountLifecycleAccess.test.ts
```
Expected before a missing fix: the specific regression test FAILS for the intended reason.

- [ ] **Step 2: Make the smallest implementation change required by each failing test; do not replace auth or billing systems.**
- [ ] **Step 3: Re-run the focused suite until PASS.**
- [ ] **Step 4: Verify existing password/session/auth recovery tests still PASS.**
- [ ] **Step 5: Commit account-lifecycle corrections only.**

### Task 4: Public policy/trust and capability-claim truth certification

**Files:**
- `src/pages/TrustPolicy.tsx`
- `src/App.tsx`
- `src/components/SiteFooter.tsx`
- `src/pages/LandingPage.tsx`
- `src/pages/FeatureDetail.tsx`
- `src/lib/publicCapabilityClaims.ts`
- `src/lib/platformFeatures.ts`
- Tests: `src/lib/__tests__/publicCapabilityClaims.test.ts` plus route/UI tests where needed.

**Interfaces:**
- Consumes: adapter/resource/runtime/platform evidence.
- Produces: stable public policy routes and conservative, evidence-derived customer-facing capability claims.

- [ ] **Step 1: Add/fix tests proving public policy routes are unauthenticated, versioned and contain no unsupported certification claim.**
- [ ] **Step 2: Add/fix tests for missing, stale, quarantined, regressed and exact-version-mismatched capability evidence.**
- [ ] **Step 3: Ensure every factual public capability surface uses `publicCapabilityClaims` or bounded neutral wording; static marketing text cannot upgrade maturity.**
- [ ] **Step 4: Run focused claim/route tests and commit only policy/truth fixes.**

### Task 5: ChangeContract, migration safety, resource upgrades and rollback certification

**Files:**
- `src/lib/changeContract.ts`
- `src/lib/migrationSafety.ts`
- `src/lib/versionRollback.ts`
- `src/routers/projectChat.ts`
- Existing database migration agent/resource library/snapshot-recovery modules touched by the candidate.
- Tests: `src/lib/__tests__/changeContract.test.ts`, `src/lib/__tests__/migrationSafety.test.ts`, `src/lib/__tests__/versionRollback.test.ts`

**Interfaces:**
- Consumes: ProductContract, RequirementManifest, resource versions, adapters, snapshots/artifact integrity and migration primitives.
- Produces: explicit delta contract, compatibility classification, destructive-change gate, pinned resource upgrade plan, safe rollback-or-forward-repair outcome.

- [ ] **Step 1: Add/fix tests for additive change, removed requirement, API breaking change, field rename/removal, enum/relationship/constraint/RLS change, resource version change and unsafe rollback.**
- [ ] **Step 2: Verify original ProductContract remains authoritative and immutable; ChangeContract is only the delta.**
- [ ] **Step 3: Verify destructive database operations require exact recovery evidence and either rollback proof or explicit forward-fix strategy.**
- [ ] **Step 4: Verify a newer Builder Resource version is never silently substituted into an existing known-good product.**
- [ ] **Step 5: Run focused tests and commit only lifecycle-upgrade corrections.**

### Task 6: Failure settlement, support and incident-response certification

**Files:**
- `src/lib/creditSettlement.ts`
- `src/lib/customerOperations.ts`
- `src/lib/incidentResponse.ts`
- `src/services/productionOperationsService.ts`
- `src/routers/operations.ts`
- `src/pages/HelpCenter.tsx`
- `drizzle/0008_production_operations.sql`
- Tests: `src/lib/__tests__/creditSettlement.test.ts`, `src/lib/__tests__/customerOperations.test.ts`, `src/lib/__tests__/incidentResponse.test.ts`, `src/__tests__/production-lifecycle-failure-paths.test.ts`

**Interfaces:**
- Consumes: current credit ledger/reservations, build failure stages, existing compliance/security records, help centre and observability.
- Produces: idempotent settlement decision, customer-safe failure envelope, tenancy-safe support case and shared SEV lifecycle.

- [ ] **Step 1: Add/fix tests for provider outage, AppForge defect, customer invalid credential, timeout/crash, cancellation, validation failure, deployment failure, duplicate event and retry success.**
- [ ] **Step 2: Assert one settlement result per billable operation; duplicate/replayed events cannot double-refund or double-charge.**
- [ ] **Step 3: Add/fix support tests proving cross-tenant denial and separation of internal notes from customer-visible content.**
- [ ] **Step 4: Verify SEV-1..4 classification reuses existing recovery/compliance/observability instead of creating a duplicate incident stack.**
- [ ] **Step 5: Run focused tests and commit only operations corrections.**

### Task 7: Whole customer journey and hostile failure-path regression

**Files:**
- `src/__tests__/customer-flow-contract.e2e.spec.ts`
- `src/__tests__/golden-path.e2e.spec.ts`
- `src/__tests__/production-lifecycle-failure-paths.test.ts`
- Add only narrowly-scoped tests necessary to cover missing approved journeys.

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces: executable proof for the non-owner customer lifecycle from signup through safe exit, plus failure-path guarantees.

- [ ] **Step 1: Run existing customer-flow suites.**

```bash
npm run test:e2e
```
Expected: PASS after reconciliation/fixes.

- [ ] **Step 2: Add/fix coverage for return/resume, session expiry/new device, update existing product, failed build settlement, support escalation, billing cancellation and account export/delete.**
- [ ] **Step 3: Ensure source-inspection tests are not counted as live-provider proof.**
- [ ] **Step 4: Record any real email/OAuth/Stripe/provider/deployment steps requiring external verification as blockers in evidence.**
- [ ] **Step 5: Commit journey-test corrections only.**

### Task 8: Security, privacy, business-rule and regression gates

**Files:**
- Existing security/auth/billing/recovery tests and CI configuration only where a proven gap requires change.
- `programme-evidence/final-production-completeness.md`

**Interfaces:**
- Consumes: complete reconciled candidate.
- Produces: evidence that the programme did not regress auth, tenancy, billing, recovery or deployment foundations.

- [ ] **Step 1: Run focused security and lifecycle tests first.**
- [ ] **Step 2: Run broad local gates.**

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run test:e2e
npm run build
```
Expected: all available gates PASS. Environment-only failures must be separated from product failures with evidence.

- [ ] **Step 3: Verify migrations are ordered, repeat-safe under the repository convention, and compatible with existing schema bootstrapping.**
- [ ] **Step 4: Verify Stripe idempotency/credit rules, auth/session boundaries, project ownership, CSRF/origin protections, secret redaction and recovery invariants remain intact.**
- [ ] **Step 5: Commit only proven regression fixes/evidence updates.**

### Task 9: External dependency verification and final readiness verdict

**Files:**
- Finalize: `programme-evidence/final-production-completeness.md`
- Update: `docs/RECOVERY_INVENTORY.md` only if reconciled facts require it.

**Interfaces:**
- Consumes: all automated evidence and current provider/config facts.
- Produces: final status separated into repository implementation, automated verification, external/manual verification and paying-customer readiness.

- [ ] **Step 1: Verify the external dependency map for Supabase Auth/email, Stripe, GitHub, Fly/deployment, Redis/queues, Sentry/observability and any other actually used service.**
- [ ] **Step 2: Record Supabase leaked-password protection status and any other configuration hardening item truthfully; do not fabricate dashboard changes.**
- [ ] **Step 3: Verify production recovery/backups only from actual workflow/provider evidence.**
- [ ] **Step 4: Freshly ask: what can still stop a non-technical customer from first visit through long-term ownership and safe exit? Fix only in-scope repository gaps; list external blockers exactly.**
- [ ] **Step 5: Update the final verdict with four independent statuses: `repository implementation`, `automated verification`, `external/manual verification`, `paying-customer production readiness`.**
- [ ] **Step 6: Commit final evidence.**

### Task 10: Final PR review and merge gate

**Files:**
- No feature work unless review finds a real in-scope defect.

**Interfaces:**
- Consumes: reconciled branch and final evidence.
- Produces: merge-ready PR or an explicit blocker list.

- [ ] **Step 1: Compare reconciled branch against current `main`; confirm only approved programme + necessary reconciliation changes remain.**
- [ ] **Step 2: Review all changed files for duplicate systems, unintended scope expansion, secrets and unsupported claims.**
- [ ] **Step 3: Push reconciled branch and open/update a draft PR against `main`.**
- [ ] **Step 4: Require GitHub CI/status checks to pass; inspect failing job logs and fix the smallest responsible scope.**
- [ ] **Step 5: Run the `superpowers:verification-before-completion` skill before claiming completion.**
- [ ] **Step 6: Run `superpowers:requesting-code-review`; resolve material findings before merge.**
- [ ] **Step 7: Merge only when the final evidence verdict and checks support it.**

## Self-review results

- **Spec coverage:** Account/data lifecycle, legal/trust, capability truth, ChangeContract, compatibility/migration, resource upgrades/rollback, failure settlement, customer support, incidents, full journeys, security/privacy/business gates, external dependency map and final fresh-gap audit are all assigned to tasks.
- **Step scan:** Every implementation task begins with evidence/tests and constrains changes to the smallest responsible scope; no task authorizes broad refactoring.
- **Type/interface consistency:** Existing candidate module names are used exactly as present in PR #194; no competing second names are introduced.
- **Review Focus:** Each of the five highest-risk failure classes maps to an owning task and explicit regression test requirement.
- **Proportion:** This plan is intentionally narrower than the original 14-task implementation plan because 83 candidate commits already exist; it focuses on reconciliation, gap repair and certification rather than rewriting completed candidate work.

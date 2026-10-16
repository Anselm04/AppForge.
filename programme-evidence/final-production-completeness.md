# Final Production Completeness – Evidence Ledger

- **PR:** #194
- **Branch:** `production-completeness-programme`
- **Baseline SHA:** `d2fae207e103bac5f3bd9692bc6ca5ccafba29fb`
- **Verified implementation head SHA:** `0919124d6bc6ce283c034dfc3174a507493c9364`
- **Historical main ancestry check:** `467090a9268d65499e9733fbbbcdd17d22e721d4` is already an ancestor (GitHub compare: ahead 107, behind 0 at pre-fix head `d8528a7`). Current main was previously integrated by merge `12eb9dc`; no new rebase or conflict resolution was performed or claimed.
- **Evidence commit relationship:** This ledger is committed after the implementation SHA above. Final-head GitHub checks must be evaluated on the resulting branch head; local implementation results are not a substitute for them.
- **Verification date:** 2026-10-17 (Pacific/Auckland); final-head CI remains required.

## A. Repository Verification Checklist

> Fill only from fresh evidence on the final aligned head. Do not inherit stale results from earlier SHAs.

| Check | Command / Source | Result | Notes / Evidence link |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | PASS locally | Exit 0; client and server. Local Node 24.19.0 / npm 11.9.0; CI pins Node 22. |
| Lint | `npm run lint` | PASS locally | Exit 0; changed source formatted with Prettier. |
| Unit + focused tests | `npm test -- --coverage --run` | PASS locally | Exit 0; 267 files, 1,593 tests. Enforced coverage: statements 94.44%, branches 97.82%, functions 88.88%, lines 95.12%. Coverage applies only to the existing configured release-critical subset, not all source. |
| Focused regression files | Six previously failing files | PASS locally | 48 tests including pending/completed account rejection, lifecycle persistence outage and unauthenticated export rejection. |
| Explicit golden path | `npm run test:e2e` | PASS locally | Exit 0; 2 files, 26 tests. Repository harness evidence, not a live production canary. |
| Build | `npm run build` | PASS locally | Exit 0; server compilation, Vite production bundle and sourcemap injection. No deployment claimed. |
| Production dependency audit | `npm audit --omit=dev --audit-level=moderate` | PASS locally | Exit 0; zero production vulnerabilities reported. Does not prove private Dependabot alert state. |
| Recovery governance | `bash scripts/recovery-governance.sh HEAD~1 HEAD` against the local candidate diff | PASS locally | Exit 0; workflow change accompanied by recovery inventory review. Earlier full-PR Security Gate at `d8528a7` also passed. Final-head GitHub gate still required. |
| Fly capacity/runtime safety | `node --test scripts/verify-fly-capacity.test.mjs scripts/verify-production-build-runtime.test.mjs` | PASS locally | Exit 0; 6 tests. |
| Existing-host runtime tests | `node --test scripts/runtime/*.test.mjs` | BLOCKED locally | Unix-socket listener receives EPERM in this environment. No product boundary bypassed; GitHub runner result required. |
| Final GitHub CI | [CI run 38963702689](https://github.com/Anselm04/AppForge./actions/runs/38963702689) on `0919124` | PASS at `348dc0d`; next head pending | GitHub confirms CI Release Gate, Type Check, Lint & Format, Test & Coverage, Production Build, Product Factory Validation and Security Gate pass at `348dc0d`. The workflow-storage correction after that head requires fresh checks. |
| Security workflow | [Prior security run 38933601269](https://github.com/Anselm04/AppForge./actions/runs/38933601269) / [candidate run 38963702586](https://github.com/Anselm04/AppForge./actions/runs/38963702586) | NOT GREEN | At prior head, npm audit, secret scan and immutable-action gate passed, but CodeQL upload failed because code scanning is disabled for this private repository. No paid feature enabled, failure suppressed or security gate weakened. Candidate/final head must independently pass. |
| Native qualification | [Candidate run 38963702817](https://github.com/Anselm04/AppForge./actions/runs/38963702817) | FAILED at `348dc0d`; correction awaiting CI | Prior Linux run exhausted disk allocating the default 7,372.80 MB userdata requirement with 3,140.39 MB free. The 2 GiB setting failed to reduce the image minimum at `348dc0d`; no runtime pass claimed. The correction frees unused Haskell/CodeQL runner toolchains and requires 10 GiB actual free capacity before boot. Fresh Android boot/backend interaction must pass. |
| No open critical Dependabot alerts | GitHub Security / Dependabot | UNVERIFIED | A zero-vulnerability npm audit is not an alert inventory. |

Local results were obtained against the code committed as `0919124d6bc6ce283c034dfc3174a507493c9364`. The checkout was materialized from immutable GitHub blobs and source hashes were checked; it is not evidence of executing a Git rebase. Local runtime restrictions are separated from repository defects. Changes preserve the fail-closed production lifecycle middleware, auth, billing, credits, schema/migrations and deployment/recovery logic.


## B. Programme Phase Status (repository level)

| Phase | Area | Status | Evidence location |
| --- | --- | --- | --- |
| 0 | Current-state audit | COMPLETE | This document – Phase 0 |
| 1 | Account + data lifecycle | IMPLEMENTED – awaiting final CI | `src/lib/accountLifecycle.ts`, `customerDataExport.ts`, `dataRetention.ts`, migrations `0007`/`0008`, related tests |
| 2 | Public legal / trust surfaces | IMPLEMENTED – legal review still required | `/privacy`, `/terms`, `/acceptable-use`, `/refund-policy`, `/security` + footer |
| 3 | Capability-claim truth | IMPLEMENTED | `src/lib/publicCapabilityClaims.ts` + public feature UI |
| 4 | ChangeContract | IMPLEMENTED | `src/lib/changeContract.ts` + persistence |
| 5 | Migration safety | IMPLEMENTED | Migration safety model + tests |
| 6 | Version / rollback lifecycle | IMPLEMENTED | Rollback assessment + tests |
| 7 | Support / failed-build UX | IMPLEMENTED | Support cases + Help Center |
| 8 | Credits / failure settlement | IMPLEMENTED | Settlement rules + existing refund path |
| 9 | Incident response / observability | IMPLEMENTED (repo level) | Incident model + redaction |
| 10 | Full customer journey | HARNESS EXISTS – live run still required | `production-full-customer-journey.yml` |
| 11 | Failure-path testing | IMPLEMENTED – final CI result required | `production-lifecycle-failure-paths.test.ts` + related unit tests |
| 12 | Security / privacy / a11y / performance | AUDITED – live a11y & load evidence still partial | See Phase 12 notes |
| 13 | Final-gap audit | COMPLETE | Listed external/live blockers below |
| 14 | Production-readiness verdict | See below | See section D and Phase 14 |

## C. External / Live Evidence Still Required

These cannot be completed from source alone.

| # | Evidence item | Status | Owner / next action |
| --- | --- | --- | --- |
| 1 | Controlled real email-confirmation inbox proof on final artifact | Pending | |
| 2 | Fresh full ordinary-customer production canary on final artifact | Pending | |
| 3 | Isolated production-database restore/recovery proof after new lifecycle migrations | Pending | |
| 4 | External provider-console truth (OAuth / store / provider approvals) | Pending | |
| 5 | Qualified legal review of public policy text + retention periods | Pending | |
| 6 | Fresh automated accessibility (WCAG/axe) + assistive-technology evidence | Pending | |
| 7 | Fresh production load / performance evidence against agreed targets | Pending | |

## D. Final Verdict

- **Repository-level implementation:** Complete for the approved programme; final repository release verification remains blocked.
- **Production-certified for broad paid access:** No.
- **PR Ready / merge gate:** Not satisfied. Keep Draft until final-head CI, security (including CodeQL), native qualification and recovery-governance checks are green.
- **Residual blockers:** CodeQL repository configuration; pending final-head GitHub verification; all seven live/external/legal evidence items in section C.
- **Verification attribution:** Codex automated repository checks only; no owner, legal or production certification sign-off.
- **Date:** 2026-10-17 (Pacific/Auckland).

---

# AppForge Final Production Completeness Programme Evidence

## Scope lock

This evidence record covers only the approved final production-completeness programme:

A. customer account + data lifecycle
B. AppForge public legal / trust surfaces
C. capability-claim truth system
D. generated-product update / migration / rollback lifecycle
E. customer operations / support / incident handling
F. final repository-wide production-completeness audit

No unrelated product-category expansion, redesign, infrastructure migration, broad refactor or speculative feature work belongs in this programme.

## Baseline

- Repository: `Anselm04/AppForge.`
- Baseline `main` SHA: `d2fae207e103bac5f3bd9692bc6ca5ccafba29fb`
- Baseline meaning: PR #193 Builder Resource Library foundation merged.
- Programme branch: `production-completeness-programme`
- PR: #194
- Deliberate additional infrastructure/service spend: NZ$0.

GitHub proves committed repository state, not an unrelated uncommitted Linux desktop checkout. The baseline SHA above is therefore the immutable programme baseline.

## Phase 0 — current-state audit

**Status: COMPLETE.**

The audit preserved existing working foundations rather than rebuilding them: signup/verification/resend, Supabase social auth discovery, password/session controls, Stripe subscriptions/credits/portal, customer ownership checks, source/GitHub export, ProductContract/ProductPlan, versioned writes/snapshots, recovery checkpoints, migration guidance, adapter/resource maturity evidence, generated-product certification evidence, health/readiness/metrics and redacted logging.

The audit established the programme gaps subsequently addressed below: complete account/data lifecycle, AppForge legal/trust routes, public claim binding, first-class ChangeContract, persistent support/incident operations and final ordinary-customer certification.

## Phase 1 — account and data lifecycle

**Status: IMPLEMENTED; repository verification required before merge.**

Implemented and integrated:

- account lifecycle preferences and deletion state in immutable migration `20261016_008 account_lifecycle`;
- display name, language, communication and accessibility preferences;
- verified identity-provider email-change request rather than direct local email overwrite;
- existing password reset/change and local/other/global session controls retained;
- customer data export covering account, project source, build history, billing summary, credit transactions and connected-account metadata while excluding provider access tokens/secrets;
- authoritative retention registry in `src/lib/dataRetention.ts` covering account, billing, projects/source/artifacts, exported source, logs/security events, support, analytics, backups, temporary build/uploads and auth/OAuth/session material;
- typed irreversible account deletion with recent-session proof;
- deletion sequence stops work, disables entitlements, revokes the Supabase identity, removes customer projects/provider connections/sessions, anonymizes the retained AppForge user row and records a PII-minimized opaque deletion audit reference;
- legally/operationally required billing/audit history is not cascade-deleted with the account;
- protected tRPC procedures now fail closed while deletion state is `pending` or `completed`, even if a previously issued access JWT has not yet expired.

External/legal boundary: exact statutory retention periods and privacy wording require qualified legal review before commercial reliance. Provider-specific identity behavior must be verified against the configured Supabase project.

## Phase 2 — public privacy, terms and trust

**Status: IMPLEMENTED; qualified legal review still required.**

Public routes now exist for:

- `/privacy`
- `/terms`
- `/acceptable-use`
- `/refund-policy`
- `/security`

They are linked from the site footer, describe AppForge rather than a generated-product template, explicitly avoid unproved SOC 2/ISO/GDPR/etc certification claims and state that qualified legal review is required. Help/support remains available independently of sign-in by email.

## Phase 3 — capability-claim truth

**Status: IMPLEMENTED.**

`src/lib/publicCapabilityClaims.ts` defines the ordered maturity model:

`planned -> experimental -> structural -> buildable -> runnable -> deployable -> verified -> production-certified`.

Public truth rules are fail-closed:

- adapter, resource, runtime and platform evidence are combined;
- the least mature required evidence dimension controls the public claim;
- missing evidence becomes `planned` / not available;
- a regression downgrades an existing claim;
- only `production-certified` evidence can produce a production promise;
- public feature cards and feature detail pages show evidence-backed state;
- feature detail pages do not expose a "Try It" path below runnable evidence.

This supplements rather than replaces the existing adapter/resource/runtime certification evidence systems.

## Phase 4 — generated-product update/change contract

**Status: IMPLEMENTED.**

A machine-readable ChangeContract now:

- anchors every built-project change to the original ProductContract hash;
- records additions, changes and removals;
- requires explicit data/API/UI/platform/billing/permissions/security/rollback impact decisions;
- refuses unsupported rollback claims;
- is persisted before the actual Project Chat quick-edit or Senior Dev path executes;
- records project/user ownership and change history.

Persistent storage is registered by immutable migration `20261016_009 production_operations`.

## Phase 5 — database and API migration safety

**Status: IMPLEMENTED; destructive live recovery proof remains a production-certification evidence requirement.**

Migration safety now models add/rename/split fields, enum changes, relationships, removals, constraints, indexes and auth policies. Destructive changes require verified backup evidence. Schema evolution must not be mixed with demo/seed data. A forward-fix plan is mandatory. Breaking API changes require an explicit versioned replacement or compatibility layer.

Existing database-agent migration/recovery safeguards remain authoritative for generated execution.

## Phase 6 — version and rollback lifecycle

**Status: IMPLEMENTED; live full-surface recovery proof remains a production-certification evidence requirement.**

Resource upgrades are explicit candidates, never silent upgrades. A candidate version inherits no production evidence and requires impact analysis, migration assessment, tests, behavioral comparison, deployment evidence and recovery evidence.

Rollback assessment covers code, database state, provider configuration, webhooks, background jobs, feature flags and resource versions. If data cannot safely return to the prior state, AppForge must use forward recovery rather than claim a false rollback.

## Phase 7 — support and failed-build customer experience

**Status: IMPLEMENTED.**

Persistent support cases now carry:

- case/customer/project/build references;
- SEV-1..SEV-4 severity;
- category/status/timestamps;
- customer summary;
- private operational notes/log references;
- billing adjustment;
- resolution/root cause/prevention.

The public Help Center now lets authenticated customers open and track AppForge support cases while preserving direct email support for customers who cannot sign in. Customer-facing failed-build explanations describe the failure class and credit outcome without exposing stack traces, tokens or secrets.

## Phase 8 — credits, refunds and failure settlement

**Status: IMPLEMENTED.**

Deterministic settlement rules cover early failure, provider outage, AppForge internal defect, invalid customer credentials, external rejection, timeout, interruption, duplicate execution and customer cancellation. AppForge/provider failures before useful work do not unfairly consume credits. Adjustment decisions use deterministic idempotency keys.

The existing build worker's real reservation/refund path remains in place because it already applies idempotent refunds for failed/incomplete/duplicate execution; this programme adds explicit settlement classification/customer explanation instead of replacing working billing logic.

## Phase 9 — incident response and observability

**Status: IMPLEMENTED at repository level; live operational exercise remains certification evidence.**

Formal incident severity is SEV-1 through SEV-4. Required lifecycle stages are detection, triage, containment, communication, recovery, evidence capture, root cause, corrective action and regression testing. Persistent incident records are part of immutable migration `20261016_009`.

The observability contract covers application logs, metrics, traces, errors, builds, providers, queue depth/job age, webhooks, billing, authentication and deployments. Sensitive operational context is recursively redacted. Existing readiness/liveness endpoints and Prometheus/redacted logging controls are preserved.

## Phase 10 — full customer journey

**Status: HARNESS EXISTS; FRESH PRODUCTION CERTIFICATION BLOCKED UNTIL A NEW LIVE RUN IS PROVEN.**

The repository already contains a genuine `production-full-customer-journey.yml` canary against deployed AppForge. It dynamically preflights catalog integrations marked `requiredForProduction`, uses real authentication/build/deploy state and drives the generated application in a real browser. It also covers an authenticated edit/redeploy path.

It explicitly does not prove the email-inbox confirmation click because CI has no controlled mailbox integration. A fresh passing run on the final merged artifact plus controlled email-confirmation evidence is required before Phase 14 can say production-certified.

## Phase 11 — failure-path testing

**Status: IMPLEMENTED; final CI result controls merge readiness.**

`src/__tests__/production-lifecycle-failure-paths.test.ts` covers:

- identity-provider outage halting deletion before destructive cleanup;
- destructive database migration without backup evidence;
- unsafe data rollback forcing forward recovery;
- capability regression downgrading public claims;
- duplicate execution releasing reserved credits instead of double charging.

Additional unit coverage exists for account lifecycle, retention, export filtering, public claim truth, ChangeContract, migration safety, version/rollback, support operations, credit settlement, incident response and deletion-state access.

## Phase 12 — security, privacy, accessibility and performance

**Status: AUDITED; security/privacy repository controls strengthened; accessibility/performance live certification remains partial.**

Security/privacy evidence includes:

- authenticated ownership checks and tenant-scoped project operations;
- RLS/security tests already in the repository;
- CSRF protection and authenticated request headers;
- strict CORS/server controls;
- session revocation and deletion-aware protected API gating;
- webhook verification paths;
- sandbox/proxy credential stripping;
- secret-aware customer export;
- recursive log/incident redaction;
- durable Redis-backed rate limiting with fail-closed security-sensitive behavior;
- bounded in-memory rate limiting/cleanup;
- dependency/recovery/security workflows already in CI;
- privacy retention/deletion/export contracts introduced by this programme.

Performance evidence includes request duration/slow-request metrics, aggregate endpoint percentiles, bounded in-memory samples, health/readiness metrics and existing build queue/worker controls. No fresh production load-test result was established by this programme.

Accessibility evidence in the repository includes labelled form controls, keyboard/focus-visible patterns and newly stored reduced-motion/high-contrast customer preferences. This audit did not establish a fresh automated WCAG/axe browser certification or assistive-technology test run. Accessibility must therefore remain `PARTIAL`, not silently declared certified.

## Phase 13 — fresh final-gap audit and dependency map

**Status: COMPLETE as a repository audit.**

### Production-required AppForge dependencies from the authoritative integration catalog

- OpenAI server API configuration;
- Redis;
- PostgreSQL;
- public App ID/configuration;
- JWT secret;
- hCaptcha public/secret configuration;
- Stripe secret/webhook configuration;
- GitHub OAuth/application configuration;
- Fly.io generated-app deployment token/org/region configuration;
- Supabase or OpenID/OAuth identity configuration according to the active `AUTH_PROFILE`.

Sentry is integrated but catalog-optional. Additional generated-product providers (for example Twilio, Resend/SendGrid, Google/Facebook auth, PayPal/Paddle/LemonSqueezy, Mongo/Neon/PlanetScale, Cloudflare/AWS/Azure/Vercel/Netlify, Maps/Mapbox, analytics/support/observability providers and model providers) are contract-selected dependencies, not universal AppForge production prerequisites.

The production customer-journey workflow dynamically checks the catalog's `requiredForProduction` dependencies. Repository presence does not prove external console configuration, provider approval or credentials; those must be verified from live evidence and must never be guessed.

### Final gaps that cannot truthfully be converted into repository-only passes

1. Controlled real email-confirmation inbox proof on the final release artifact.
2. Fresh full ordinary-customer production canary on the final release artifact.
3. Fresh isolated production-database restore/recovery proof after the new lifecycle migrations, including reapplication of deletion state and operational-record invariants.
4. External provider-console truth for OAuth/store/provider approvals that repository code cannot observe.
5. Qualified legal review of public policy text and retention periods.
6. Fresh automated accessibility audit/assistive-technology evidence.
7. Fresh production load/performance evidence against agreed service-level targets.

These are evidence requirements, not permission requests and not reasons to fabricate readiness.

## Phase 14 — production-readiness verdict

**Verdict: IMPLEMENTATION PROGRAMME COMPLETE AT REPOSITORY LEVEL; NOT YET PRODUCTION-CERTIFIED FOR BROAD PAID ACCESS.**

The requested repository systems and governance layers are implemented across account ownership/exit, public trust, capability truth, product evolution, migration/version/recovery safety, customer support, credit settlement and incident response. The remaining items listed in Phase 13 require live/external/legal evidence that cannot be truthfully manufactured from source code.

Broad paid access must remain gated until the live evidence items above pass. Once they do, the same-artifact certification evidence should be recorded without inheriting stale evidence across subsequent code/resource/schema changes.

## Phase evidence ledger

| Phase | Status | Repository evidence |
| --- | --- | --- |
| 0 Current-state audit | COMPLETE | Baseline and preserved/gap findings recorded. |
| 1 Account/data lifecycle | IMPLEMENTED / VERIFYING | `accountLifecycle`, export, retention, profile/delete router/UI, migration `008`, deletion-aware protected procedures. |
| 2 Public legal/trust | IMPLEMENTED / LEGAL REVIEW REQUIRED | Public policy routes and footer trust links. |
| 3 Capability-claim truth | IMPLEMENTED / VERIFYING | Fail-closed maturity/claim model bound to public feature UI. |
| 4 ChangeContract | IMPLEMENTED / VERIFYING | ProductContract-anchored persisted ChangeContract and edit-path integration. |
| 5 DB/API migration safety | IMPLEMENTED / VERIFYING | Backup/destructive/API versioning safety model. |
| 6 Version/rollback lifecycle | IMPLEMENTED / VERIFYING | Explicit upgrade candidates and full rollback-surface assessment. |
| 7 Support/failed-build UX | IMPLEMENTED / VERIFYING | Persistent support cases, Help Center case UX, safe customer failure explanations. |
| 8 Credits/failure settlement | IMPLEMENTED / VERIFYING | Deterministic settlement rules plus existing idempotent build-worker refunds. |
| 9 Incident/observability | IMPLEMENTED / VERIFYING | SEV lifecycle, persistence, observability surfaces/redaction. |
| 10 Customer journey | LIVE EVIDENCE BLOCKED | Real production canary exists; final-artifact run and controlled email confirmation are still required. |
| 11 Failure journey | IMPLEMENTED / VERIFYING | Dedicated lifecycle failure-path tests. |
| 12 Security/privacy/accessibility/performance | AUDITED / PARTIAL LIVE EVIDENCE | Security/privacy controls strengthened; accessibility/load certification remains unproven. |
| 13 Fresh final-gap audit | COMPLETE | Dependency map and seven non-source evidence blockers recorded. |
| 14 Production-readiness verdict | COMPLETE | Repository implementation complete; broad paid-access production certification withheld pending live evidence. |

## GitHub verification follow-up at `348dc0d`

GitHub reports successful CI Release Gate, Production Build, Type Check, Lint & Format, Test & Coverage, Product Factory Validation, Security Gate (including recovery governance), npm audit, secret scanning, workflow supply-chain checks and Deploy Preview. These are actual remote results, not extrapolated local passes.

CodeQL analysis upload still fails because code scanning is not enabled for the private repository. This has not been disabled, waived or called a pass. GitHub documents private CodeQL/code scanning as requiring licensed Code Security; no paid service, public repository conversion or security-policy replacement is authorized by this programme.

Linux native qualification still failed the image minimum-space check. The follow-up removes unused preinstalled toolchains, preserves the default AVD image requirement, captures effective disk/config artifacts and fails closed below 10 GiB available before boot. YAML parsing and all eight workflow shell blocks pass `bash -n` locally. This is configuration verification, not an Android runtime pass. The new head must pass fresh CI before Ready.

The configured primary mailbox account was found already confirmed in Supabase. That existing confirmation is not fresh inbox-click proof for this release. Gmail returned a reauthentication requirement; no fresh email request, inbox receipt or confirmation click is claimed.

## Final reconciliation and public-repository verification

The repository is now verified public by GitHub (`visibility: public`,
`private: false`). The historical private CodeQL upload failure no longer
represents the current blocker: CodeQL Analysis, secret scanning, npm audit
and workflow supply-chain checks all passed on `3b06add`. GitHub also reports
CI Release Gate, typecheck, lint, test/coverage, production build, product-factory
validation, recovery-governance Security Gate and Deploy Preview passed there.

A real local rebase onto `467090a9268d65499e9733fbbbcdd17d22e721d4` was completed.
Two mutually cancelling temporary PR-formatting workflow commits were omitted;
three duplicated Fly-capacity patches were already upstream. The complete
rebased file tree was checked identical to `3b06add` before further edits.
The original full history is retained at
`archive/production-completeness-pre-rebase-3b06add`. The published candidate
consolidates that rebased programme onto current main without losing file content.

The 10 GiB Android preflight correctly stopped the `3b06add` Linux run with
8,640,110,592 bytes free. Unused Linux Swift, Miniconda, Azure CLI and PowerShell
installations are now additionally removed from the disposable runner.
Android/NDK/Java/Node/Flutter and the disk preflight remain intact. YAML parsing
and all workflow shell blocks pass local syntax validation. Fresh native
qualification remains required; no runtime pass is inferred from cleanup.

PR #195's separate specification and reconciliation plan are preserved in
`docs/superpowers/archive/` and superseded as an active checkpoint by this PR.

Final candidate CI must pass before Ready or merge. Repository implementation
is complete for this programme; production certification for broad paid access
remains withheld pending the seven external/live/legal evidence items above.

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

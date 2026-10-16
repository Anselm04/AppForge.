# AppForge Final Production Completeness Programme Design

## Purpose

Complete the remaining production-readiness and lifecycle work around AppForge after the main execution/runtime gaps and Builder Resource Library work, without rebuilding systems that already work.

This programme is limited to the user-approved scope:

A. Customer account + data lifecycle
B. AppForge public legal / trust surfaces
C. Capability-claim truth system
D. Generated product update / migration / rollback lifecycle
E. Customer operations / support / incident handling
F. Final repository-wide production-completeness audit

No unrelated product-category expansion, redesign, infrastructure migration, broad refactor, or speculative feature work is in scope.

## Baseline and change-control boundary

- Repository: `Anselm04/AppForge.`
- Baseline `main` SHA: `d2fae207e103bac5f3bd9692bc6ca5ccafba29fb`
- Baseline meaning: PR #193 Builder Resource Library foundation is merged.
- Programme branch: `production-completeness-programme`
- Deliberate additional spend target: NZ$0

The following existing systems are preserved and extended only where evidence shows a genuine gap:

- ProductContract
- ProductPlan
- requirement manifests
- specialist agents
- iterative repair
- Builder Resource Library
- sandbox isolation
- adapter maturity/evidence
- authentication paths that already pass
- Stripe billing, credits and entitlements
- deployment and recovery
- source export / GitHub export
- project snapshots and versioned writes
- generated-product certification
- existing observability primitives

## Current-state findings that drive this design

The repository already contains working foundations for:

- email/password signup and verification
- verification resend UX and anti-enumeration messaging
- social sign-in through enabled Supabase providers
- password reset/change
- session refresh and device-wide session revocation
- Stripe subscription checkout, credit packs and billing portal
- project ownership checks and source export
- project snapshots, versioned file updates and known-good recovery checkpoints
- migration safety instructions and rollback/forward-repair guidance
- adapter maturity, quarantine, lifecycle and verification evidence
- liveness/readiness, metrics and redacted logging expectations
- customer Help Center and direct support contact

Gaps remain in the complete account/data lifecycle, AppForge's own public legal/trust routes, evidence-driven public claims, machine-readable product change contracts, governed resource upgrades, persistent support cases, formal incident workflows, and a final real-customer production-completeness verdict.

## Programme architecture

The programme uses evidence-led vertical phases. Each phase must:

1. inspect existing implementation first;
2. reuse the authoritative existing system;
3. add the smallest missing runtime/data/UI capability;
4. add focused tests before broad tests;
5. record evidence and unresolved external/manual blockers;
6. never upgrade a maturity/readiness claim without evidence.

No phase may create a parallel auth, billing, maturity, recovery, project-history, or resource-governance system when the existing system can be extended.

---

## Phase 1 — Customer account and data lifecycle

### Account profile and preferences

Extend the current account/settings surface to support only missing lifecycle functions:

- editable display name and profile fields that AppForge actually stores;
- language and communication preferences where backed by real persistence;
- accessibility preferences where AppForge supports them;
- verified email-change flow;
- clear account-security notifications where the existing email provider can deliver them.

Do not invent profile fields without an operational need.

### Email change

Email change must be a security-sensitive state transition:

- require an authenticated session;
- re-authenticate where the auth provider supports it safely;
- request the new email through the existing identity provider;
- require verification of the new address before treating it as canonical;
- keep the old identity usable until provider semantics establish the transition;
- reconcile AppForge's `users.email` only after trusted provider state confirms the new address;
- emit a security/audit event with minimal PII;
- provide explicit failure/recovery messaging.

### Account deletion

Implement a first-class account-deletion workflow rather than deleting the `users` row directly.

Required stages:

1. customer requests deletion;
2. UI states scope and irreversibility clearly;
3. re-authentication or equivalent recent-session assurance is applied where supported;
4. pending customer-owned builds/jobs are stopped or made non-promotable safely;
5. active sessions and tokens are revoked;
6. entitlements are disabled;
7. project/artifact disposition is executed according to the retention registry;
8. OAuth/provider connections are revoked/deleted where possible;
9. personal profile data is deleted or anonymized according to the retention registry;
10. financial/security records are retained only when their retention rule requires it and are detached/anonymized where possible;
11. an audit event records completion without unnecessary PII;
12. no orphaned data remains accessible through normal customer APIs.

A cancellation window is not introduced unless implementation evidence shows an existing intentionally designed soft-delete mechanism worth preserving.

### Authoritative retention registry

Create one machine-readable retention registry that is consumed by documentation/tests and, where practical, deletion/export code.

It must cover:

- account/profile data
- billing/subscription/payment references
- generated projects
- generated source/artifacts
- build/event history
- application logs
- security/audit events
- support cases
- analytics
- backups
- temporary build files
- uploaded assets
- auth/session tokens
- OAuth/provider connections

Each record must define:

- owner/system of record
- storage location
- retention period or event-based retention rule
- deletion behavior
- operational/legal reason
- backup behavior
- anonymization behavior
- customer-export eligibility

The registry must not claim GDPR, CCPA, SOC 2, ISO, HIPAA, or any other compliance status without independent evidence.

### Customer data export

Add a safe customer account export that includes only data AppForge promises the customer can obtain.

At minimum evaluate and include where persisted:

- profile/account metadata
- account preferences
- projects and project metadata
- generated source code
- generated artifacts or export references
- build records/history
- relevant billing/subscription history safe for customer disclosure
- connected-service metadata safe to disclose

The export must exclude:

- AppForge secrets
- provider secrets
- encrypted provider credentials or decryption material
- internal system credentials
- internal-only security evidence that would create a vulnerability
- other customers' information

Project source download and GitHub export remain separate supported workflows; account export can reference or bundle customer-owned project data without weakening project ownership checks.

---

## Phase 2 — AppForge public legal and trust surfaces

Add AppForge's own public, unauthenticated routes where missing:

- `/privacy`
- `/terms`
- `/acceptable-use` when commercially appropriate
- `/refund-policy` when commercially appropriate
- `/security` or equivalent trust summary
- `/help` / contact remains the support route

Requirements:

- content describes actual AppForge behavior rather than generated-app templates;
- documents are versioned in source;
- footer/navigation expose appropriate public links;
- content explicitly states that qualified legal review is required before final commercial reliance;
- no unsupported compliance certification claims;
- cookie/consent UI is added only if actual AppForge tracking behavior and legal review indicate it is required.

### OAuth verification

After stable public Privacy and Terms URLs exist:

- verify repository/runtime redirect URI expectations for Google and GitHub OAuth;
- test failure/revocation/duplicate-account behavior available inside AppForge;
- do not guess provider-console state;
- record exact manual console steps only where external provider ownership requires them.

---

## Phase 3 — Capability-claim truth system

Do not build a second maturity model.

Create one authoritative claim resolver that consumes existing evidence sources:

- adapter maturity/lifecycle state
- Builder Resource Library maturity/evidence
- runtime/build evidence
- platform/native evidence
- generated-product certification evidence
- external prerequisite/provider restrictions

The resolver returns the strongest customer-safe claim AppForge may expose.

Internal states may include:

- planned
- experimental
- structural
- buildable
- runnable
- deployable
- verified
- production-certified

Public wording may simplify those terms, but the public claim must never exceed the internal evidence result.

### Claim governance

Each advertised platform/category/capability must resolve to:

- implementation owner/module
- maturity
- required evidence
- latest verification
- evidence expiry/freshness rule
- known limitations
- external prerequisites
- provider restrictions
- supported stacks/platforms

When evidence regresses, expires or is quarantined, customer-facing claims must fail closed or downgrade automatically.

Static landing/feature copy that implies stronger capability than the resolver allows must be changed to evidence-derived copy or bounded neutral wording.

Tests must prove regression causes claim downgrade rather than stale success.

---

## Phase 4 — Generated-product change contract

Do not treat an update to an existing product as a new first-build prompt.

Add a machine-readable `ChangeContract` linked to the existing project history and original ProductContract.

It records:

- original ProductContract identity/version
- requested change
- requirements added
- requirements changed
- requirements removed
- compatibility risks
- data migration requirements
- API contract changes
- UI changes
- platform changes
- billing changes
- permission changes
- security implications
- resource-version implications
- rollback/forward-recovery requirements

The change contract becomes an input to planning, specialist-agent work allocation, migration analysis, regression testing and certification for update builds.

Historical ProductContracts must remain immutable evidence; a change produces a new evolution record rather than rewriting history.

---

## Phase 5 — Database and API migration safety

### Database change analysis

Every generated schema change must be classified before execution:

- additive/non-destructive
- potentially breaking
- destructive
- authorization-policy change
- performance/index-only

Destructive or potentially destructive changes require:

- explicit migration plan
- pre-change backup/recovery evidence where applicable
- versioned migration
- data-preservation validation
- rollback strategy if safe, otherwise explicit forward-fix strategy
- seed-data changes separated from customer data

Test representative cases:

- add field
- rename field
- split table
- enum change
- new relationship
- legacy-field removal
- unique constraint
- index addition
- authorization/RLS policy change

### API compatibility

Generated APIs must be compared against the prior contract.

Breaking changes must select an explicit strategy:

- backward-compatible extension
- versioned endpoint
- coordinated frontend/backend deployment
- explicit breaking upgrade when unavoidable

No breaking API change may be silently shipped as if backward compatible.

---

## Phase 6 — Resource-version and rollback lifecycle

Generated projects must record the exact reusable resource versions they consumed.

A newer internal resource version must never silently replace an existing customer's version.

Upgrade flow:

current resource version
→ candidate version
→ impact analysis
→ required migration/adaptation
→ regression tests
→ behavioral comparison
→ deployment/certification
→ rollback or forward-recovery plan

Significant updates must define recovery across:

- source/code
- database state
- migrations
- provider configuration
- webhooks
- background jobs
- feature flags
- resource versions

If a data migration makes rollback unsafe or impossible, AppForge must state that and use a forward-recovery strategy instead of claiming rollback support.

---

## Phase 7 — Customer support and failed-build experience

### Customer build failure model

Map internal build/recovery states to safe customer-visible statuses.

Customers should see:

- failed stage
- retry state
- whether customer action is required
- whether credits were reserved/consumed/restored
- whether project state remains safe
- next action

Internal stack traces/provider payloads stay internal and redacted.

### Support-case model

Add a persistent internal support-case model only if one does not already exist at implementation time.

Fields:

- case ID
- customer ID
- project ID where applicable
- build ID where applicable
- severity
- category
- timestamps
- status
- customer-visible summary
- internal technical notes
- linked logs/evidence references
- billing adjustment
- resolution
- root cause
- prevention/corrective action

Authorization must prevent cross-tenant case access.

---

## Phase 8 — Credits and failure settlement

Create one authoritative classification for build settlement using existing credit ledger/idempotency mechanisms.

Evaluate at least:

- failure before useful work
- AppForge internal defect
- provider outage
- invalid customer credential
- external API rejection
- timeout
- worker interruption
- duplicate request/event
- retry success
- customer cancellation

Rules must distinguish AppForge-caused failure from customer/provider-caused outcomes and avoid unfair consumption.

Every adjustment must be idempotent and auditable.

---

## Phase 9 — Incident response and observability

Reuse existing logging, metrics, health/readiness, Sentry and recovery systems.

Define operational severity using existing repository convention if present; otherwise:

- SEV-1: broad outage, data-loss risk or security incident
- SEV-2: major customer workflow broken
- SEV-3: degraded/non-critical function
- SEV-4: minor defect

Create/strengthen operational workflow for:

- detection
- triage
- containment
- rollback/forward recovery
- customer communication
- provider escalation
- evidence capture
- root-cause analysis
- corrective action
- regression-test creation

Audit telemetry for:

- application errors
- build status/failure rates
- provider health
- queue depth/job age
- webhook failures
- billing failures
- auth failures
- deployment failures

No PII, prompts, access tokens, secrets or customer source may be added to aggregate metrics/logs unintentionally.

Rate-limit/abuse validation covers signup, login, reset, builds, APIs, provider-cost abuse, uploads, prompts and webhooks without unnecessarily blocking legitimate use.

---

## Phases 10–12 — End-to-end verification

### Customer journey

Trace the real flow:

DISCOVER
→ PRICING
→ SIGNUP
→ VERIFY
→ LOGIN
→ BUY / RECEIVE ENTITLEMENT
→ CREATE PROJECT
→ CLARIFY REQUEST
→ BUILD
→ VIEW PROGRESS
→ PREVIEW
→ REQUEST CHANGE
→ RESUME LATER
→ EXPORT SOURCE
→ DEPLOY
→ MANAGE PRODUCT
→ UPDATE PRODUCT
→ ROLLBACK / FORWARD RECOVERY
→ MANAGE ACCOUNT
→ SUPPORT
→ CANCEL SUBSCRIPTION
→ EXPORT DATA
→ DELETE ACCOUNT

Owner/unlimited accounts must not be used as proof of ordinary customer behavior.

### Failure journey

Exercise applicable failures at each boundary:

- invalid input
- timeout
- provider outage
- lost connection
- duplicate request
- worker interruption
- session expiry
- authorization failure
- stale UI
- insufficient credits
- payment failure
- delayed webhook
- deployment failure
- rollback/forward recovery
- retry
- browser refresh
- new-device login

### Data-loss scenarios

Explicitly validate:

- worker crash
- database outage
- queue retry
- duplicate job
- partial write
- interrupted deployment
- failed migration
- restore from backup where environment permits
- browser close
- logout during build
- session expiry during build

Known-good project state must remain consistent.

### Security/privacy/accessibility/performance

Re-run evidence-backed validation for the requested areas only:

Security:
- auth/authorization
- tenancy/IDOR
- RLS where applicable
- sessions/CSRF/XSS/injection/SSRF
- uploads
- secret leakage
- webhooks/OAuth
- dependency risk
- build isolation/container assumptions
- logs/admin/backup credentials

Privacy:
- minimal PII
- consent where applicable
- analytics/log behavior
- deletion/export/retention/backups
- third-party sharing
- OAuth/support access

Accessibility:
- keyboard/focus
- labels/errors
- contrast
- screen-reader semantics
- responsive behavior
- reduced motion where applicable

Performance:
- landing
- login
- dashboard
- project open
- build-event streaming
- large logs/projects
- source export
- resource queries

No formal WCAG or compliance certification is claimed merely from these audits.

---

## Phase 13 — Fresh final-gap investigation

After implementation and broad tests, perform a fresh repository-wide investigation rather than checking off this specification mechanically.

Primary question:

> What could still stop a real non-technical customer from successfully using AppForge from first visit to long-term product ownership?

Investigate actual runtime transitions, data persistence, permissions, provider boundaries and recovery behavior.

Create a definitive external-dependency map covering actual dependencies such as Stripe, database/Supabase/Postgres, email/SMS, GitHub, Apple/Google, push, analytics, deployment and category-specific providers used by verified flows.

For each record:

- purpose
- required/optional
- authentication type
- required secrets
- test/sandbox availability
- customer/manual action
- failure behavior
- fallback
- cost implications
- licensing/policy restrictions

Only actual dependencies belong in the map.

---

## Phase 14 — Evidence and production-readiness verdict

Maintain:

`programme-evidence/final-production-completeness.md`

The evidence document must include:

- baseline SHA
- systems audited
- existing functionality preserved
- genuine gaps found
- changes made
- focused tests
- integration tests
- end-to-end tests
- security results
- privacy/accessibility/performance results
- operational results
- remaining manual actions
- external blockers
- exact readiness verdict

The verdict must distinguish:

- repository implementation complete
- automated verification complete
- externally/manual verified
- paying-customer production-ready

Tests alone do not authorize a production-ready claim.

## Cost and external-action rule

Use existing environment, GitHub, CI and existing/free-tier infrastructure.

Do not buy subscriptions, upgrade plans or provision paid services.

If production proof requires external provider ownership, identity verification, developer agreements, app-store actions, protected credentials or paid infrastructure, record the exact blocker/manual action instead of fabricating evidence.

## Test strategy

For every phase:

1. add or identify a failing focused regression proving the gap;
2. implement the smallest responsible change;
3. run focused tests;
4. run directly affected integration tests;
5. run broader suite/typecheck/lint/build/security gates after the phase is coherent;
6. do not weaken security or success criteria to turn red checks green;
7. record evidence against the immutable branch SHA used for that verification.

## Completion standard

This programme is complete only when the evidence supports the full user-approved success path:

account creation
→ verification
→ payment/entitlement
→ product generation
→ working product ownership
→ later modification
→ safe migration/upgrade
→ deployment
→ recovery
→ understandable support
→ billing management/cancellation
→ data/source export
→ account deletion

The customer must not be required to become the developer to repair AppForge-generated or AppForge-operated failures.

AppForge must also truthfully limit public claims to evidence, protect customer data, preserve product history, handle failures fairly, and keep external/manual ownership steps explicit and minimal.

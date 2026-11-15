# AppForge production engineering repair register
**Updated:** 2026-11-15 (NZT)  
**Authority:** `docs/SOURCE_OF_TRUTH.md` and current `main` source; this register is not a replacement for runtime implementation.  
**Constraints:** no Fly.io access or deployment, no customer testing, no live payments, no unapproved paid infrastructure or provider requests. Existing security, customer-data ownership, and cost guards must remain effective. Continue source-level repairs regardless of release-test availability.

Status vocabulary: **implemented** = code exists; **repair** = identified mismatch/unfinished code; **verify** = code exists but exact revision evidence or full workflow proof missing; **complete** = corrected code and required offline checks pass on the same revision. Never equate reference-source adoption or a unit assertion with production certification.

| Order | Area | Current source evidence / issue | Existing GitHub reference code | Engineering closure |
| --- | --- | --- | --- | --- |
| P0-01 | Customer signup, email verification, login and recovery | `src/lib/auth.ts`, `src/lib/supabase-client.ts`, `src/services/authEmailDelivery.ts`, `src/pages/Login.tsx`. PRs 365-375 repaired defects; callback and account-recovery checks must remain consistent. | Appwrite, Keycloak, OpenID Client | Account flows preserve a single Supabase identity, require verified email, work without customer SMS, reject spoofed callback tokens; formatting, typecheck and offline account tests pass. |
| P0-02 | Owner God Code/admin MFA | `src/routers/admin.ts` currently calls Twilio Verify; `src/lib/adminMfa.ts` validates privileged session cookies. Separate the owner factor from normal customers and implement owner-controlled Supabase TOTP with recovery. | Keycloak, Appwrite, OpenID Client | Owner-only backend authorization enforced, Supabase TOTP enrolled/verified, recovery safe, no mandatory Twilio dependency; negative and positive offline tests pass. |
| P0-03 | Generate actual runnable customer products | `src/agents/.pipeline_parts/part0.txt`- `part4.txt`, `src/lib/stackAdapters.ts`, `src/lib/incompleteProduct.ts`, `src/lib/factoryExecutionGate.ts`. Generated source must pass executable capability contracts, not merely structural checks. | OpenHands, Bolt.diy, Dyad | Selected supported stacks produce installable, runnable source with functional API, persistence and applicable app assets; full offline factory tests pass. |
| P0-04 | Build jobs, retries, editing and resume | `src/services/build-worker.ts`, `src/lib/neverGiveUp.ts`, `src/routers/projectChat.ts`, `src/routers/versionedWrites.ts`. Trace queue leases, stale writes and interrupted jobs. | LangGraph, Temporal, Trigger.dev | Every task has durable status, bounded retries, no duplicate spend, resumable saved working revision and deterministic failure settlement. |
| P0-05 | Provider cost accounting | `src/services/providerSpendLedger.ts`, `src/lib/providerCostEnvelope.ts`, `src/services/customerComputeLaunchGate.ts`. Verify every billable transport path reserves and reconciles a bounded amount. | Medusa commerce patterns; OpenTelemetry telemetry patterns | All paid requests have validated provider rate, durable atomic reservation, idempotent settlement and correct top-up/credit handling. |
| P0-06 | Stripe, subscriptions and entitlements | `src/services/stripeCheckout.ts`, `src/webhooks/stripe.ts`, `src/services/appForgeCommercialCheckoutGate.ts`, `src/pages/Pricing.tsx`. Ensure approved USD pricing and full event lifecycle parity. | Medusa | Offline Stripe fixture lifecycle exercises checkout, signatures, replays, refunds, renewals, plan changes and credit delivery; paid/live confirmation is separately recorded, never invented. |
| P0-07 | Secure full-stack build runtime | `src/services/buildExecutionReadiness.ts`, `src/services/existingHostBuildRunner.ts`, Docker adapters. Vercel's static UI build alone is not an AppForge builder host. | Coolify, OpenHands | A persistent Node.js runtime, durable database/queue and isolated build worker operate on an owner-approved non-Fly runtime; local qualification before any external deployment. |
| P0-08 | Customer preview, export, deployment | `src/services/productionAutoDeploy.ts` still assumes Fly, whereas `src/services/deployer.ts` supports customer-owned Vercel. Trace usages, remove Fly assumption from authoritative generic path, preserve per-customer hosting credentials and artifact integrity. | Coolify, Playwright | Saved artifact can preview, export and deploy to an explicitly supported customer-owned destination without Fly; verify real deployed source only with owner-authorized environment. |
| P1-09 | Flutter frontend + Node.js generated apps | `src/services/flutterNodeScaffold.ts`, `src/services/flutterNativeCapabilitySupport.ts`. Distinguish scaffold evidence from actual Android/iOS runtime support. | OpenHands, Bolt.diy; existing AppForge templates | Flutter analyze, native build qualification and Node.js API integration checks on supported targets; no false store-release claims. |
| P1-10 | Plugins, OAuth and integration library | `src/integrations/catalog.ts`, `src/integrations/runtime.ts`, `src/integrations/health.ts`, `src/routes/mcp.ts`. | Activepieces, Node-RED, MCP TypeScript SDK | Capability declarations match tested, tenant-isolated, secret-safe runtime adapters; unsupported connectors report explicit errors. |
| P1-11 | Security, privacy, recovery and policies | `src/lib/adminMfa.ts`, `src/middleware/supabaseAuth.ts`, `scripts/recovery-governance.sh`, `docs/RECOVERY_INVENTORY.md`. | Semgrep, Trivy, OSV-Scanner, OPA, Cosign | No privilege bypass; repeatable source/security scan; documented and executable offline recovery checks; public policy wording legally reviewed separately. |
| P1-12 | Diagnostics, support, operational evidence | `src/lib/operationsObservability.ts`, `src/routers/aftercare.ts`, support/incident paths. | OpenTelemetry, PostHog, Chatwoot | Customer-safe failure traces, actionable support tickets, build/job cost visibility, notification delivery and incident response regression checks. |
| P0-13 | Exact-SHA offline release CI | `.github/workflows/ci.yml`, `scripts/audit-launch-blockers.mjs`, release governance workflows. Prior PR #375: Type Check, Test & Coverage, Security Gate, Product Factory Validation succeeded; Lint & Format failed for an auth test. | Playwright, Semgrep, Trivy | CI lint/format, typecheck, unit/integration tests, secure build validation, recovery governance, production compile and artifact verification all pass on an exact common SHA. |
| P0-14 | Production activation evidence | `docs/FLY_INDEPENDENT_RUNTIME.md` and current runtime/deployment contracts. | Coolify | At an explicitly authorized future host: runtime readiness, actual app-generation/execution, auth email, payment in sanctioned mode, backups and webhooks verified. Until then, report code-ready vs deployed separately; do not claim live production is working. |

## Repair order and implementation rules

1. Fix a reproducible code defect in its authoritative source, not a generated mirror or stale documentation.
2. Read the relevant reference repository's implementation and applicable license; adapt only compatible source or patterns without replacing a working independent service.
3. Commit regression coverage and recovery-impact documentation in the same change where required.
4. Use only free/offline repository checks and existing authorized GitHub CI; do not invoke Fly.io or any paid integration.
5. Merge completed changes; record exact commit SHA and whether all CI jobs succeeded.
6. Continue with the next row, keeping unresolved environment-dependent evidence explicitly separate from source engineering.

## Current activity

- Customer signup and auth PRs #365-#375 merged on `main`; their CI history includes both passing checks and formatting/recovery-governance failures on individual heads.
- This register accompanies a formatting correction to `src/lib/__tests__/authEmailRedirect.test.ts` based on the PR #375 lint log.
- Previously documented November 8 blanket checkout/compute environment restrictions were replaced in current source by capability/cost readiness checks; do not reintroduce unconditional production denials or bypass safety requirements.
- Fly-specific legacy deployment files may remain as historical implementation, but they are **not** an authorized runtime or test target.


## Source-diff audit — 2026-11-15 (main @ `1bd52d0804b4767e85141c97a27b8fdcc08df29f`)

This is **source presence inspection only**, not runtime verification. The independent container cannot resolve github.com to clone or install the repository; the GitHub connector can fetch tracked files and commits but no complete local environment was available to execute the full test suite. **None** of the rows below qualifies as "verified complete". "Partial" means relevant existing source is in main but acceptance criteria have not all been demonstrated. "Broken" means a specifically identified mismatch is still in main. "Missing" means the required implementation is absent, not merely that proof is missing.

| Item | Diff status versus main | Verified source evidence and remaining gate |
| --- | --- | --- |
| P0-01 Authentication | Partial | `src/lib/auth.ts` present; exact customer registration/verification/reset integration journey unverified. |
| P0-02 Owner MFA | Broken | `src/routers/admin.ts` present; register identifies mandatory Twilio Verify still used, rather than owner Supabase TOTP. |
| P0-03 Working generation | Broken | `src/lib/incompleteProduct.ts` and `src/services/multiFileCoder.ts` present; generator parser repairs #394–#401 are in main, but stack-dependent essential manifest mismatch remains (PR #402). No runnable exported-product test. |
| P0-04 Durable jobs/edit/resume | Partial | `src/services/build-worker.ts` and `src/routers/projectChat.ts` present; retry/lease/idempotent settlement tests not executed on current main. |
| P0-05 Provider spending | Partial | `src/services/providerSpendLedger.ts` present; all billable transport paths and atomic ledger behavior unverified. |
| P0-06 Stripe lifecycle | Partial | `src/services/stripeCheckout.ts` and `src/services/appForgeCommercialCheckoutGate.ts` present; full signed-event fixture and customer journey unverified. |
| P0-07 Isolated runtime | Partial | `src/services/existingHostBuildRunner.ts` present; no complete offline isolated runtime qualification or approved host. |
| P0-08 Preview/export/deploy | Broken | `src/services/productionAutoDeploy.ts` and `src/services/deployer.ts` present; register identifies Fly assumption in generic path. |
| P1-09 Flutter + Node | Partial | `src/services/flutterNodeScaffold.ts` present and BullMQ repair #401 in main; Flutter analyze/native build of generated export unverified. |
| P1-10 Plugins/integrations | Partial | `src/integrations/runtime.ts` present; tenant isolation and real adapter qualification unverified. |
| P1-11 Security/recovery | Partial | `src/routers/admin.ts` and auth source present; owner MFA issue remains and complete security/recovery scans unverified. |
| P1-12 Operational evidence | Partial | `src/lib/operationsObservability.ts` present; delivery and incident-regression tests unverified. |
| P0-13 Exact-SHA CI | Broken | `.github/workflows/ci.yml` in main explicitly set `APPFORGE_LIVE_RESEARCH_TESTS=1`; remediation committed in PR #403, pending CI and merge. Workflow-run lookup for exact PR head returned no runs during audit. |
| P0-14 Production activation | Partial | `docs/FLY_INDEPENDENT_RUNTIME.md` present; deployment and live infrastructure deliberately not exercised. |

**Branch repairs:** `repair/offline-ci-provider-isolation-20261115`, PR #403; switches research verification to offline fixtures while preserving CI coverage. PR #402 addresses the stack-specific essential-files defect and must be verified/merged separately. No live charge, Fly activation, or production deployment is authorized by either change.

**Evidence limitation:** A file existing does not establish correctness. No specific main CI check set can be marked green based on the combined-status endpoint alone (latest main SHA reported a pending Vercel status, and the PR-triggered workflow-run lookup returned no runs). Do not merge PR #403 until exact-head required checks are green.

## Follow-up repair on PR #403

- **P0-08 / deployment SSRF hardening (source change, not yet complete):** `src/services/productionAutoDeploy.ts` now rejects credential-bearing URLs, IP-literal targets and local/internal hostnames before its post-deployment HTTP verification probe. `src/__tests__/productionAutoDeploy.test.ts` includes regression cases. This does **not** remove the historical Fly-specific automatic deployment dependency; the row remains **Broken**.
- **Verification gate:** Changes are committed to the PR branch. The GitHub workflow-run lookup and combined status endpoint returned no CI checks for exact head `2974599b3c056a46049523f66d42040b04c0ba06`. No local repository clone was possible because the runner could not resolve github.com. Tests are **unverified**; do not merge yet.

## Continuation evidence — 2026-11-15, offline scan and commercial regression branch

**PR #414:** `1ede9086aab229a75e52e677500c8b9f2bbad519` has CI Pipeline, Security Scanning, Source Launch Inventory, Deploy Preview and the latest PR Checklist run successful. The separate Vercel commit status was **pending**, so the user-imposed all-green rule prevents merge. Earlier PR Checklist attempt failed before a successful rerun. Deploy Preview was not modified.

**Offline OSV gate — Unverified (not zero vulnerabilities):** The current execution environment has not demonstrated an installed offline OSV advisory snapshot, scanner binary/version, matching package-lock hash, or actual scan report. `scripts/verify-offline-osv-report.mjs` now rejects missing evidence, missing report results, and every reported vulnerability pending explicit triage. This evidence checker is **not** itself a scanner and must not be described as a completed dependency assessment. No packages were changed without advisory-backed findings. Full required command, once offline scanner/cache and lockfile are available: run the actual OSV-Scanner in offline mode against `package-lock.json`, capture its native JSON plus snapshot metadata, run the verifier against the evidence, triage and fix high/critical first, regenerate lockfile, and rerun the complete offline qualification. A GitHub `npm audit` success is not equivalent to an offline OSV scan.

**Commercial fixture coverage — Simulated / CI unverified:** Added `src/__tests__/stripeEventLedgerOffline.test.ts` covering event replay, handler failure/retry and distinct successful invoice IDs through the real `processStripeEventOnce` API with mocked postgres transactions, then included it in `scripts/check-offline-commercial-readiness.mjs`. This is *transaction-interface* simulation, not real Postgres isolation or Stripe signature verification. Checkout, actual credit balances, invoice-level idempotency, failed-payment access changes, cancellation and credit exhaustion already have related source/tests but **do not** qualify as newly passed integration tests in this branch. They remain Unverified until the full suite runs on its exact head. No Stripe key, HTTP request, billing alteration or paid infrastructure used.

### Source comparison ledger (reference material; no copying)

| Reference | Inspected evidence | AppForge counterpart / conclusion | Status |
| --- | --- | --- | --- |
| `Anselm04/Medusa-Source-Code-Reference` | README identifies payment, pricing, workflow, locking and integration test modules; license identifies separate non-MIT enterprise portions | `stripeCheckout.ts`, `stripeEventLedger.ts`, `stripePlanCredits.ts`: original code, event deduplication and transactional credit boundaries should be qualified against actual Postgres | Compared conceptually; real database verification missing |
| `Anselm04/CalCom-Source-Code-Reference` | Root LICENSE states MIT; billing implementation not inspected in this pass | Compare subscription lifecycle/renewal and cancellation once correct billing module locations are inspected | Not yet code-verified |
| `Anselm04/Bolt-DIY-Source-Code-Reference` | README describes browser-based multi-provider full-stack generation; root LICENSE MIT | AppForge generator parsing and export/source contracts remain simulated | Compared architecture; functional parity unverified |
| `Anselm04/Dyad-Source-Code-Reference` | Root LICENSE permits Apache-2.0 outside restricted `src/pro/` | AppForge saved working revision and edit/replay workflow need real artifact acceptance tests; never copy restricted source | Compared licensing boundary; code parity unverified |
| `Anselm04/OpenHands-Source-Code-Reference` | README describes local/remote isolated agent backends; root LICENSE MIT | AppForge build worker isolation and execution feedback need real local runner qualification | Compared architecture; runner parity unverified |

**Important implementation risk for follow-up:** `processStripeEventOnce` holds a postgres transaction for the event receipt, but the supplied handler can call separate Drizzle transactions. Event-receipt rollback may not roll back those side effects. Durable credit-delivery idempotency must therefore be enforced at each *business object* (invoice/payment intent/session) within the same transaction as the credit balance change. Do not treat event-ID dedupe alone as proof that replay can never double-credit.

**Boundary:** No Fly reconnection, deployment, live checkout, API keys, new charges, or billing-plan changes. Existing Deploy Preview left untouched.

### Additional checkout fixture coverage

- `src/__tests__/stripeCheckoutHermetic.test.ts` invokes the existing checkout service with a mocked Stripe transport and no credentials. Assertions cover plan-session request metadata and automatic tax, rejected mismatched price, rejection of a duplicate subscription, and rejection of top-ups after cancellation.
- Checkout fixtures do not process actual signed Stripe webhooks or prove that invoice settlement changes persisted credit balances. Failed-payment entitlement transitions, exhausted-credit behavior, invoices, refund/cancellation races, and real Postgres uniqueness remain **Unverified** until corresponding integrated offline tests pass.
- CI initially reported `Lint & Format` failure for the webhook ledger fixture. A subsequent formatting-only commit corrected the file; successful requalification must be read on its new exact SHA rather than inferred from earlier runs.

## Continuation — OSV Action and merge gates (2026-11-15)

- **PR #414:** exact-head GitHub Actions all successful on their latest runs; external Vercel commit status remains pending. No repository rulesets were returned by the accessible read endpoint, but the legacy `main` branch-protection endpoint returns HTTP 403 (integration lacks administration scope). Required-check membership is therefore **Unverified**; no merge attempted.
- **PR #415:** `Test & Coverage` completed successful on head `9dd065cb41dcc96117aee12b4b0e89e8a31c82ff`, while `Production Build` was still in progress at last inspection. Subsequent commits require fresh exact-head CI.
- **New actual vulnerability scan:** `.github/workflows/osv-dependency-scan.yml` calls Google's official full scan reusable workflow, pinned to `87a33814e525266e92b7ecaa23a9743ee5a702b8`, scanning `package-lock.json` on every PR and failing on findings. This uses GitHub-hosted scanning and the public OSV advisory service, **not** an offline advisory cache; it is not a paid provider or deployment. OSV severity and CVE results must be gathered from workflow evidence, not inferred. The pre-existing `scripts/verify-offline-osv-report.mjs` remains an optional separate evidence-shape check.
- **Source policy:** No changes to Deploy Preview. No Fly service, real Stripe payment, new API key, or billing/deployment activation.

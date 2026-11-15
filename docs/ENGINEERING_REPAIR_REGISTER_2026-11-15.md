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


## Evidence-controlled status update — 2026-11-15

**Status meanings:** Verified = exact source revision passes the relevant *actual* check; Simulated = tests/fixtures passed but live dependency or real AI behavior was mocked; Unverified = implementation exists or is reported, but required exact-revision or integration evidence is not established; Missing = required capability or evidence artifact is absent; Broken = observed defect unresolved. A status applies to the acceptance criterion, not merely file existence.

**Repository access correction:** Actual repository identifier is `Anselm04/AppForge.` (trailing period). This avoids silently inspecting another repository. Baseline inspected: `main` @ `3f637a31c23bef8c3f850cad6ed97573c9204863`.

| Item | Status | Reference repository / benchmark | Evidence boundary / next action |
| --- | --- | --- | --- |
| P0-01 Customer signup/login/recovery | Unverified | Appwrite; Keycloak; OpenID Client | Auth source exists; actual full account creation, verification, reset and customer browser path not proven at this exact revision. |
| P0-02 Owner-only TOTP MFA | Simulated | Keycloak OTP; Appwrite | PR #411 merged; local GoTrue AAL2 and browser step-up reported passed; no real owner-provider production enrollment claimed. |
| P0-03 Generated working products | Simulated | Bolt-DIY; Dyad; OpenHands | Six deterministic source fixtures reported passed build/browser/export checks. Real AI-provider generation has **not** been tested. Mock outputs must remain conspicuously labelled. |
| P0-04 Durable jobs, retry/edit/resume | Unverified | LangGraph; Temporal; Trigger.dev | Targeted fixture and recovery paths exist; whole lifecycle on same main SHA not yet proven. |
| P0-05 Provider spend ledger/credits | Simulated | Medusa; OpenTelemetry | Eight local Postgres concurrency/settlement checks reported passed; full transport-path coverage and real account-credit integration unverified. |
| P0-06 Stripe checkout/webhooks/entitlements | Unverified | Medusa | Require entirely offline signed Stripe fixtures for checkout, duplicate/out-of-order event IDs, declined/failed payment, renewal, refund and credit issuance; no live Stripe requests. |
| P0-07 Isolated generation/build runtime | Unverified | OpenHands; Coolify | Need runnable isolated worker integration and clean artifact build; no Fly or paid host. |
| P0-08 Preview/export/customer-owned deployment | Simulated | Coolify; Playwright | Local exports and browser verification reported passed. Live/customer-owned deployment intentionally not attempted; historical Fly path remains separate. |
| P1-09 Flutter + Node generated apps | Unverified | OpenHands; Bolt-DIY | Scaffold alone insufficient; generated Flutter analyze, target-native build and Node API runtime not evidenced. |
| P1-10 Plugins/OAuth | Unverified | Activepieces; Node-RED; MCP TypeScript SDK | Integration source exists, but real adapter, tenant separation and permissions need test evidence. |
| P1-11 Security/privacy/recovery | Unverified | OSV-Scanner; Semgrep; Trivy; OPA; Cosign | OSV lockfile read **is not a vulnerability scan**. Local offline advisory database was not demonstrated present; no justified zero-vulnerability claim. Run advisory-backed scan and resolve confirmed high/critical vulnerabilities. |
| P1-12 Observability/support | Unverified | OpenTelemetry; PostHog; Chatwoot | Customer-safe traces, delivery and incident recovery require integration evidence. |
| P0-13 Exact-head CI/quality gates | Unverified | Playwright; Semgrep; Trivy | Previous screenshot reports 2,118 local tests plus lint/typecheck/build passed, two live-network tests skipped. GitHub Actions on this commit/PR must be read independently; local results do not substitute for CI. |
| P0-14 Production activation | Unverified | Coolify | Intentionally not exercised. No Fly.io reconnection, paid provider, API key, live checkout, billing change or external deployment authorized. |

### Current OSV scan acceptance gate

1. Use OSV-Scanner's free advisory data, with database content/refresh timestamp recorded and scan run **offline** against the exact lockfiles at the candidate commit. A missing cache must cause **unverified**, not `0 findings`.
2. Record package, resolved version, ecosystem, advisory ID, CVSS/severity if available, fix version, and whether dependency is direct/transitive for all high/critical findings.
3. Apply minimal compatible package updates with a regenerated lockfile, run the whole offline security/test suite, then rescan against the same advisory snapshot. Do not fabricate findings from a database that was not loaded.
4. Store scan command, tool version, advisory snapshot, candidate SHA and sanitized scan report in the PR evidence. Only mark this gate Verified when both scan and regression evidence exist.

### Next mocked commercial and factory test gates

- **Stripe test-mode logic without keys:** use signed event fixture, inject clock and replayable in-memory/local Postgres transport; verify checkout session state transition, fulfilled-only-once credits, invoice payment failure, recovery, refunds and webhook-idempotency constraints. No hosted Stripe calls.
- **Generation:** compare Bolt-DIY action parsing, Dyad file/edit workflow and OpenHands execution feedback against AppForge source. Keep deterministic mocked input labelled **SIMULATED AI GENERATION**, while validating actual exported code and persistence, never reporting mock as a real AI output.
- **Persistence:** commit each small repair separately to a branch, push through GitHub, open PR, inspect exact-head required Actions checks; merge only if all relevant CI jobs succeed. CI must not auto-deploy or call a paid endpoint.

### Provenance and limitations

- PR #411 (owner TOTP) and PR #412 (source audit) were observed as merged; PR #413 (autonomous Fly safeguards) was observed as open at this inspection.
- The screenshots reported 2,118 successful local tests, two network research tests skipped, typecheck/lint/build success and six deterministic product fixture successes. These reports are **not a GitHub CI result** and do not prove funded model generation.
- This status documentation change is not itself a source-code defect repair, nor an OSV vulnerability report; its verification must be attached to its own exact GitHub commit.

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

### Verified OSV result and additional Stripe regressions (2026-11-15)

- **OSV verified on earlier PR head `600099dcea54c7204004828818ecf76aaf92f44a`:** Official Google OSV-Scanner action `v2.7.1` scanned `package-lock.json`, enumerated **683 packages**, and emitted **"No issues found"**. GitHub Action job `132776615728` passed. **0 reported vulnerabilities, 0 reported high/critical** on that scan. Subsequent commits need their own OSV qualification. No package upgrades warranted based on that scan.
- **Signature fixtures:** `stripeWebhookSignatureOffline.test.ts` uses the real locally instantiated Stripe SDK to generate signed synthetic webhooks and calls the existing AppForge handler; rejects missing/tampered signatures and accepts an authentic synthetic signature without any network requests. **Simulated** until exact-head tests pass.
- **Concurrent delivery fixture:** `stripeConcurrentReplayOffline.test.ts` drives two simultaneous calls through the real event ledger against a serialized in-memory transaction/advisory-lock mock. Business-object payment-intent/invoice idempotency still requires actual Postgres integration verification. **Simulated** until CI passes.
- **Failed payment/cancellation:** Additional assertions in `stripeDelayedEvents.test.ts` require no minting on invoice failure and clearing the canceled subscription entitlement; existing code reconciles current Stripe subscription status. **Simulated**; no live Stripe calls.
- **Credit exhaustion:** Introduced original `src/lib/creditDeductionPolicy.ts` and integrated its `assertSufficientCreditBalance` check in `src/db.ts` under the existing user transaction lock. Tests cover zero balance, overdraft, malformed input, and invalid balance. No changes to plan pricing or credit amounts. **Simulated**; live database concurrency unverified.
- **Reference implementation inspection:** Medusa `packages/modules/payment/src/services/payment-module.ts` records its payment/refund transaction model and pending-refund idempotency recovery interval; AppForge retains separate customer credit ledger and requires money-event deduplication. Cal.com `packages/app-store/stripepayment/README.md` and `LICENSE` confirm test-mode integration boundary and MIT for that component; no external Cal.com integration or source copying. Both are architectural benchmarks only, and AppForge source is original.
- **Merge boundary:** PR #414 Vercel context is pending, legacy branch-protection API unavailable (403), and mergeability state `unstable`. Do not infer that pending check is optional. PR #415 requires fresh exact-head CI and OSV after every added change; no deployment or paid testing.

## GitHub merge reconciliation — 2026-11-15

- **PR #414 merged** to `main` as merge commit `008afdbc644757c51bbda2c86c21c8242d4dd8ea`. GitHub read-only branch detail verified `main.protected=false`, status-check enforcement off, no required contexts, and zero active rulesets; external Vercel pending status therefore is not required. Latest PR #414 GitHub CI/security/preview checks were successful. No Fly or Vercel production workflow launched by this documentation-only merge; production workflows are manual-only and Fly deploy job disabled.
- **PR #415 conflict reconciliation:** branch history and original fixture/source changes retained. This merge commit carries BOTH parent `main` and PR branch histories and preserves all PR #414 register additions, rather than replacing either set of documentation. A new exact-head CI/OSV run is required after reconciliation.
- **Latest before-reconciliation branch head `5c315cd33b847ef8ce4f522860725a6f2c074aec`:** Type Check, Lint & Format, Security Gate, Product Factory Validation, Test & Coverage, OSV, PR Checklist and Source Launch Inventory observed successful. Production Build remained in progress at that inspection. The new merge commit requires its own qualification.


## Final GitHub evidence checkpoint — 2026-11-15

**Merge records (verified GitHub API):**
- PR #414 merged into `main`, merge SHA `008afdbc644757c51bbda2c86c21c8242d4dd8ea`.
- PR #415 merged into `main`, merge SHA `43e1bc9325ae2e3305d598a46d73ea6f2b7b6f69`. Its branch merge reconciliation commit is `27cf8057d950ddd8e539c4643611e8af0255ae20`; it preserves both original register updates and all existing code repairs.

**PR #415 exact-head CI evidence for `27cf8057d950ddd8e539c4643611e8af0255ae20`:** CI Pipeline run `43704148643` completed **success**, including Lint & Format, Type Check, Test & Coverage, Product Factory Validation, Security Gate, Production Build (artifact compile, not deployment), and CI Release Gate. PR Checklist `43704148613`, Security Scanning `43704148653`, Source Launch Inventory `43704148617`, Deploy Preview (hermetic) `43704148631`, and official OSV action `43704149140` all reported success. `Flutter Node scaffold qualification` was still in progress at the time of merge; it was not a required check. External Vercel commit status remained pending and is not required: `main.protected=false`, enforcement off, required contexts empty, repository rulesets empty. No Fly or Vercel production deployment was run by these PRs.

**OSV finding record:** Official Google OSV-Scanner action v2.7.1 pinned via `87a33814e525266e92b7ecaa23a9743ee5a702b8` scanned `package-lock.json`, enumerated **683 packages**, and explicitly reported **"No issues found"** in job `132781498318` of run `43704149140`. **Reported high findings: 0; critical findings: 0.** No dependency fix was necessary based on this exact advisory scan. Only this lockfile was scanned; new advisories and untracked dependencies remain future review work.

**Verification classification after merge:** P0-06 Stripe billing = **Simulated** for checkout mock, signed SDK synthetic webhook, serialized concurrent event replay, failed invoice, cancellation and credit exhaustion; full live provider/payment and actual Postgres ledger concurrency remain **Unverified**. P1-11 OSV dependency sub-gate = **Verified** at the PR head; owner MFA and other security/recovery sub-gates retain their separately recorded status. P0-13 exact-head PR CI = **Verified** for PR #415 head, but a subsequent `main` documentation commit and new native qualification outcome are separate revisions requiring independent evidence. P0-03 actual funded model generation, P0-14 production activation and P1-09 native store deployment remain **Unverified**. No paid provider, credential, billing mutation, or production deployment authorized.

## Next engineering lane — signed webhook / Postgres / provider deadline (2026-11-15)

**GitHub baseline:** PR #415 merged into `main` at `43e1bc9325ae2e3305d598a46d73ea6f2b7b6f69` after exact-head `27cf8057d950ddd8e539c4643611e8af0255ae20` CI Pipeline, Production Build, Test & Coverage, Security Scanning, OSV, and hermetic Deploy Preview succeeded. Live Vercel status is nonrequired; no external deployment initiated.

### P0-06: real local database acceptance — pending exact-head CI
- `scripts/stripe-persistence-postgres.test.ts` uses a unique, disposable PostgreSQL schema under a loopback-only database in GitHub Actions; it validates a locally signed Stripe SDK invoice event, two concurrent duplicate event deliveries, different event IDs replaying the same paid invoice, unique invoice credit ledger entry and persisted balance, debit/exhaustion, concurrent duplicate payment-intent top-ups, and fail-closed payment-status eligibility.
- `.github/workflows/ci.yml` adds the test after the existing disposable Postgres suite. The new fixture deliberately **does not** claim a full real Stripe HTTP webhook handler or live Stripe checkout; an actual provider request and production settlement are out of scope. **Status: Unverified until exact-head GitHub job succeeds**.
- Medusa benchmark: payment-module transaction/idempotency lifecycle. Cal.com benchmark: localized Stripe payment integration and test-mode boundaries; no reference code copied.

### P0-03/P0-05: provider generation readiness — pending exact-head CI
- Existing `src/lib/llmProviders.ts` supports runtime-only environment secret injection; `src/_core/llm.ts` already has retry/backoff, failover and rate-reviewed monetary reservations; `src/services/llmProviderSpend.ts` retains uncertain provider charges for reconciliation rather than pretending failures are free.
- Added `src/lib/llmRequestDeadline.ts` with default 60-second whole-invocation cap and an explicit validated 5–120s override `APPFORGE_LLM_REQUEST_TIMEOUT_MS`. `src/_core/llm.ts` now passes a combined cancellation/deadline signal to the existing retries, gives a clear timeout error, and leaves unknown provider charges reserved. No key was generated or requested.
- **Boundary:** A provider HTTP success or metered model completion is NOT evidence that customer-generated source passed artifact validation; charging customer generation credits only on successful validated export must be established by the build worker/credit ledger integration tests. No assumption that an uncertain network failure is free.
- Bolt-DIY: provider/tool parsing; Dyad: incremental edits and saved project files (exclude its separately licensed pro folder); OpenHands: isolated execution feedback; these are evaluation benchmarks, not evidence of a live funded AI build.

**Scaffold:** GitHub Flutter/Node qualification job `43704148665` started on PR #415 exact head; outcomes must be independently recorded per Linux and macOS runner and by individual build stage. This fixture is not a proof that arbitrary generated customer applications meet Flutter native functionality requirements.


## 2026-11-15 — Main verification, owner cost hold, local auth and plan-transition expansion

- **Main exact SHA:** `aef8d1ba39698476989f51c5a86f1d1a98bfe90a`. Main push CI Pipeline `43705863720` and Security Scanning `43705863735` passed; Source Launch Inventory and backup jobs passed. **Recovery Readiness Audit `43705863788` failed**, because its static source check demanded an automatic `workflow_run` deploy trigger while `.github/workflows/deploy-production.yml` is intentionally manual-only and its jobs disabled. This is a genuine CI mismatch, not evidence of a live deploy. **Source correction:** update `.github/workflows/recovery-readiness.yml` to assert manual-only + literal disabled job, preserving exact-SHA/quality checks and the Fly cost hold. Await exact-head PR check before classifying repaired.
- **Flutter/Node shell fixture:** `43704148665` Linux `ubuntu-24.04` **Verified pass** (Node compile, Flutter widgets, web build, Android debug APK and release AAB, emulator integration test). macOS `macos-15-intel` iOS simulator step was **in progress** on latest read. This is a trusted scaffold qualification, not evidence any arbitrary customer app passed. Recheck job conclusion before final status.
- **Auth:** `src/__tests__/goTrueLifecycleOffline.test.ts` uses a **labelled GoTrue HTTP mock** plus mocked Supabase SDK sign-up/recovery; covers pending registration, forged/real confirmation, login, bearer-scoped logout, email resend, password reset and invalidated credentials. No real email was sent and no real Supabase project contacted. `src/__tests__/projectReadinessApi.test.ts` adds a second-customer `FORBIDDEN` project read/build-log case using actual tRPC authorization (mocked persistence). **Simulated pending CI**, local GoTrue and real RLS remain unverified.
- **Plan transitions:** Added direct real disposable Postgres invoice-ledger assertions for distinct paid builder/studio/starter invoices and no extra balance on a free/unknown invoice. Tracks plan build allowances separately from credit refills. This is an **invoice grant/cache integration test**, not proof of live Stripe plan-update and cancellation semantics, which require actual webhook handler qualification. **Pending CI**.
- **Reference benchmarks:** Medusa payments: durable idempotent monetary transitions and distinct invoice identifiers; Cal.com: validate signed Stripe event boundaries and separate app ownership. Bolt-DIY: project-file syntax checks and tool recovery; Dyad: persisted edits and preview lifecycle; OpenHands: isolated execution/testing harness. No AGPL/unclear-license reference code is copied; AppForge code and tests are original.
- **Financial/deployment boundary:** No paid service, secret creation, hosting deployment, subscription price or billing mutation. Explicitly no Fly reconnect. Main failing recovery audit is repaired in a dev branch, not concealed.


### Local user-authorized real-model smoke — source only, not customer production certification

- `scripts/real-generation-smoke.ts` uses the existing production-compatible provider router and bounded `invokeLLM` deadline/retry handling. It refuses CI and `NODE_ENV=production`, requires an explicit confirmation flag, and fails without a pre-existing runtime provider configuration. **We did not supply, create, request or use a key.**
- Once the owner independently configures a local environment secret and wants to permit provider charges, the **single command** from repository root is:
  `APPFORGE_REAL_GENERATION_SMOKE_CONFIRM=YES_I_AUTHORIZE_ONE_TEST_WITH_POSSIBLE_RETRIES npm run test:real-generation`
- This deliberately does not touch customer records or consume customer credits: it requests a minimal original Flutter/Node source pair from the provider, validates file presence and basic Node TypeScript syntax, and writes inspectable output to an OS temp directory. Provider HTTP retries or failover **can incur charges** to the account for the owner-controlled key. This is not the complete AppForge agent/project pipeline and cannot certify a build or store release. **Status: Unverified funded provider call.**
- The **actual customer build worker** still reserves build credits at admission; on failed/incomplete paths it attempts an idempotent `build_refund` before recording zero charged credits; after validated immutable artifact it records the build charge. A failed refund is logged for reconciliation, not silently treated as successful. Local `failedBuildCreditRecovery.test.ts` verifies this source contract; successful live persistence of charged and refunded balances remains to be independently demonstrated.

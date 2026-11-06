# AppForge no-spend development handoff — 2026-11-06

## Approved customer subscription pricing (USD)
Free / Explore $0; Starter $79 per month; Builder $199 per month; Studio $499 per month; Enterprise from $2,499 per month, sales-led.

**Not approved yet:** prices of optional credit top-up packs, exact included customer credits per plan, numeric per-job/provider USD spend budgets, final tax presentation and existing-customer migration terms. The draft UI shows provisional top-up prices but keeps subscription and credit purchase actions disabled.

## Changes staged in draft PR #250
- Upfront disclosure that credits are limited and separately paid top-ups may be required *before* the next subscription renewal; no automated charges, pause when depleted.
- New Free Explore accounts receive **zero** chargeable AI build credits; existing balances are not automatically removed.
- Stripe credit pack checkout rejects customers without a valid active paid subscription. Existing plans/receipts are not changed.
- Monthly balance replenishment is additive and overflow-checked; it does not wipe unused separately purchased top-up credits.
- Explicit null Studio/Enterprise build-count and contract credit limits are kept distinct from missing-tier Free fallbacks.
- USD Price identity/amount/interval/live validation and unlimited customer grant restrictions are inherited from draft PR #249.
- Regression tests added for prepaid rollover, finite free usage, price terms, credit top-up eligibility and tier null-limit semantics.

## Operational and financial release gates NOT yet satisfied
1. **Provider cost metering and hard caps:** instrument AI model calls, tokens, external builder services, VM/container/sandbox runtimes, storage/egress, retries, push/SMS and app deployments. Record actual cost per customer/project/job, reserve budget atomically, stop external calls when the verified paid limit is insufficient, and reconcile provider invoices.
2. **Pricing economics:** run true provider costing for at least one simple, medium and complex build in an approved test account; calculate customer-level contribution after payment/FX fees, refunds, taxes collected for government, support and allocated overhead. Confirm approved included credits and pack pricing with gross-margin targets and a contingency. Do not state guaranteed profits.
3. **Stripe live migration:** create NEW USD prices for the approved $79/$199/$499 subscriptions, and approve future top-up pack amounts. Do not change existing subscriptions or price IDs in place without agreed terms. Test webhooks, refunds and exactly-once entitlements.
4. **Real signup authentication:** confirm first-time email verification, password reset, Twilio SMS verification, login/logout/session recovery using authorised test devices.
5. **Complete paid customer journey:** paid checkout, credit issue, real build, revision, save/reopen, export and deployment, cancellation/renewal/refund, duplicate-event resilience and credit depletion.
6. **Visual delivery:** finish the owner's locked final AppForge brand/landing design with mobile responsiveness and accessibility.
7. **Security:** enable GitHub code scanning for the private repository if available, or use an approved local security scanning/artefact alternative; preserve dependency, secret, supply-chain and security-code review checks. Do not silently ignore CodeQL upload failure.
8. **Production signoff:** zero forced merges, exact-head CI/format/type/security tests, owner-approved deployment, Fly.io smoke tests, backups/recovery and rollback.

## Zero-spend policy until budget available
- Do **not** make live Stripe charges, real SMS sends, real AI/cloud generation tests, paid deployments, paid ads or new subscriptions just to certify this branch.
- No pricing-only merge may silently activate checkout against obsolete live Stripe Prices.
- Preserve existing user balances and entitlement history; disputed lifetime entitlements require contractual review.
- Existing production stays untouched unless separately verified and approved.
- Normal static GitHub source edits and pull requests are permitted; Actions may consume the repository's included minutes, so avoid unnecessary reruns.

**Engineering status:** Source changes staged for review, not a completed profit-safe billing release. Product capability certification and real-margin proof remain dependent on actual usage receipts and approved live testing.

## Latest offline engineering — financial release safety

- Implemented `customerComputeLaunchGate.ts` as a **non-bypassable production-only stop** for paid customer AI build entry and queue execution. Both REST and tRPC creation paths, tRPC resume and the build worker check it. Mocked development/CI flows remain available. No arbitrary `ENABLE=true` environment variable pretends to certify actual provider cost controls.
- Implemented `appForgeCommercialCheckoutGate.ts` as a server-side production checkout stop for *new* subscriptions and paid credit-pack sessions. Existing active customer subscriptions, Stripe objects, plan access and saved projects are not modified by this code. Mocked Stripe tests can run outside production.
- These stops are **intentional launch blockers, not delivered provider-cost metering or completed commercial functionality**. Remove them only in reviewed code when all provider-priced operations have per-tenant/job preauthorised spend reservations with atomic limits, accounted retries, reconciliation, and refund/cancellation rules; when correct new live Stripe price IDs and tax/customer disclosures are tested; and only following the owner's explicit deployment approval.
- Tightened prepaid/subscription credit arithmetic with `balanceAfterMonthlyGrant` across the plan and top-up grant paths, and added regression tests for customer compute start, resume, worker execution and direct checkout safety.
- **Do not assume GitHub Actions are free**: test scope should be limited to existing available minutes, and do not initiate live Stripe, SMS or paid LLM services.

## Offline verification strategy

1. Run format/type checks, targeted Vitest suites, mock gateway/Stripe tests and dependency security checks once on the exact integration head, without API secrets.
2. Preserve the stacked draft PRs (#249 → #250) until conflicts/rebase have been reconciled and the owner approves a single release candidate.
3. Test cost-budget denial and retry safety in simulated execution, then implement/verify provider pricing and atomic monetary budget enforcement in the billing ledger.
4. Clearly report source-level verification separately from executed CI results; tests written are **not** evidence they passed.
5. Keep Fly.io production and existing live Stripe products untouched.

## Further implementation in the no-spend draft
- Added `providerCostPolicy.ts`: deterministic USD-cent per-plan **provisional** budget evaluation and a conservative minimum quote calculator that includes provider maximums, support, allocated overhead, payment fees and target margin. These calculations **do not authorise live work**.
- Added `buildProviderUsage.ts` and integration in `_core/llm.ts` to record provider/model and observed tokens against the active build lease only. Token gaps, unknown billed retries and the true USD charge remain explicitly unverified; no secrets or prompts are stored in the usage event. This is a telemetry step, not spend enforcement or a substitute for reconciliation.
- Corrected the unused legacy `app-builder.ts` adapter: its draft return is no longer marked ready and its preview/deploy/export helpers do not fabricate externally deployed URLs.
- Tests cover quote arithmetic, budget exhaustion, usage attribution without cross-customer records, no invented cost, and honest legacy adapter outputs.
- **Further engineering required:** atomic provider budget reservations, actual model/provider pricing and usage reconciliation, fail-closed limits at *each* paid tool call (including retries), sandbox/container/database/storage/egress metering, real estimate approval, and safe release of the build/checkout gates. These are NOT paid-test-only items.

## One-command local test with no live service spend

On a Linux machine where AppForge's lockfile dependencies are already installed or cached, run:

```bash
npm run test:offline-commercial
```

This runs selected pure unit and source contract tests, assembles the local pipeline, explicitly sets `NODE_ENV=test`, and strips known billable provider, SMS, deployment and live Stripe credentials from the test subprocess. It does **not** run a real payment, generate a billed AI app, send SMS, deploy or contact real customer accounts. Dependency installation itself may use internet/bandwidth if local node_modules are absent; the script deliberately does not auto-install anything.

Passing this subset is **not** evidence that full CI, production auth, actual provider-cost metering, refund semantics or real app export/deployment have passed. Run the full existing repo CI/security/production-build checks before any production merge and keep paid customer tests pending budget and approval.

## Further offline release safety qualification

- New subscription checkout and customer paid build gating deny unknown, staging and preview environment names; explicit local test/development runtimes still run mocked tests. No production environment escape flag is provided.
- Failed LLM HTTP/network requests record unpriced per-build observations when an execution lease exists; tokens/cost remain unknown, not zero. Retries inside transport backoff are not yet individually costed, so this is audit evidence, not spend enforcement.
- The hard production customer compute gate remains until atomic monetary reservations, provider billing reconciliation and tested per-user/job caps have been implemented; do not merge directly to a production-deploying branch.

## Offline provider cost evidence summary

- Added a read-only per-user/per-execution `summarizeBuildProviderEvidence` helper over persisted `provider_usage` events. It distinguishes token observations, failed attempts, unknown-cost samples and verified-cost subtotals.
- **Never interpret a null/unknown provider cost as zero or as a confirmed positive margin.** Builds with no observations have unknown total, not zero total. Summaries remain `providerInvoicesReconciled: false` and `spendingLimitEnforced: false` until the full money-ledger is integrated.
- The raw build-event reader is not exposed as a customer-facing global route in this draft. Callers must first verify customer/project ownership; the helper adds a second user/execution filter.
- This is preparation for real atomic per-call USD reservations and provider invoice reconciliation, not sufficient reason to remove any production customer compute safety stop.

## 2026-11-06 continuation — preparatory monetary reservations (unmerged)

- Added `src/services/providerSpendLedger.ts` with per-user PostgreSQL row-lock serialization, idempotent per-operation reservations, project ownership check, UTC monthly budget accounting, and reject-on-overrun settlements. This is **a foundation only**; no billable provider call has yet been wired to this service.
- Added `provider_spend_reservations` to the authoritative schema under the **new** immutable migration `20261106_011`. Older applied migration contents/checksums are preserved; no live migration was applied.
- Added mock concurrency/idempotency/budget/settlement tests and included them (plus pre-existing checkout and cost-evidence tests) in the offline commercial suite. A separate local simulation of the ledger logic passed, but this is not an exact-head GitHub CI result.
- The consolidated draft PR #252 is aimed at `main` for full CI and hermetic preview qualification. It must remain draft with commercial checkout and customer build release gates closed.
- **Still missing:** full end-to-end connection of reservations to every billable provider attempt (including individual HTTP retry attempts/fallbacks), verified real provider pricing and bill reconciliation, safe release semantics only for calls proven never dispatched, sandbox/runtime/storage/egress/SMS/deployment cost accounting, complete mocked customer lifecycle, approved plan allowances and top-up pack prices, Stripe cutover and final owner release approval.


## No-spend automated customer acceptance continuation

- Added `src/__tests__/offlineCustomerAcceptance.test.ts`, checking the actual approved Stripe pricing policy, rejection of mismatched Stripe prices, prepaid credit rollover, exhausted-credit disclosures, paid top-up eligibility, unknown provider costs and the unreleased production gates.
- Updated `npm run test:offline-commercial` to execute this suite **and** the existing `customer-flow-contract.e2e.spec.ts` source-level lifecycle contract suite, alongside the preceding commercial and ledger tests.
- First consolidated GitHub CI surfaced four TypeScript errors (unsupported `Object.hasOwn` type library and a missing worker release-gate import). Fixes are committed. Prettier separately reported 20 changed files needing formatting; this remains open.
- Subsequent workflow runs on PR #252 failed with **zero executed job steps and unavailable run logs**. This is a CI execution/runner blocker, not a validated pass or a diagnostically confirmed source-code failure. Do not spend GitHub Actions minutes rerunning blindly.
- **Not certified:** exact-head full test execution, functional end-to-end UI/browser operation, live auth/Twilio, real Stripe entitlements, fully priced AI + infrastructure workload, export/deploy proof, or positive net profitability. AppForge checkout and non-owner production builds remain fail-closed.

## Additional no-spend provider protection work

- `src/lib/providerCostEnvelope.ts` now calculates conservative maximum USD-cent envelopes for a declared sequence of provider requests, individual retries, and fallbacks. It accounts for maximum input/output tokens, fixed request costs, and explicit externally priced runtime/storage/egress ceilings using bigint arithmetic and upward rounding.
- Unquoted, expired, invalid, or zero-assumed rates fail closed. A provisional rate cannot be used as confirmed pricing; a "confirmed" snapshot is also checked for currency-budget completeness and expiry before use. **These are standalone offline calculations, not actual provider price integration.**
- `src/services/guardedProviderOperation.ts` is a preparatory wrapper: it requires a current authenticated build execution lease, a confirmed cost envelope, and a successful atomic money reservation before invoking a provider callback. Duplicate reservations never cause duplicate provider dispatch. A timeout or ambiguous provider failure never automatically releases a reservation.
- `providerCostEnvelope.test.ts` and `guardedProviderOperation.test.ts` are included in `npm run test:offline-commercial`. Tests are committed but **not yet verified by full GitHub CI**, which continues to fail before steps execute.
- **Still required for actual production authorization:** server-authoritative cost ceilings (not caller-supplied), provider-confirmed rates and versions, successful linkage inside every real provider call and individual transport retry/fallback, separate container/storage/egress/SMS and deployment admission, receipt reconciliation, budget-release proof for never-dispatched operations, full customer lifecycle certification and exact-head passing CI. Never remove the commercial or compute release stops based on these helper modules alone.

## 2026-11-06 security review: no caller-controlled provider budgets

- Provider monetary reservations now read the active customer's subscription status and tier inside the same transaction that locks the customer, rather than trusting a `monthlyLimitCents` argument supplied by a calling route.
- The server applies only the **provisional** internal ceilings in `providerCostPolicy.ts`; free, expired, cancelled, unknown, enterprise and unpriced tiers cannot reserve provider costs until their own commercial policy is explicitly defined. These ceilings are not owner-approved allowances and are **not** an authority to open paid customer builds.
- Adjusted the guarded provider wrapper so callers cannot provide spending caps, and expanded ledger tests for cancelled/unknown tiers, duplicate operations, concurrent cost exhaustion and settlement consistency.
- No live database was migrated, and no provider call was dispatched. Exact-head runtime and GitHub CI verification remain outstanding.

## 2026-11-06 continued offline commercial hardening

- Fixed preparatory `providerSpendLedger` so the caller cannot pass its own spending limit. It obtains active subscription status and the provisional internal tier ceiling under the same customer row lock as the spending reservation. Unsupported/unknown/expired/unpaid tiers fail closed.
- Draft `Pricing.tsx` no longer advertises provisional `$100/$200/$500` top-up prices. Exact USD pack pricing is visibly awaiting owner approval, purchases remain disabled, and separate top-up payments are explicitly disclosed.
- Instrumented `fetchWithBackoff` in `src/_core/llm.ts` to persist unknown-cost usage evidence for **each retryable HTTP and network error** in a build, as well as aborted provider requests, instead of merely recording the final response. This evidence is not a provider invoice or spending enforcement.
- Updated relevant offline tests for server-derived tier ceilings, unapproved price disclosure, transport retries and uncertain aborted attempts.
- GitHub Actions has repeatedly ended workflows without job execution steps; **the code and tests are not certified as passing**. Do not circumvent the required checks or production release gates. Remaining uncorrected code-style reports and exact-head build/test failures must be addressed when execution is available.

## Direct provider-dispatch hard stop

`runReservedProviderOperation` now itself calls `assertCustomerComputeLaunchCertified(false)` before accessing a build lease or reserving provider funds. That makes the preparatory helper fail closed in production and unknown runtime environments even if a future route accidentally calls it directly. An offline regression contract protects this ordering. A separate reviewed certification change must establish complete pricing, rate-source authenticity, all-provider/transport-retry cost enforcement and invoice reconciliation before this stop can be removed.

## Pending-charge rollover protection

- Fixed `providerSpendLedger.ts` to count **all outstanding reserved** (unreconciled) provider charges, including operations begun in earlier UTC calendar months, against the current period's admission budget. Only verified **settled** charges from the current period are counted as current-month settled usage.
- A regression test in `providerSpendLedger.test.ts` covers an old-month pending charge preventing overspend after month rollover, followed by its settlement and restoration of current-month available budget.
- This is conservative financial risk accounting, not provider verification or a production integration certification. Existing release stops remain.

## Current no-spend hardening — expiry and credit atomicity

- `runReservedProviderOperation` now exclusively uses the trusted current server clock for provider price expiration. The previous optional caller clock was removed from this dispatch path; test coverage uses Vitest's isolated fake system clock instead.
- `providerSpendLedger` now requires a **non-null, unexpired paid subscription period** to create a provider-money reservation. An "active" string alone is not sufficient. Tests cover expired and absent periods.
- `applyGodCodeGrant` now locks the customer inside one transaction, rereads the latest credit row and writes the grant and audit row atomically. The previous implementation read its balance before the transaction and could overwrite concurrent paid credit transactions. Lifetime grants verify owner identity inside the transaction; limited grants reject unsafe amounts. Added `ownerCodeCreditSafety.test.ts` to the offline commercial suite.
- These are committed source corrections and regression-test additions, **not an executed test pass**. GitHub Actions jobs continue to report failed before producing steps/logs on this branch; live checkout and customer production builds remain disabled.

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

## Offline safety follow-up — environment and AI failure audit

- Both new-checkout and customer-build safety gates now require an explicitly recognised local `test` or `development` runtime for mock activity. Preview, staging, missing/unknown environment names, and production deny customer paid work until full provider USD-cost enforcement is certified. Do not set `NODE_ENV=development` on an external production worker to bypass this.
- LLM provider HTTP/network failures now attempt to append per-build `provider_usage` evidence with unknown tokens and `costVerified: false`. Unknown/unreported charges are **not zero-cost entries**, and retry attempts internal to provider request backoff may still require additional reconciliation instrumentation.
- These checks are not a verified provider-cost ledger, not atomic customer-spend reservations, and not proof that paid builds are profitable.
- Regression tests target staging/preview fail-closed behaviour, guarded checkout ordering, and unpriced provider-failure evidence. The precise GitHub CI outcome must be checked before merging.

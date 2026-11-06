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

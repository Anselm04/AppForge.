# AppForge commercial margin gate — pricing and compute controls

**Status:** Technical guardrails are proposed; financial profitability and a live paid customer journey are **not certified**. Do not claim any subscription price guarantees profit.

## Current displayed catalogue (USD)

| Plan | Monthly subscription | Monthly credits | Published build cap |
|---|---:|---:|---:|
| Free | $0 | 20 | 3 |
| Starter | $49 | 100 | 16 |
| Builder | $149 | 400 | 66 |
| Studio | $399 | 1,500 | Credit limited |
| Enterprise | From $1,499; quote required | Contract-defined | Contract-defined |

Optional top-ups: 50 for $50, 100 for $100, 250 for $250. A standard build reserves 5 credits but **that reserve is not a verified upper bound on third-party compute expenses**. Legacy and custom entitlements must be audited before commercial launch.

## What is now enforced by the proposed change

- Stripe Checkout retrieves the actual Stripe Price and refuses to proceed if the price is inactive, is not USD, does not match the advertised amount, is not monthly recurring for a subscription, or does not match the production/live environment.
- Enterprise stays sales-led; no automated unlimited monthly credit grant is invented.
- New transferable lifetime/unlimited codes cannot be created, and unredeemed legacy lifetime codes are held for owner-assisted review. Already-redeemed customer entitlements are not rewritten by this change and require an explicit contractual/migration audit.
- Subscription allowances and purchased credits are not assumed to cover all underlying provider costs. Do not sell "unlimited builds" as a proxy for prepaid credits.
- Existing Stripe webhook/payment and user credit lifecycle stays intact; no automatic top-up is authorised.

## Required financial launch evidence

For each plan and customer cohort calculate, using actual receipts/costs:

`monthly gross contribution = collected subscription + collected top-ups - refunds - payment fees - taxes collected on behalf of government - AI inference - build compute - storage - bandwidth - deployment/support variable costs`.

Company operating overhead, owner compensation, income tax and reserves must be funded from the contribution remaining **after** direct costs; GST collected is a liability and not income. A subscription alone does not ensure a monthly profit, and profit depends on actual customer counts and workload.

Use a target margin policy configured only after measured provider unit costs. Before allowing free trials or compute-heavy paid operations, add *provider cost metering* and hard per-customer USD-denominated compute expenditure caps; a credit count is not a substitute for an external spend cap. Set build concurrency quotas and pause external jobs when budget estimates are insufficient. Respect existing paid contracts during migration.

## Production deployment gate

1. Verify live Stripe product price IDs, exact USD cents, monthly periods and taxes. Confirm that API runtime keys match Stripe live mode.
2. Run full CI, security, code formatting and checkout contract tests.
3. Audit all existing non-owner unlimited/lifetime grants and outstanding redemption codes; review legal obligations and owner-approved remediation.
4. Verify real USD provider variable costs for Starter, Builder and Studio customers; publish or amend prices only after a positive cost model with contingency.
5. Test signup, verified email/SMS, live Stripe payment, invoice/webhook, credits, realistic resource-heavy build, retries/pauses, export/deploy, cancellation and refunds.
6. Keep product release and provider credentials protected; no direct production change is included in this proposal.

**Important:** The owner previously locked a new neon AppForge redesign; implementing that artwork and releasing it is separate from this pricing safety change.

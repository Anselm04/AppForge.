> **HISTORICAL PRICING SCENARIOS — SUPERSEDED.** This file is not the current price authority and must not reinstate draft-pricing, stopped-development or frozen-checkout instructions. Approved current USD prices: Starter $79, Builder $199, Studio $499, Enterprise from $2,499, with optional Aftercare Plus $19/month (separate customer opt-in). See `docs/PRICING_OWNER_APPROVED_USD.md` and `src/services/appForgePricePolicy.ts`. Existing customer agreements are not silently repriced. Historical calculations remain illustrative and are not audited profit guarantees.

# AppForge approved subscription price proposal — USD

**Owner-approved subscription amounts (6 November 2026). This is a draft implementation, not a live Stripe price change.**

## Monthly subscriptions — USD, excluding applicable tax

| Tier | Price | Customer | Provisional internal provider-cost envelope |
|---|---:|---|---:|
| Free / Explore | $0 | Learn, describe an idea, receive a scope estimate | No unapproved paid provider compute |
| Starter | $79 | First-time builders and ordinary individuals | $12 / month |
| Builder | $199 | Entrepreneurs developing products | $35 / month |
| Studio | $499 | Agencies and businesses creating multiple products | $95 / month |
| Enterprise | From $2,499 | Complex integrations and enterprise support | Custom written allowance and costs |

The provider-cost envelopes above are **planning scenarios, not enforced production limits**, not customer credit values, and not a guarantee of successful products. An approved customer subscription price is not approval to activate unmetered AI spending. Credit quantities and build costs must be calibrated against actual provider bills and task complexity.

## Customer disclosure — REQUIRED AT EVERY COMMERCIAL DECISION

**Your monthly subscription includes a limited amount of credits, not unlimited builds. If you use up your credits before your next monthly subscription payment, you will need to buy an additional credit top-up as a separate payment to continue building right away. If you choose not to top up, credit-consuming work pauses until new credits are available again (for example, through your next eligible subscription refill). We never charge for extra credits automatically. More complicated apps and extra changes can require additional credits, even within the same billing month.**

Display this unambiguously on:
- Landing page and subscription comparisons.
- Customer-facing pricing page and top-up selection.
- Account credit balance, pre-build cost estimate, and low/out-of-credits screens **when implemented**.
- Confirmation immediately before the initial subscription purchase and every subsequent paid top-up **when checkout is enabled**.
- Email receipts/customer support guidance where appropriate.

Do not misrepresent a fixed number of completed apps, AI inference requests, cloud build minutes, deployed-app operating costs or integrations as included unless actually verified and bounded.

### Top-up proposal (NOT YET OWNER-APPROVED)

Current draft UI displays credit packs: 50 credits for $100, 100 credits for $200, 250 credits for $500, all USD. These **pack amounts remain provisional** until real provider and per-build costs, credit economics and Stripe live Prices have been verified and the owner separately approves them. Customer purchases must be individually authorised; no surprise charges or automatic top-ups.

Major build overruns must trigger a quoted, explicitly approved and prepaid workload budget. Long-term hosting/deployment costs, SMS, paid ads, app-store/developer fees, domain fees and external subscriptions must be excluded or included only under specific finite disclosed terms.

## Company-level economics — illustrative stress test, not a forecast

Illustrative month: 10 Starter + 10 Builder + 4 Studio + 1 Enterprise = **25 customers**.

| Item | USD / month |
|---|---:|
| Starter: 10 × $79 | $790 |
| Builder: 10 × $199 | $1,990 |
| Studio: 4 × $499 | $1,996 |
| Enterprise: 1 × $2,499 | $2,499 |
| **Monthly recurring revenue** | **$7,275** |
| Provisional provider spending ($12/$35/$95/$500) | ($1,350) |
| Illustrative per-customer servicing ($10/$25/$60/$300) | ($890) |
| Payment/FX allowance at 5.5% (approximate) | ($400) |
| **Contribution before shared company overhead** | **$4,635** |
| Illustrative deductible shared costs (founder gross pay, cloud/security, accounting/legal, marketing) | ($15,000) |
| **Illustrative operating loss before company income tax** | **($10,365)** |

No positive company income tax is assumed on a tax loss (tax accounting may differ); there is **no** $3,000 reserve allocation in this losing scenario. Founder pay, if included in the illustrated $15,000, is gross PAYE-taxable remuneration; personal income tax is withheld from gross wages rather than charged again as a separate company expense. GST collected for government is not revenue. The model does **not** support claims of guaranteed profit at 25 customers.

At this same illustrative mix, average contribution is about $185 per customer, so approximately **81 paying customers** would be needed to cover $15,000 fixed overhead, before the owner targets positive company profit and additional after-tax reserves. Real break-even depends on customer mix, build completion rates, direct metered expenses, payroll, support workload, exchange rates, refunds and seasonality.

This is why protecting per-customer third-party compute spend is non-negotiable at the approved accessible subscription prices. Build extra services only with consent, credit entitlements and sufficient contribution.

## Launch conditions

1. Audit existing customer subscriptions, balances, legal terms and outstanding credits before any price migration; grandfather or obtain consent as appropriate.
2. Implement **per-tenant and per-job provider cost metering** for AI inference, tool calls, compute/sandbox time, storage, egress, retries and customer-deployment support. Atomic hard caps must stop provider usage before external costs outrun paid allowances; quota cannot be based on nominal credits alone.
3. Establish a verified minimum contribution margin using actual costs, payment fees and shared-company overhead allocation. Keep emergency reserves and owner gross pay in the model.
4. Finalise internal credit conversion to external USD costs, customer-facing credit entitlements, and separately approved top-up pack prices.
5. Create/reconcile new Stripe live USD recurring Prices and tax rules without modifying existing customer subscription Prices behind their backs. Switch checkout only after the owner approves pack economics, legal notices and entitlements.
6. Require purchase-by-purchase customer consent before payment for any top-up; keep builds paused without sufficient credits, and ensure a failed/refunded payment never grants additional compute.
7. Complete signup, email/SMS verification, Stripe webhook, entitlement/refund/retry, low-balance notifications, build/export/deploy, cancellation and full real-cost tests.

**Status: approved subscription price amounts, unfinished economics/usage enforcement, no authorised live price cutover.**

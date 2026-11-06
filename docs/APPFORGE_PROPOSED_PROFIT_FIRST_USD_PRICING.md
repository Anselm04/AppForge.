# AppForge profit-first pricing proposal — USD (6 November 2026)

**PROPOSAL ONLY. NOT AUTHORISED FOR STRIPE OR PRODUCTION.** Replaces the old $49/$149/$399/$1,499 catalogue only after owner approval, an entitlement migration plan, measured provider costs and verified Stripe live price objects.

## Candidate subscription prices

| Tier | USD/month (excluding applicable tax) | Modelled hard ceiling for third-party variable provider costs per customer per month | Other boundary |
|---|---:|---:|---|
| Free | $0 | $0 chargeable provider compute | Brief/estimate, onboarding and documentation only; no free paid generation proposed |
| Starter | $499 | $75 | Limited scope, prepaid additional usage on approval |
| Builder | $1,499 | $250 | Additional integrations/retries require quoted prepaid budget |
| Studio | $3,999 | $750 | Team features and bounded workloads, no unlimited builds |
| Enterprise | From $11,999 | Initial illustration: $2,500 | Tailored contract, cost and support envelope, no self-serve checkout |

The "provider cost" figures above are **internal cost ceilings**, not dollar-denominated customer credit balances and not promises of completed builds. Those caps **do not exist as enforced controls today**. Do not merge or launch this price change before atomic metering of actual inference, tool calls, sandbox runtime, storage, egress, queue time and retries can stop execution. Do not advertise a fixed build count unless it passes real workload certification and fits within the cap.

### Additional build usage
- Require a customer-visible quote and prepaid authorisation for resource-intensive builds and further AI iterations before extra provider usage.
- Proposed paid retail markup is **at least 3x measured incremental third-party variable cost**, including estimated retries, plus a separately budgeted support allowance when needed. Unused prepaid fees require a clear refund/credit policy compliant with applicable law.
- No automatic charges, no unapproved metered overages, no unlimited agency/Enterprise compute.
- Existing 50/100/250 abstract credit pack values, the five-credit build reservation and seven-day free-trial claims must be reconciled with **actual metered USD provider spend** before release. Historical prepaid credits and contracted entitlements require review; do not silently devalue them.
- Hosting a customer's deployed app (and App Store fees, domains, phone/SMS, marketing spend, storage at scale and external vendor subscriptions) must be quoted/billed separately or included only under a stated finite contract limit.

## Illustrative monthly business economics (USD, no GST included in revenue)

Assumptions, **not verified bills**:
- 10 Starter customers, 10 Builder customers, 4 Studio customers and 1 Enterprise customer.
- Every customer uses the full planned variable provider-cost ceiling.
- Customer-variable support/servicing allowances per month: $35 Starter, $150 Builder, $450 Studio, $1,500 Enterprise.
- Conservative payment/FX allowance: **5.5% of sales**, approximately $2,639 at the illustrated mix, pending actual Stripe settlement mix. Actual Stripe NZ rates vary: domestic cards 2.65% + NZ$0.30, international 3.5% + NZ$0.30, plus 2% if currency conversion is needed.
- Fixed shared monthly overhead **$18,000**: $7,000 founder gross salary (employee PAYE/ACC withheld and remitted according to NZ rules), $4,000 shared cloud/security/operations, $2,000 accounting/legal/compliance, $2,000 marketing/customer acquisition, $3,000 reserve and contingency. These are planning allowances, not audited company costs.
- NZ company income tax modelled at 28% on positive **taxable** income after deductible business expenses, with accounting adjustments ignored in the illustration. GST is a separate collection/remittance obligation, not revenue. Owner salary is a cost *before* company profit; do **not** add personal income tax again as an extra corporate expense on top of gross wages.

| Item | Monthly USD |
|---|---:|
| Gross subscription revenue | $47,975 |
| Third-party provider budget consumed | ($8,750) |
| Customer-variable support costs | ($5,150) |
| Payment/FX allowance (5.5%) | ($2,639) |
| Fixed shared overhead, founder gross salary and reserves | ($18,000) |
| **Illustrative pretax company profit** | **$13,436** |
| Modelled NZ company income tax (28%) | ($3,762) |
| **Illustrative retained company profit after tax** | **$9,674** |

The founder would also have **$7,000 gross monthly pay** in this scenario, subject to PAYE, ACC and individual circumstances. The retained company profit is not personal take-home pay. Business cash flow and deposits/working capital may differ from recognised accounting profit.

At this same artificial customer *mix* and average contribution/customer, the $18,000 fixed overhead requires approximately **15 paying customers to break even**; real break-even varies drastically by plan mix, workload, payment method, refunds and support. **Zero/low customers can still mean a loss regardless of price.**

### Before numbers can be made live

1. Owner approves prices, commercial positioning and existing-customer handling.
2. Provider-token, subprocess, VM minute, storage, build retries and customer-deployment COGS are metered by tenant/job; strict spend and concurrency caps fail closed.
3. Contractual agreements for old customers and existing credits are preserved or agreed changes obtained.
4. Stripe live USD recurring Prices and tax settings are created/reconciled **without overwriting or disturbing existing subscription Prices**; old checkout continues under its previous terms until safe cutover.
5. Corresponding cancellation, free-trial, finance/tax disclosure and build-count text across translations/website is updated; do not display unavailable capabilities as promised.
6. Full flow: verify payment → grant capped entitlement → quote → approve → build/charge → pause on cap → refund/reconcile; live tests and rollbacks.
7. Reforecast from actual third-party invoices and cohort load, including business and owner tax treatments reviewed by a NZ accountant.

**These proposed amounts are intentionally higher, not scientifically exact. They are not a guarantee of positive profit or an authorised production price list.**

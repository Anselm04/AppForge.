# AppForge pricing truth and compute-cost protection (USD)

## Owner-approved pricing
| Tier | Monthly price USD | Included monthly compute credits | Build entitlement |
| --- | ---: | ---: | --- |
| Free | $0 | 20 | 3 build requests / month |
| Starter | $79 | 100 | 16 build requests / month |
| Builder | $199 | 400 | 66 build requests / month |
| Studio | $499 | 1,500 | Build count is not the entitlement; every build remains subject to credits |
| Enterprise | From $2,499; sales-led | **Contract-defined; not unlimited** | **Contract-defined; not unlimited** |

**Only the verified AppForge owner account may be treated as having owner-level unlimited access.** An Enterprise subscription is not equivalent to owner access. Do not give free or unlimited compute to paying customers.

Current backend `getTierCreditRefill('enterprise')` is `null`, so no Enterprise monthly refill amount has been provisioned by the existing catalogue. No fixed allowance may be advertised until an owner-approved contract and enforced entitlement are implemented. Enterprise cannot be launched as a self-serve unlimited offer.

## Optional aftercare (owner-approved, USD)
- Essential customer aftercare, build handover and deployment guidance are included with paid plans.
- **Aftercare Plus: $19/month**, expressly opted in by the customer; never selected by default.
- Starter + Aftercare Plus: **$98/month**; Builder + Aftercare Plus: **$218/month**; Studio + Aftercare Plus: **$518/month** before applicable tax.
- Managed Aftercare is a separate scoped service from $79/month, not an automatic $19 add-on, and must be deliverable before a customer is charged.
- Third-party hosting, domains, AI API and usage-based costs are excluded unless explicitly quoted and contracted.
- Legacy Stripe Price IDs (Starter $49, Builder $149, Studio $399, Enterprise $1,499) are **not** approved for new purchases. Existing subscriptions must be handled without silently repricing customers.

## Operating margin rules
- Compute and AI usage must be funded by prepaid entitlements/top-ups or an explicitly approved and metered Enterprise allowance.
- A standard full build currently reserves 5 credits; a Senior Dev session costs 6 credits. Complicated builds or iterations may require extra credits; the full cost is not guaranteed by a standard reservation.
- Optional top-ups are listed in the app at **$1 USD per credit**: $50 / 50, $100 / 100 and $250 / 250, subject to configured live Stripe prices.
- When credits are exhausted, build processing pauses. No automatic paid top-ups without explicit customer permission and correct Stripe charge confirmation.
- Before selling a plan, calculate gross margin after AI provider charges, hosting, background tasks, storage, app deployment, processor fees, refunds, and support.
- Add usage metering, budget enforcement, tenant limits and provider cost auditing. Monthly subscription price alone does not prove positive gross margins.
- Distinguish published USD copy from the actual Stripe Price object currency and amount; fail closed on mismatches at checkout.

## Blockers before commercial production rollout
1. Define the Enterprise contract's numeric credits/build caps and enforce them end to end in the backend. No guessing.
2. Audit and restrict `lifetime`/`god code` grants, legacy unlimited flags and existing subscriptions to prevent non-owner unlimited access. Do not silently delete customer entitlements; complete an owner-reviewed migration.
3. Validate all language translations, website pricing, Stripe live prices, invoices and refund/cancel paths for consistency.
4. Add tests proving customer compute and rate limits cannot be bypassed while preserving the verified owner exemption.
5. Verify real operating unit economics and the complete paid end-to-end lifecycle.

This change records pricing disclosure and contract rules; it is **not** certification that Enterprise entitlements or cost metering have been fully secured in production.

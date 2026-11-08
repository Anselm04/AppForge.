# AppForge Intelligent Solution Selector — commercial and technical contract

Status: design and implementation requirements; NOT a claim of released capability.
This change does not enable, deploy or bill any third-party service.

## Goal
Before build credits are consumed or a product is generated, offer a ranked set of technically viable, appropriately licensed solutions for each major feature. Compare open-source/self-hosted, budget commercial, managed premium, and future proprietary TrillionAI options. Preserve user choice and prevent undisclosed external charges.

## Mandatory decision flow
1. Extract the customer's desired features, availability, quality, privacy, regional, deployment and budget requirements.
2. Research or retrieve verified candidates, provider licences, availability and pricing with source/date; do not invent provider pricing or benchmark results.
3. Rank by suitability to requirements, **not price alone**, with separate weighted scores for quality, latency, reliability, maintenance, security, privacy, ongoing cost and lock-in.
4. Show at least two viable alternatives when available. If only one meets the requirements, say so. Never imply open-source automatically performs worse or paid always performs better.
5. For each proposed dependency, disclose who operates it, applicable open-source licence obligations, hosting and setup costs, estimated monthly usage with assumptions, usage caps, known limitations, required customer accounts and credentials, and possible outages. Free software can have nonzero operational cost.
6. Show build-time versus post-deployment expenses in separate categories: (a) AppForge subscription/build credits; (b) third-party service charges owned by customer after handover; (c) optional TrillionAI proprietary component subscriptions/licences, including recurring price and renewal terms. Never silently bundle or impose ongoing charges.
7. Require positive, granular acknowledgement of selected dependencies and cost terms before initiating billable builds. The acceptance record must identify tenant, project, candidate/version, licence, displayed disclosures, cost estimate and assumptions, signed-in user, timestamp, and disclosure policy version.
8. Decline/change selection: re-plan and disclose new feature limitations. Do not generate a fake/imitation implementation to appear complete; reject requests for nonviable configurations.
9. Build only approved configuration and enforce dependency allowlist during planning, generation and edits. If dependencies change, renew disclosure and acceptance before consuming further credits.
10. Validate outputs: compile/test, check licences, ensure actual service integration, secret isolation, no TrillionAI-owned credentials embedded in exports, and produce a deployment dependency manifest and migration/replacement instructions.
11. Customer exports and deployed code must use customer-owned accounts for live third-party APIs unless an explicitly priced managed TrillionAI service was chosen. Never put secrets in client apps.
12. Record audit logs without storing provider secrets. Implement authenticated tenant-specific storage, versioned acceptance, cancellation handling, provider availability fallbacks, cost safeguards, and validated entitlements before enabling the UI in production.

## Provider switching and proprietary TrillionAI products
- Use adapter interfaces that allow alternative commercial, free and proprietary providers without rewriting product features.
- When TrillionAI releases a competing proprietary service, make it a visible optional recommendation with objectively disclosed comparisons and separately accepted recurring licences.
- Never auto-migrate a deployed customer product or change its billing/feature behaviour without informed consent and compatibility testing.
- Product subscription licences and AppForge builder subscriptions are separate contracts; after deployment, recurring TrillionAI charges exist only for services the customer opted into and continues to use.
- Customer remains entitled to previously purchased/exported deliverables subject to the agreed contract and third-party licences.

## Performance disclosures
Use measured benchmarking if available. When no verified benchmark exists, mark quality/performance differences as *unverified estimates* and describe trade-offs without falsely representing paid offerings as superior.
Consider startup time, throughput, response latency, accuracy, accessibility, device requirements, support and scalability; display requirements-specific comparisons.

## Legal review
The consent dialog does not waive statutory consumer protections. Review applicable NZ and international consumer, privacy, copyright, open-source and recurring-payment obligations before launch.

## Acceptance tests required
- No provider selected before explicit user action
- Free alternative with hosted operational costs correctly displayed
- No claim that free always underperforms paid
- Reject unknown pricing/unsupported benchmark claims
- Customer rejects a mandatory feature: require re-plan; no fake substitutes
- Re-consent when generator changes provider or adds paid integration
- Metered third-party service uses customer-owned key after deployment
- Never export TrillionAI credentials or run live paid calls in offline tests
- Recurring TrillionAI licence visible and opt-in before build
- Consent audit records version, terms, costs, customer, project and provider
- Cancelled/expired proprietary subscription handled according to disclosed contract
- Future proprietary service offered as optional replacement; no silent migration

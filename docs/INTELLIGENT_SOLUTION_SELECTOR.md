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


## Customer-first build guarantee and interactive disclosure
Every offered configuration MUST generate a genuinely functional, complete product meeting the expressly agreed essential requirements. Budget choice is NOT permission to intentionally degrade workmanship, introduce fake placeholders, omit agreed functionality or deliver a nonworking product. If a cheaper option cannot meet a requirement, clearly identify the mismatch before build and let the customer revise the requirement, choose an alternative or cancel that configuration with no misleading promise.

### Short, mandatory pre-build explanation
For each material dependency, display a brief plain-language summary that says:
- What this service does in **your product**, and why it is being recommended.
- Which parts will work at the selected tier and how they compare with other viable options (speed, quality, scale, reliability, support, features, and maintenance).
- One-time build expenses, potential recurring external subscription/API/hosting expenses, usage assumptions and any uncertain future costs.
- Who pays during the build versus who pays after deployment, whose credentials are required and which features will stop or degrade when a provider is unavailable, cancelled or exceeds its allowance.
- Whether the component can be replaced later, expected migration effort, data portability and any termination/lock-in restrictions. State when a free alternative is equivalent for the customer's requirements.

### Customer response controls
- Require **Agree** or **Disagree**, initially unselected, with an accessible consent checkbox that specifically acknowledges the shown third-party expenses and dependencies. Do not use pre-ticked consent, dark patterns or forced premium selection.
- Provide a free-text field labelled **Tell AppForge your requirements, budget limits or preferred alternatives**. Customers may request cost ceilings, free-only providers, no external accounts, self-hosting, reduced dependence on vendors, preferred regions, or their own service provider.
- The customer's response feeds a fresh solution comparison and realistic re-estimate. Do not interpret their narrative as agreeing to a contract or as approval for previously unseen expenses; after changes, show the revised summary and request explicit acceptance again.
- On **Disagree**, do not start or bill a build. Explain which outcomes are not achievable under the rejected terms, offer revised configurations or allow customers to leave without being trapped.
- Show final **Your selected solution** summary, independent customer-ownership and credential responsibilities, recurring licences and any identified post-deployment obligations before build authorisation.
- Keep acknowledgement brief and readable, with a details view for full terms and source links. Customer may view the complete comparison before choosing.
- Accessibility: keyboard/screen reader-friendly controls, plain language and no consent hidden by scroll tricks.
- Persist auditable response, alternatives shown, custom requirements, chosen provider and version, disclosure version, displayed prices/assumptions and timestamp. Record refusal as refusal, not consent.

### Operational acceptance criteria
- Cheapest technically viable choice remains a properly engineered, working product.
- If the requested functionality is not possible on the free tier, block a misleading build and present the exact alternatives and performance impact.
- Customers can decline and revise their stated budget/requirements without authorising charges.
- Free-text preferences trigger re-planning, not auto-acceptance.
- Switching provider or changing recurring charges requires renewed affirmative acceptance.
- Exported/deployed products do not secretly depend on TrillionAI's paid provider credentials; default to customer-controlled accounts and portable, documented adapters.

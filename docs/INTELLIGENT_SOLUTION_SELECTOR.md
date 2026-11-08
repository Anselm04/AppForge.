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


## UX acceptance contract — five-second understanding
The selector must be designed for ordinary non-technical customers first. Do not replace informed consent with a wall of text, a confusing checkbox maze or technical jargon.

### Default visible comparison card
Show **at most three suitable choices** at once (e.g. Free / Best value / Premium, only when they are viable). Each card should be scannable within roughly five seconds and display, in this order:
1. **What you get:** one sentence, plain English, what works and any important missing feature.
2. **Pay now:** the exact known AppForge/build charge, or a clearly labelled estimate.
3. **Pay later:** a visible recurring/monthly amount or clearly labelled usage estimate/range, including the responsible provider; if genuinely unknown show "Varies with use" with a short explanation, never "$0" for unknown costs.
4. **Main trade-off:** one brief factual comparison (e.g. slower speech generation, requires your own server, or more lifelike speech) only when verified or labelled as an estimate.
5. **Who manages it:** customer, TrillionAI (only for an accepted managed service), or third-party provider.

Use a compact comparison pattern and plain-language labels: "Pay now", "Possible monthly cost", "Works after launch?", "You manage", "What changes". No unexplained jargon (API, latency, inference, token, deployment, SaaS, self-hosted, etc.). Explain unavoidable terms in tap-to-expand help.

### Progressive disclosure, never concealed charges
- One short visible headline above the cards: **"Your app will work with any option shown. The differences are features, speed, upkeep and future costs."** Only show options that meet the agreed essentials; otherwise label an option explicitly as requiring changed requirements and do not make it selectable as-is.
- Highlight any mandatory external account, ongoing payment, usage-limit risk or service feature that stops without renewal directly on the card. This information must NOT be hidden behind "More details".
- Add an optional "See full details" expansion with evidence, benchmarks, licence terms, migration considerations, pricing sources and plain-language definitions.
- Default recommendation may be "Best fit for your needs"; it must be derived from evidence and the customer's requirements, not TrillionAI's commission or revenue. Mark the reasoning in one sentence.
- Always show the *sum* of known estimated monthly obligations across chosen dependencies and separately note uncertain usage costs. Never call an app "free forever" when hosting/usage may cost money.
- Make the mobile UI readable without horizontal scrolling, maintain accessible text size and clear contrast, and make the selected choice easy to change.

### Minimal choice and acknowledgment
Present a concise summary immediately before authorising the build:

**"You chose [solution]. Pay now: [amount]. Possible ongoing costs: [amount or varies]. After launch, [customer/provider] pays and manages [service]. [Main limitation or risk]."**

Then a single unchecked affirmative acknowledgement:
**"I understand this choice and its possible ongoing costs."**

Controls: **"Agree & continue"** and **"Choose another option"**, plus **"Tell us what you need"** for natural-language changes. Refusing or changing the option must not trigger payment, consume generation credits or build automatically. The final pay/build confirmation is separate, with the same disclosed terms. Never bundle consent to unrelated marketing or vendor contracts.

### User tests required
- Non-technical users can identify what works, what costs now/later, who pays after launch, and the main trade-off without opening details.
- Show that text fits common iPhone widths and accessibility font sizes; no truncated fees or risks.
- Verify an option with an unknown API usage cost cannot be displayed as zero.
- Verify a mandatory external provider charge stays visible in collapsed cards.
- Verify the user can request an alternate solution in natural language and re-consent to revised terms.
- Verify no pre-checked boxes, provider defaults that silently incur charges, or build charges upon decline.


## Mandatory aftercare and deployment assistance — customer success contract

AppForge must not treat completed code generation as the end of the customer journey. Every successful build should open a persistent, tenant-isolated **My Product / Launch & Support** area with simple, task-driven help. This is a requirement for implementation, not a claim that these features are currently deployed.

### Launch readiness and handover
- Show "Your product is built. Here's how to get it running" in plain language with visible progress steps: Review product, Choose where to run it, Compare costs, Connect your accounts, Deploy, Check it works, Manage it.
- Provide a complete export package and reproducible deployment instructions; no fake success indicators, placeholder builds, undisclosed secrets, or implied deployment when nothing was deployed.
- Before deployment, show 2–3 **viable** hosting/deployment choices where possible (cost-effective/free tier where appropriate, value, and premium) and explain what each means for expected traffic, scaling, reliability, backups, region, data storage, maintenance, and any store/platform fees.
- Present **Pay today / Estimated monthly / Pay as you grow / Who bills you / What happens if you cancel** in brief, large, scannable fields; usage-based amounts are estimates, never promises.
- Disclose every active third-party dependency, account requirement, provider contact, customer-managed secret and expected running cost. Calculate an estimated combined monthly figure with assumptions and a visible notice for variable or unknown charges.
- Customer chooses and expressly approves their deployment route and any optional AppForge managed service subscription. Preserve portability: allow export and self-deployment without a surprise obligation to subscribe to AppForge hosting.
- When accounts or deployment approvals must be completed by the customer, show instructions tailored to their chosen path, with clear handoff. Never use TrillionAI's platform credentials in customer-exported products.
- After deployment, perform real verifiable checks where authorised (reachable URL, health, essential flows, configuration, selected integrations), report actual success/failure and actionable fixes; never falsely claim a live release.

### Context-aware AI aftercare assistant
- A visible **Ask AppForge** helper remains accessible in the customer's product workspace after builds; answers use the actual project version, agreed feature set, approved dependency manifest, deployment choice, and saved error reports, with tenant-specific access control.
- Support questions in everyday language: "How do I launch?", "What will I pay monthly?", "How do I update my app?", "Why isn't login working?", "How do I connect my domain?", "Can I move hosting?", "What happens if I cancel a provider?", "How do I publish to app stores?"
- Offer step-by-step instructions, screenshots/visual guidance where available, clickable checks, and safe recovery. Never make up progress, prices, support actions or success.
- The assistant can inspect only authorised project data and may suggest fixes, but changes to deployed code, credentials, domain records, spending or subscriptions require verified consent and safe approval controls. AI assistance must not autonomously incur provider charges.
- Clearly distinguish AppForge build-defect support and agreed included assistance from optional paid maintenance or third-party hosting support; show available support entitlements and an escalation path to human support for unresolved failures.
- The assistant must remain available via a defined support plan or durable self-service docs after the initial build. Publish support scope, hours/response expectations where applicable, and any limits **before purchase**. Never imply unlimited free human or AI usage.
- Use answer sources from project documentation and verified deployment status; identify uncertainty and provide corrective instructions. Protect customer data from cross-tenant leakage and prompt injection.
- Produce a downloadable project-specific "Ownership & Running Costs" summary and simple operation guide covering renewal dates, services, credentials ownership, backups, upgrade paths, export, cancellation and migration.

### UX: simple glanceable launch cards
- Top of workspace: **Built / Ready to launch / Live / Needs attention** only when backed by real state.
- Example summary: "Your app is ready. Choose where it runs. Hosting: estimated $X/month. You pay [provider]. No extra AppForge hosting fee unless you choose it." Use real quotes, never invented rates.
- Primary controls: **Compare hosting**, **Help me launch**, **Ask AppForge**, **Download my app**.
- Keep explanations short and nontechnical, with optional expandable details.
- Mobile-first accessibility, clear back/undo paths, no preselected paid options, and no surprise charges.

### Tests / acceptance
- Customer can see their complete build, export and deployment instructions without buying another unadvertised subscription.
- Provider prices and AppForge maintenance fees are separate; all recurring charges require positive informed consent.
- A "free" hosting selection never conceals domain, traffic, storage, AI API or store fees.
- Nontechnical tester can identify how to deploy and total estimated running costs at a glance.
- Help bot uses the correct customer and product, does not leak secrets, and cannot claim tests/deployments it did not execute.
- Deployment choice can change and does not create vendor lock-in beyond unavoidable disclosed provider constraints.
- Customer can obtain useful support after launch; when automated help cannot resolve a problem, a clear support escalation and scope are available.


## Full-lifecycle launch, operations and maintenance — owner-choice contract

**Goal:** Never leave a customer with an unusable build, unexplained release process or unmanageable recurring costs. Provide an accessible and supported path from validated build to live, maintained product. No claim of live deployment or maintenance until execution is verified. The customer chooses their level of operational responsibility; no forced AppForge-hosting subscription.

### Support pathways offered at handover (only show technically viable options)
- **Do it yourself:** portable source/export, project-specific deployment guide, provider checklist and self-service technical support, with honest included support limits.
- **Guide me step by step:** interactive launch coach that checks progress, explains choices and helps recover from errors; customer performs external account actions.
- **Deploy for me:** AppForge-managed, explicitly authorised deployment automation to the customer's own selected hosting/cloud accounts, after provider/account prerequisites are complete.
- **Managed operations (optional):** separately priced and opted-in TrillionAI hosting/monitoring/patching/backups/support, if actually available, with scope, service level, portability and cancellation terms.
- **Bring my own team/provider:** handover documentation, infrastructure templates, service inventory and permissions instructions for an independent developer, operations team or agency.
- **Move later:** documented migration/export paths and assistance choices; disclose portability restrictions before selection.

Different destinations may require additional paths: public website, API/backend, database, managed hosting, custom domain/TLS, progressive web app, Android, iOS/App Store, desktop application and approved game platforms. Display **only supported and relevant** destinations; explain external app-store review, identity verification and paid developer-account requirements. Never guarantee marketplace approval.

### Automatic deployment controls
1. Present destination options and verify the requested build can run on each one. Compare current verified provider pricing, free allowances, regions, scalability, operational effort, backups, support and billing arrangements.
2. Before any costs, show **Pay AppForge now**, **Pay provider now**, **Expected recurring costs**, **Who is billed**, **Who owns the account**, **Who maintains the service**, **Cancellation impact**, and an itemised total with explicit variable-cost uncertainty.
3. Customer chooses their deployment approach and target, creates/authorises their own provider account and explicitly accepts third-party terms and estimated charges. No preselected paid provider.
4. Automated deploy may use **short-lived scoped credentials or OAuth**, stored only in a secret manager; never embed TrillionAI keys in generated apps or publish customer credentials in source control/logs. Require cost ceilings and prohibit provisioning billable resources outside approved scope.
5. Show a preflight with dependencies, required secrets, migrations, backup/recovery plan, domain setup, certificate configuration, environment validation and a reversible deployment plan. If blocked, report what the customer needs to do in plain language.
6. Execute auditable steps only after approval: provision approved resources, build, test, migrate safely, release, configure domain/TLS, inspect health and essential user journeys, report real links and actual verification results. Do not call a deploy successful merely because a job ran.
7. On failure, surface error, impact, safe rollback or retry, owner actions and escalation. Never fabricate a live URL or successful store submission.
8. Completion requires clear **handover accepted** acknowledgement naming the customer's provider account and indicating which costs and operational duties they control from then onward. Handover cannot waive AppForge's pre-existing deliverable/warranty/support obligations or override statutory rights.
9. Third-party invoices should be billed directly to customer-owned accounts whenever possible. If a TrillionAI managed service is chosen, disclose recurring fees, usage boundaries, cancellation/migration procedures and separate AppForge build subscriptions.
10. After deployment, preserve build evidence, deployment recipes, service inventory, versions and nonsecret configuration so a customer can maintain or move their product.

### Ongoing care and guided maintenance
- A persistent **Product Health & Help** home shows verified status, deployed version, provider owners, renewal and resource-cost expectations, backups, update needs and next recommended tasks. Never show fake live telemetry.
- Explain routine tasks in simple steps: domain renewal, SSL certificates, security patches, dependency updates, database backups/restore, storage growth, API limits, app store renewals and releases, crash troubleshooting, user support, privacy/security maintenance and incident recovery.
- Offer choices: **Show me how**, **Guide me**, **Automate with approval** (only supported, scoped and paid as disclosed), or **Ask a human** (within clearly disclosed support terms). Maintenance automation requires explicit authority, budgets, logs, reversible actions and safe fallback.
- An AI aftercare assistant must be grounded in that customer's actual generated files, versions, deployment manifest, selected providers and verified telemetry, not generic unsupported guesses. The assistant should check permissions, minimise exposure of secrets, and escalate unresolved build defects and severe incidents. It cannot silently modify customer infrastructure or incur charges.
- Distinguish clearly between a **defect in the promised build** (appropriate AppForge remedy/support) and new feature work or third-party service failures (supported assistance options, possibly separately charged). Never automatically shift all responsibility to the customer.
- Keep a documented support path even if the customer's AppForge subscription ends, consistent with the original contract and consumer rights; do not remotely disable exported products solely to force renewal.
- Give a project-specific operations playbook with ownership, charges, backup and disaster recovery plans, release checklist, secure secret rotation, contact/escalation channels and migration instructions.

### Exception paths / no surprises
The experience must expressly handle: free-tier exhaustion and overage, cloud billing spikes, expired credentials, denied provider account verification, store rejection, DNS and TLS failures, deployment rollback, broken integrations, provider outage or shutdown, lost domain, expired licence, forgotten maintenance, compromised credentials, data restoration, scaling and performance problems, unsupported destination, and customer migration between providers. Each case must have a clear next action, responsible party, expected costs where knowable, and path to human help.

### Launch screen copy (example)
**Your product is built. Let's get it live.**
- **I'll launch it myself** — Export code and get a clear checklist.
- **Guide me through launch** — Interactive, step-by-step help.
- **Deploy it for me** — Authorise AppForge to deploy into **my** hosting account.
- **Manage it for me** — Optional ongoing service with separately disclosed pricing, when available.
Below: **Estimated monthly running costs: [itemised total/range]** · **Who pays: [customer/provider]** · **Need help? Ask AppForge**.
Never mark an option available if it is not implemented and tested.

### Acceptance tests
- A nontechnical customer can identify and complete a supported launch path, see who pays now and after handover, and access help when launch fails.
- Autonomous deployment cannot provision or bill without verified provider credentials, authority and budget approval; no secrets leak to frontend, export or logs.
- Each deployed artifact has verified URL/health checks or a truthful explanation of unverified requirements.
- Failed deploys have actionable diagnostics and retry/rollback; store-review delays are not called success.
- Customer can export and move to a different provider without a hidden AppForge hosting dependency.
- Maintenance guidance is project- and provider-specific, and unresolved issues provide clear escalation.
- Paid managed operations are separate opt-in products, never silently attached to a build.
- Customer's acceptance of operational handover doesn't erase agreed warranty, defect remedies or statutory rights.

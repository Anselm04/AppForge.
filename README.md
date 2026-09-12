# AppForge

> **Production direction:** describe a software product in plain language, let AppForge plan and build it with AI agents, validate the generated product, iterate on it, and export or deploy it — with reliable authentication, access control, billing, administration and production monitoring around the complete customer journey.

## Current status — September 2026

AppForge is an **active production-hardening project**. It is not being represented here as 100% production-proven.

The repository already contains substantial infrastructure: React + Express, Supabase authentication, PostgreSQL/Drizzle persistence, Stripe billing, AI build agents, validation, build streaming, project history, deployment/export paths, administrator tooling, God Codes, health probes, tests and CI/CD.

The current priority is **not adding more headline features**. It is proving and hardening the real customer golden path:

**Sign up → confirm/login → remain authenticated → receive the correct entitlement → describe a product → create a project → run the agent pipeline → validate the generated product → deploy/export it → test the result → iterate from feedback.**

Until that complete path is repeatedly demonstrated with real tester accounts and real generated products, AppForge should not be assessed as 100% production-ready.

## Current launch blockers

1. **Authentication reliability** — signup, confirmation, login, refresh and server-session handoff must work without users being bounced back to sign-in.
2. **Tester/admin access** — authorized testers must receive owner-issued access without being incorrectly forced into Stripe checkout.
3. **Entitlement consistency** — subscription, credits and God Code access must be interpreted consistently by project creation and build execution.
4. **Real build execution** — a normal-language request must create a project and start the actual multi-agent pipeline.
5. **Validation quality** — generated products must be compiled/tested as deeply as their target stack permits and failures must be surfaced.
6. **Deployment proof** — successful builds must reach a usable preview/export/deployment destination.
7. **Tester feedback loop** — testers must be able to use what AppForge produced and judge it against what they requested.
8. **Production observability** — authentication, projects, builds, agent runs, deployments and critical dependencies must be measurable.

These are launch blockers, not optional polish.

---

## Product goal

AppForge is being built to let people worldwide turn an idea into a working digital product without manually assembling the entire software-development toolchain.

The intended journey is:

1. Describe the product in normal language.
2. Select or let AppForge determine an appropriate technology stack and capabilities.
3. Have specialized AI agents plan, implement, review, test and improve it.
4. Watch build progress and receive understandable failures instead of silent errors.
5. Preview and inspect the generated product.
6. Iterate with the Senior Dev Agent and future automated improvement workflows.
7. Export to source control or deploy to supported hosting targets.
8. Configure external credentials, databases, billing and services required by the generated product.
9. Test the deployed product as a real customer would.
10. Continue improving it from real feedback.

This is the **direction and acceptance target**, not a claim that every supported stack already completes every step autonomously.

---

## Real production architecture

| Layer | Current role |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, React Router |
| API | Express 4, tRPC v11, Zod |
| Authentication | Supabase Auth plus AppForge server-side authenticated request/session handling |
| Application data | PostgreSQL + Drizzle ORM |
| Billing | Stripe subscriptions, webhooks, billing portal and credit packs |
| AI generation | OpenAI-compatible model endpoint used by AppForge agents |
| Build execution | Multi-agent pipeline with SSE progress streaming and optional Redis fan-out |
| Validation | Sandbox validation, tests/build checks where supported, review and retry logic |
| Deployment/export | Preview, ZIP, Vercel, Netlify, Fly.io, GitHub Pages and GitHub repository paths where configured |
| Full production hosting | Fly.io runs the complete AppForge API/build/SSE path |
| Observability | Health probes, structured logging, optional Sentry and production monitoring |
| CI/CD | GitHub Actions for lint/format, type checking, tests, security, build and deployment gates |

### Supabase and AppForge data

Supabase is production-critical for authentication and connected production data. A successful Supabase login alone is **not proof that a customer can use AppForge**. Production acceptance includes the complete bridge from authenticated identity to AppForge entitlement, project creation, build execution and deployment activity.

**Authentication traffic is not the same as successful AppForge product usage.**

---

## Customer golden path

This is the primary readiness benchmark:

| Stage | Required production behaviour |
| --- | --- |
| Account creation | User can create an account and receives clear confirmation/error feedback |
| Authentication | User can log in and remain logged in across normal navigation/refresh |
| AppForge identity | Authenticated identity resolves to the correct AppForge user/session |
| Access | Subscription, tester grant or God Code entitlement is recognized before build gating |
| Prompt | User can describe the product they want |
| Project | AppForge creates the project successfully |
| Build | The multi-agent pipeline actually starts and reports progress |
| Validation | Generated files are checked and failures are visible/actionable |
| Completion | Generated files and project state are persisted |
| Deployment/export | User can obtain or deploy the generated product |
| Customer test | The result can be tested against the original request |
| Iteration | Feedback can drive another improvement cycle |

A green CI build alone does **not** prove this journey. Real browser/customer-path testing is required.

---

## Tester access and God Codes

AppForge includes owner/admin tooling for issuing **God Codes** so approved testers can receive access without purchasing a normal subscription.

Current code supports:

- lifetime/unlimited access grants;
- limited credit grants;
- one-time redemption controls;
- administrator management through the protected `/admin` surface.

### Direction being hardened

The admin access system is intended to support:

- lifetime access;
- monthly or multi-month tester access;
- custom expiry dates;
- fixed-credit grants where appropriate;
- clear user/access status in the administrator dashboard;
- safe revocation/expiry behaviour;
- auditability of who received and redeemed access.

**Time-limited access is work in progress until implemented and production-tested.** Do not infer it is already complete merely because lifetime God Codes exist.

Tester entitlements must bypass the appropriate payment/build gates only for the authorized account and duration. They are not a global billing bypass.

---

## Primary application routes

| Purpose | Route |
| --- | --- |
| Sign up | `/signup` |
| Login | `/login` |
| Describe/start a build | `/` |
| Watch a build | `/build/:projectId` |
| Projects/account | `/dashboard` |
| Improve an existing project | `/ai-builder` |
| Pricing/billing | `/pricing` |
| Redeem an owner-issued code | `/redeem` |
| Owner administration | `/admin` |
| Graphics editor | `/editor` |

The canonical new-build path is **Home → project creation → `/build/:projectId`**. Legacy generation endpoints and auxiliary experiments should not be used to judge the production path unless they are explicitly part of this flow.

---

## Multi-agent build pipeline

The production build path is driven from `src/agents/pipeline.ts` and `src/routes/build.ts`.

Its responsibilities include:

1. **Planning** — turn the user's request into an implementation plan.
2. **Coding** — generate project source files.
3. **Validation** — execute supported compile/test/build checks in a sandbox.
4. **Repair/retry** — feed validation failures back into generation where supported.
5. **Review** — inspect generated output and produce quality feedback.
6. **Testing support** — generate/add tests where applicable.
7. **Scaffolding** — merge required baseline project files.
8. **Persistence/snapshots** — retain generated state for history and iteration.
9. **Deployment/export** — hand a completed project to a configured destination.

### Validation is stack-dependent

AppForge exposes web, mobile, game, agent, extension, bot and service targets. They do **not** all currently receive identical runtime validation.

Node/Vite-compatible targets can receive deeper automated compile/test/build validation. Flutter, native/mobile, game-engine, Python and other specialized targets may require structural checks and external/native toolchains before they can be considered fully proven.

Therefore the existence of a stack option is **not** a guarantee that AppForge can already produce a production-ready application for that stack without human review.

---

## Deployment and export

Configured projects can use supported paths including signed/live preview, ZIP export, Vercel, Netlify, Fly.io, GitHub Pages and GitHub repository export.

Each destination depends on its required production credentials and target-specific configuration. A generated product may also require its own environment variables, database, API keys, domains, payment configuration or third-party services.

**Deployment success means the generated artifact reached its target and passed the checks available for that target. It does not mean every business workflow inside the generated application has automatically been proven.**

---

## Billing and credits

AppForge contains Stripe-based subscription and credit infrastructure. Current commercial pricing and allowances should be read from production code/configuration and Stripe rather than treating this README as an immutable price sheet.

Build and Senior Dev operations can consume credits. Lifetime/unlimited entitlements bypass applicable balance checks. Production hardening must ensure every relevant endpoint interprets the same entitlement consistently so a tester is not accepted by one screen and rejected by another.

---

## Administrator dashboard

The `/admin` surface is owner-only and is intended to become AppForge's operational control centre.

The production direction includes user/account visibility, tester and entitlement management, God Code management, lifetime/time-limited access, subscription/access status, project/build status, deployment failures, analytics, moderation/security operations and production-health signals.

A feature appearing in this direction describes the **target operating model** unless it is explicitly implemented and verified in code/tests.

---

## Production-readiness rules

When auditing AppForge, do **not** derive a readiness percentage from feature names in this README.

### Count as verified when appropriate evidence exists

- Code exists on the production branch.
- Required production configuration is present.
- Relevant CI/test gates pass.
- Production deployment succeeds.
- Runtime health checks pass.
- For customer-facing features, the real browser/customer path succeeds.

### Do not count as verified merely because

- this README says a feature exists;
- a route/component/file exists;
- a mocked test passes while production dependencies are absent;
- a deployment job is skipped;
- a static client deployment is green while the Express/SSE builder is broken;
- Supabase Auth contains users but they cannot create projects/builds;
- generated files exist but have not passed applicable validation;
- a deployment URL exists but the generated application has not been tested.

### Evidence labels

Use these labels when assessing the repository:

- **Implemented** — code exists.
- **Configured** — required production configuration is present.
- **CI verified** — automated repository gates pass.
- **Runtime verified** — deployed service/probe works.
- **Golden-path verified** — a real user completes the customer journey.
- **Production-proven** — repeated real usage succeeds with monitoring and recoverable failure behaviour.

This prevents README wording from artificially raising or lowering an assessment score.

---

## Immediate production-hardening work

The current workstream is deliberately narrow:

- eliminate signup/login/session bounce failures;
- synchronize authenticated users with AppForge identity and entitlements;
- make authorized tester access reliable without unwanted Stripe blocking;
- finish flexible admin-issued access durations;
- prove prompt → project → build → validation → deployment end to end;
- verify generated products from the tester/customer perspective;
- keep CI/release gates green;
- monitor Supabase/database/auth and deployment-critical dependencies;
- improve diagnostics so a failed customer action has a traceable cause.

---

## Security principles

- Never expose Supabase service-role credentials, Stripe secret keys, deployment tokens or LLM secrets to the browser.
- Verify protected operations server-side.
- Keep admin access owner/authorized-admin only.
- Keep God Codes controlled, auditable and scoped to the intended entitlement.
- Never give generated applications AppForge production secrets automatically.
- Monitoring does not replace authorization.

---

## Local development

Prerequisites include Node.js 20+, npm, PostgreSQL/Supabase configuration and an OpenAI-compatible model credential for real AI builds. Stripe/deployment credentials are required for the production capabilities being exercised.

```bash
git clone https://github.com/Anselm04/AppForge.git
cd AppForge
npm install
cp .env.example .env

npm run validate-env -- --strict
npm run build
npm start
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

See `.env.example`, deployment configuration and GitHub Actions workflows for current environment requirements. Never commit production secrets to documentation.

---

## Production hosting

The full AppForge application requires its Express API/build server and SSE/runtime behaviour. The current architecture uses **Fly.io** for that full application path.

A successful static-client deployment elsewhere must not be treated as proof that AppForge's server-side builder, authentication bridge, build stream or deployment services are healthy.

---

## What AppForge is not claiming yet

AppForge is **not currently claiming** that:

- every supported stack produces flawless production software;
- every generated product deploys without target-specific configuration;
- AI-generated code never requires human review;
- all customer golden-path issues have been eliminated;
- the administrator access-duration system is fully complete;
- every generated product has been tested by real customers;
- the platform is 100% production-proven.

Those statements should change only when production evidence supports them.

---

## Assessment guidance

**For automated or human assessments:** treat this README as a map of architecture, direction, acceptance criteria and known hardening work — **not as proof of completion**.

For a true readiness assessment, inspect in this order:

1. current production commit;
2. latest GitHub CI/security/release results;
3. production deployment result;
4. runtime health/readiness probes;
5. Supabase/database/authentication health;
6. current entitlement/billing behaviour;
7. real signup/login/session test;
8. real tester God Code/access test;
9. real prompt/project/build run;
10. generated-product validation and deployment;
11. tester/customer verification of the deployed result.

If a required stage fails, report that failure explicitly rather than averaging it away because unrelated features exist.

---

## Next milestone

> **A real tester can create an account, receive authorized access, describe a product, have AppForge build it, deploy/export it, use the result, and give meaningful feedback without manual database intervention or being incorrectly blocked by authentication or billing.**

That milestone — not the number of files, routes, agents or advertised stacks — is the current definition of progress.

AppForge's destination is a dependable TrillionAi Tech product-building platform that can take a user from **idea to tested, deployable digital product** while keeping access, billing, security, observability and administration reliable enough for real customers.

---

## License

MIT

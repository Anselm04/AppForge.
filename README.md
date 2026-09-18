# AppForge

> **Describe a digital product. AppForge plans it, builds it, validates it, deploys it, verifies the result, and keeps improving it.**

AppForge is the autonomous AI product-building platform being developed by **TrillionAi Tech**. Its purpose is to turn a plain-language product idea into a real, testable, deployable software product through one coordinated system of specialist AI agents, build infrastructure, validation, deployment, security, billing, observability, and operational tooling.

AppForge is not intended to be a prompt-to-code demo. The engineering target is a **production-grade product factory** that can create, test, repair, deploy, verify, and iteratively improve software while preserving source code, project history, customer entitlements, operational evidence, and deployment state.

The long-term objective is simple:

> **Idea → plan → build → test → repair → deploy → verify → improve → operate.**

---

## Production-readiness mission

AppForge is being hardened toward **100% production readiness**, meaning success is not defined by whether AI produced files or whether a build command happened to exit successfully.

A production-ready AppForge journey must prove, end to end, that:

1. authentication and account flows work;
2. customer entitlements, subscriptions, credits, and approved access work;
3. a user can create a real project from a plain-language request;
4. the agent pipeline plans and generates the project;
5. generated source files are persisted correctly;
6. the appropriate validation mode runs for the selected stack;
7. full-validation projects execute a **blocking generated-test gate**;
8. failed validation blocks production certification;
9. production builds can boot and answer health checks;
10. deployment produces a reachable product;
11. required customer-visible behaviour exists in the deployed artifact;
12. authenticated edits persist and can be redeployed;
13. CI, security, preview, and release gates fail closed when evidence is missing;
14. recovery, rollback, monitoring, and operational diagnostics are available;
15. no production secret is exposed to generated projects, browsers, logs, or repositories.

A green build alone is not enough. AppForge is being engineered to require **evidence of working customer behaviour** before a release or generated product is treated as successfully certified.

---

## What AppForge is designed to build

AppForge is intended to support multiple product families rather than one fixed website template.

### Web and SaaS

- React/Vite applications
- Next.js and Astro-oriented projects
- dashboards and admin portals
- subscription SaaS products
- e-commerce and business applications
- APIs and backend services
- data-driven products
- browser extensions and web tooling

### Mobile and cross-platform

- Flutter-oriented projects
- React Native / Expo projects
- hybrid Capacitor/Ionic-style applications

Native mobile release still requires the relevant Apple/Google SDKs, signing, store credentials, and platform verification. Structural generation is not treated as equivalent to a verified native-store build.

### Desktop

- Electron-oriented products
- Tauri-oriented products

### Games and interactive software

- Phaser
- Three.js
- Babylon.js
- game-oriented scaffolding and export paths for additional engines/toolchains

### AI, agents, bots, and automation

- AI applications
- autonomous and semi-autonomous agents
- multi-agent products
- workflow automation
- API integrations
- browser automation
- Discord, Telegram, Slack, and specialist bot-oriented products

Different stacks require different validation and deployment evidence. AppForge must report those differences honestly rather than pretending every technology can be certified by the same checks.

---

## Customer journey

A customer should be able to:

1. create an account and sign in securely;
2. describe the product they want in normal language;
3. choose or accept a recommended technology stack;
4. select capabilities such as authentication, database, billing, AI, analytics, administration, and integrations;
5. let AppForge convert the request into architecture and development tasks;
6. generate the required source files and project structure;
7. run automated tests, compilation, security checks, build validation, and repair cycles;
8. watch build progress through the application rather than waiting behind a silent generation screen;
9. inspect the generated files and preview the product;
10. deploy through an approved deployment target;
11. open and verify the deployed result;
12. apply authenticated edits through the Senior Dev workflow;
13. revalidate and redeploy the changed project;
14. export or push source code to GitHub;
15. return later and continue improving the same project.

The desired experience is one continuous product-development lifecycle instead of a collection of disconnected AI prompts.

---

## Multi-agent development system

AppForge coordinates specialist responsibilities instead of relying on one undifferentiated generation request.

| Responsibility | Role |
| --- | --- |
| Planning | Convert customer intent into architecture and executable development tasks |
| Coding | Generate and modify project source files |
| Testing | Generate tests appropriate to the project and stack |
| Validation | Install, compile, type-check, test, and build where the stack permits |
| Auto-repair | Feed concrete failures back into controlled corrective cycles |
| Review | Inspect implementation quality and integration consistency |
| Security | Detect unsafe patterns and enforce platform boundaries |
| Accessibility | Identify relevant accessibility issues |
| Performance | Detect avoidable performance problems |
| Senior development | Improve and repair existing generated projects |
| Deployment | Deliver validated projects to configured destinations |
| Production verification | Prove the deployed result is actually reachable and behaves as required |
| Monitoring | Surface operational failures with actionable evidence |

The design goal is increasing autonomy without surrendering control of credentials, billing, privileged administration, production releases, or destructive actions.

---

## Generated-app validation

AppForge uses stack-aware validation rather than one universal success check.

For supported full-validation projects, the intended invariant is:

> **generate → attach tests → install declared dependencies → run blocking tests → compile/build → deploy → verify live behaviour**

Full-validation builds must not be certified when their generated tests cannot load, cannot run, or fail.

The generated Vitest harness explicitly declares its required test tooling, including Vite, the React Vite plugin, Vitest, jsdom, and Testing Library dependencies. Generated manifests are normalized before those dependencies are written so malformed dependency containers cannot silently omit required packages.

Structural-only stacks must be reported as structural validation. They must not be presented as though native/runtime verification occurred when the required external toolchain was unavailable.

---

## Production certification

AppForge's production proof path is designed to fail closed.

A production canary verifies evidence such as:

- authenticated access;
- valid customer entitlement;
- real project creation;
- automatic build start;
- agent completion;
- generated files persisted to the project;
- validation passed;
- blocking generated tests were required where applicable;
- generated test files exist;
- the deployed product responds successfully;
- required customer-visible content exists in the deployed artifact;
- an authenticated edit changes the generated project;
- the edited files remain persisted;
- redeployment succeeds;
- the edited customer-visible result is present after redeployment.

Production CI also verifies that the compiled AppForge server can boot and answer its liveness endpoint before that SHA is considered release-ready.

---

## Senior Dev workflow

The Senior Dev workflow exists to continue development of an already-created project.

A user can request a repair, feature, design change, or improvement. AppForge should analyse the existing project and make a targeted change instead of unnecessarily regenerating the entire product.

The expected cycle is:

> **inspect existing project → plan change → modify relevant files → validate → test → persist → redeploy when requested**

---

## Authentication, authorization, and identity

AppForge uses **Supabase Auth** as a core identity provider.

The production identity boundary includes:

- sign-up and sign-in;
- email/password authentication;
- session refresh and persistence;
- account recovery;
- logout/revocation;
- authenticated API requests;
- project ownership enforcement;
- protected build and deployment actions;
- protected administrator operations;
- linkage between authenticated users and AppForge project/billing records.

Authentication is not considered complete unless the same identity is recognized consistently across customer UI, APIs, project operations, billing, and administrative controls.

---

## Billing, credits, and controlled access

AppForge supports Stripe-backed commercial access together with owner-authorized access mechanisms.

The platform is designed to support:

- subscription tiers;
- build credits;
- one-time credit purchases;
- Stripe Checkout;
- Stripe Customer Portal;
- verified Stripe webhooks;
- approved unlimited/lifetime access;
- time-limited tester or partner access;
- owner-issued access codes;
- entitlement visibility in administration tooling.

Entitlement checks must be enforced consistently so valid customers and approved testers are neither blocked incorrectly nor allowed to bypass required access controls.

---

## Administrator command centre

The private administrator surface is intended to provide operational visibility and controlled actions for:

- users;
- subscriptions;
- entitlements;
- credit balances and grants;
- approved access codes;
- projects;
- builds;
- agent activity;
- deployments;
- failed or paused work;
- revenue and product analytics;
- security/moderation signals;
- platform health;
- critical integration health.

Administrative functionality must remain separate from normal customer permissions.

---

## Core production services

| Layer | Current architecture / responsibility |
| --- | --- |
| Customer UI | React 18, Vite, Tailwind CSS, TanStack Query, React Router |
| API | Express 4, tRPC v11, Zod |
| Authentication | Supabase Auth |
| Data | PostgreSQL + Drizzle ORM |
| Billing | Stripe |
| AI generation | OpenAI-compatible model infrastructure |
| Agent pipeline | Planner, coding, testing, validation, review, repair, and improvement responsibilities |
| Build transport | Server-Sent Events with scalable fan-out support |
| Validation | Stack-aware compile/test/build and structural validation |
| Source control | GitHub integration |
| Deployment | Preview/export paths plus Vercel, Netlify, Fly.io, GitHub-oriented deployment paths |
| Analytics | PostHog-compatible product analytics |
| Observability | Health checks, structured diagnostics, Sentry/Datadog-compatible monitoring |
| Automation | Make-compatible workflow integration |
| Support | BubblaV/customer-support integration architecture |
| CI/CD | GitHub Actions |

The complete AppForge production service requires its API, build pipeline, persistence, streaming runtime, authentication, and deployment infrastructure. A static frontend alone is not AppForge.

---

## Security invariants

The following rules are non-negotiable:

- production secrets remain server-side;
- Supabase service-role credentials are never exposed to the browser;
- Stripe secret keys and webhook secrets remain protected;
- deployment credentials remain protected;
- model-provider credentials remain protected;
- privileged operations require authorization;
- users may access only projects they are authorized to access;
- generated products do not inherit AppForge production secrets;
- access codes and administrative grants are auditable;
- failed security checks block the relevant release path;
- generated or third-party content is never automatically trusted as executable instruction.

---

## Reliability, recovery, and observability

AppForge is intended to be operated as a real production system.

Production reliability work covers:

- application availability;
- production server boot/liveness;
- Supabase/database connectivity;
- authentication flows;
- billing/webhook health;
- project creation;
- agent and model failures;
- generated-app validation;
- deployment failures;
- customer-flow verification;
- security scanning;
- CI/release health;
- capacity and infrastructure drift;
- recovery evidence and known-good SHAs.

Recovery documentation and production proof are treated as part of the product, not an afterthought.

---

## External review and AI tooling policy

AppForge may use external tools such as CodeRabbit to provide **independent review signals**.

For this repository, external AI review should be treated as **advisory evidence**, not authority to rewrite architecture blindly.

The working rule is:

> **Review broadly. Verify findings against the complete repository. Make minimal fixes. Preserve current production behaviour. Re-run CI and production proof.**

A pull-request review covers the pull-request diff and whatever repository context the reviewer loads. It is not automatically equivalent to a full repository audit.

Any repository-wide audit must inspect the complete codebase, configuration, workflows, tests, security boundaries, deployment paths, generated code, database/auth/billing behaviour, recovery documentation, and production customer journey.

---

## Definition of 100% production ready

For AppForge, **100% production ready** means there are no known unresolved release-blocking defects in the customer-critical path and that the current production candidate has objective evidence for:

- authentication and authorization;
- billing and entitlements;
- project creation;
- autonomous agent execution;
- generated source persistence;
- blocking validation/tests for supported full-validation stacks;
- secure build execution;
- deployment;
- live product verification;
- authenticated edits and redeployment;
- security scanning;
- secrets handling;
- CI/release gates;
- production health checks;
- observability;
- disaster recovery;
- data integrity;
- integration failure handling;
- documented rollback/recovery behaviour.

It does **not** mean every possible future feature has been built. It means the functionality AppForge currently claims as production functionality is verified, secure, observable, recoverable, and safe to operate for real customers.

---

## CI and release discipline

A change should not be merged simply because GitHub says the branch is technically mergeable.

Release decisions must consider the relevant evidence, including:

- lint;
- TypeScript checks;
- automated tests;
- generated-app validation contracts;
- production build;
- production server liveness;
- security scanning;
- deployment preview;
- customer-flow contracts;
- production canary where required;
- branch/review requirements.

Merge conflicts must be reconciled deliberately so newer production hardening is not silently discarded.

---

## Developer setup

### Requirements

- **Node.js 22 or newer**
- npm 10.x
- PostgreSQL/Supabase configuration
- an OpenAI-compatible model credential for AI build functionality
- the appropriate credentials for any billing/deployment integrations being exercised

### Install

```bash
git clone https://github.com/Anselm04/AppForge..git
cd AppForge.
npm install
cp .env.example .env
```

Validate environment and build:

```bash
npm run validate-env -- --strict
npm run typecheck
npm run test
npm run build
npm start
```

Primary quality commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Production secrets must never be committed to the repository, documentation, generated applications, or test fixtures.

---

## Current engineering priority

The immediate priority is not adding random features. It is to complete and verify the customer-critical production path, close remaining reliability/security gaps, and make AppForge safe for real users.

Work should therefore prioritize, in order:

1. release-blocking correctness and security;
2. authentication, billing, entitlements, and data integrity;
3. generated build → test → deploy → verify reliability;
4. production CI and recovery proof;
5. autonomous agent correctness and generated-product quality;
6. live customer-flow verification;
7. observability and operational recovery;
8. integrations and enterprise controls;
9. visual editing, collaboration, mobile/game depth, and ecosystem expansion.

This ordering exists to prevent feature expansion from hiding unresolved production risk.

---

## AppForge vision

AppForge is intended to become the core autonomous product-building engine for **TrillionAi Tech**: a system capable of coordinating the technical work required to turn an idea into a serious digital product and continue operating and improving that product after launch.

For customers, the goal is to remove unnecessary technical barriers without hiding the truth about validation, deployment, or platform-specific requirements.

For developers and businesses, AppForge is intended to become an AI development workforce and orchestration layer that can repeatedly plan, build, test, repair, deploy, verify, and maintain software with strong operational controls.

For TrillionAi Tech, AppForge is the foundation for building and operating future products at scale with centralized administration, billing, security, analytics, observability, integrations, and recovery.

> **The standard is not “AI generated code.” The standard is “the product actually works.”**

---

## License

MIT

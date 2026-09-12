# AppForge

> **From an idea to a working, tested and deployable digital product — through one AI-powered product-building platform.**

AppForge is the AI product builder from **TrillionAi Tech**. A user describes what they want to create in normal language and AppForge coordinates specialized AI agents, development infrastructure, validation, deployment services and business integrations to turn that request into a usable digital product.

AppForge is designed for people who want to create software without manually assembling a development team or mastering every framework, cloud service and deployment tool themselves. It supports professional developers as well by automating planning, scaffolding, implementation, testing, review, deployment and iterative improvement.

---

## What AppForge does

A customer can use AppForge to:

1. Create an account and securely sign in.
2. Describe an app, website, game, AI agent, automation, API, extension, bot, desktop product or mobile product in plain language.
3. Choose a technology stack or let AppForge guide the product configuration.
4. Select capabilities such as authentication, databases, subscriptions, payments, analytics, AI, administration and integrations.
5. Have AppForge's AI development agents create an architecture and implementation plan.
6. Generate the application's source code and supporting project files.
7. Run automated validation, tests, security checks and repair cycles appropriate to the selected stack.
8. Watch the build progress rather than waiting behind a silent generation screen.
9. Preview and inspect the generated product.
10. Ask the Senior Dev Agent to improve, repair or extend the product.
11. Export the source code or push it to GitHub.
12. Deploy through supported hosting targets.
13. Test the deployed result as an actual user would.
14. Continue iterating until the product meets the required outcome.

The intended experience is **idea → plan → build → validate → deploy → test → improve**, from one AppForge workspace.

---

## Complete customer journey

### 1. Account and workspace

Users create an AppForge account through Supabase Auth. AppForge maintains the authenticated application session and connects that identity to the user's projects, access entitlement, credits, subscription and build history.

The user's dashboard provides a central place to return to projects, monitor builds, view access/usage, improve existing products and launch new work.

### 2. Describe the product

The customer explains what they want in normal language. The request can include the purpose, users, features, design requirements, business model, integrations and target platforms.

AppForge turns that product description into structured work for its development pipeline rather than requiring the customer to write a technical specification first.

### 3. Configure capabilities

AppForge supports a broad product catalogue including:

- web applications and websites;
- SaaS products;
- e-commerce and subscription products;
- APIs and backend services;
- AI tools and AI agents;
- automation products;
- dashboards and analytics applications;
- browser extensions;
- bots and integrations;
- desktop applications;
- mobile applications;
- web and game-oriented projects;
- data-driven applications.

Products can include capabilities such as authentication, databases, payments, subscriptions, administration, analytics, AI generation, external APIs and deployment infrastructure.

### 4. AI planning

The Planner Agent analyses the request and creates an implementation architecture. It identifies the major modules, responsibilities and development tasks required to produce the product.

### 5. AI implementation

Coder agents generate the source files required by the plan. AppForge combines generated implementation with stack-specific scaffolding and supporting project files so the result is a structured software project rather than a single code response.

### 6. Automated validation and repair

AppForge validates generated output with the deepest checks available for the target stack. For supported Node/Vite-style projects this can include dependency installation, TypeScript compilation, automated tests and production builds.

Validation failures are fed back into repair cycles so AppForge can correct problems before presenting the build as complete. Specialized stacks can use structural validation and their appropriate external/native toolchains.

### 7. Review and quality agents

The pipeline includes automated review and testing responsibilities covering generated code quality, functionality, security concerns, accessibility, performance and implementation consistency.

The purpose is not simply to generate code quickly; it is to progressively move generated output toward software that can actually be used and tested.

### 8. Build history and snapshots

Projects retain generated files and build state so users can return to previous work, inspect results and continue improving a product instead of starting from scratch every time.

### 9. Senior Dev Agent

The Senior Dev Agent works on an existing AppForge project. A user can explain what should change, what failed during testing or what new feature is required.

It can analyse the existing generated project, plan the change, modify the relevant files, validate the result and continue the product's development cycle.

### 10. Deployment and export

AppForge provides deployment/export paths including:

- live/hosted previews;
- downloadable project archives;
- GitHub repository export;
- Vercel;
- Netlify;
- Fly.io;
- GitHub Pages;
- additional deployment integrations as the platform expands.

Generated products retain their own environment and service requirements. AppForge guides or automates the deployment workflow without exposing AppForge's own production secrets to generated applications.

### 11. Real product testing

Deployment is not the end of the workflow. The generated product is intended to be opened and used like a real customer product. Users and authorized testers can check whether the requested features, flows and business behaviour actually work.

Feedback can then be returned to AppForge for another improvement cycle.

---

## AI development system

AppForge coordinates specialized AI responsibilities rather than relying on one undifferentiated generation request.

The platform's development system includes responsibilities for:

| Capability | Role inside AppForge |
| --- | --- |
| Planning | Convert a product idea into architecture and development tasks |
| Coding | Generate and modify application source files |
| Validation | Compile, test and build generated projects where the stack permits |
| Auto-repair | Feed failures back into corrective generation cycles |
| Review | Inspect implementation quality and identify problems |
| Testing | Create and execute appropriate automated tests |
| Security | Detect common unsafe patterns and protect the AppForge platform |
| Accessibility | Check relevant UI/accessibility concerns |
| Performance | Identify avoidable performance problems |
| Senior development | Improve, repair and extend existing generated projects |
| Deployment | Package and deliver successful builds to configured destinations |
| Monitoring | Surface production and build failures instead of hiding them |

The system is designed to become increasingly autonomous while keeping important customer actions, credentials, billing and deployment permissions under controlled authorization.

---

## Supported technology families

AppForge is designed to build across multiple product families rather than being limited to one website template.

### Web

React, Vue, Svelte, Next.js, Angular, Remix, Astro, vanilla web applications and combinations with Node, Python, Django and Supabase-backed services.

### Mobile

React Native/Expo, Flutter-oriented projects, Firebase-backed mobile products and hybrid Capacitor/Ionic applications.

### Desktop

Electron and Tauri-oriented desktop products.

### Games and interactive products

Phaser, Three.js, Babylon.js and export/scaffolding paths for additional game-oriented technologies such as Unity and Godot web targets.

### AI and agents

AI tools, OpenAI-compatible applications, Python and Node AI agents, LangChain-oriented tools, CrewAI-style agents and multi-agent products.

### Automation, bots and specialist products

Browser automation, web scraping, data visualization, API services, serverless products, browser extensions, VS Code extensions, Discord bots, Telegram bots and Slack-oriented products.

Validation and deployment methods are adapted to the target technology rather than pretending every stack has the same runtime requirements.

---

## Authentication and identity

AppForge uses **Supabase Auth** as a core identity service.

The production authentication system is designed to provide:

- account creation;
- email/password authentication;
- confirmation and recovery flows;
- secure authenticated server requests;
- session refresh and persistence;
- logout/revocation;
- protected project access;
- protected build/deployment actions;
- owner/admin authorization;
- linkage between the authenticated identity and AppForge's application records.

A logged-in identity is consistently recognized across the dashboard, project creation, build pipeline, billing and administration surfaces.

---

## Subscriptions, credits and access

AppForge supports commercial access through Stripe-based subscriptions and credit infrastructure while also providing controlled owner-issued access for testing, partnerships, promotions and internal operations.

The access system supports the business model through:

- free/trial usage where configured;
- paid subscription tiers;
- build credits;
- one-time credit purchases;
- Stripe Checkout;
- Stripe Customer Portal;
- verified Stripe webhooks;
- unlimited/lifetime access;
- owner-issued access codes;
- time-limited tester or promotional access;
- custom access expiry;
- entitlement visibility from the administrator dashboard.

Entitlement is enforced consistently throughout AppForge so an authorized tester or lifetime user is not incorrectly redirected to payment during an approved build.

---

## God Codes and controlled access

The AppForge owner/admin can create secure access codes for approved users.

God Codes can be used for:

- lifetime unlimited access;
- monthly access;
- multi-month access;
- custom-duration access;
- tester access;
- promotional/partner access;
- controlled credit grants.

Codes are intended to be one-time redeemable, auditable and linked to the resulting entitlement. Expiry and revocation are handled without weakening normal customer billing or administrator security.

This gives TrillionAi Tech a practical way to onboard beta testers, reviewers, partners and selected customers without forcing those users through normal subscription payment.

---

## Administrator command centre

The private AppForge administrator dashboard is the operational control centre for the platform.

It provides or is designed to provide unified visibility and control over:

- registered users;
- user access status;
- subscriptions and tiers;
- credit balances and grants;
- God Code creation and redemption;
- lifetime and time-limited access;
- tester accounts;
- projects;
- active and completed builds;
- failed/paused builds;
- agent activity;
- deployment status;
- platform usage;
- revenue/business analytics;
- moderation and security signals;
- production health;
- critical integration status.

Administrative actions remain protected and are never exposed as ordinary customer functionality.

---

## Production data and Supabase

Supabase is a production-critical part of the AppForge platform. It provides authentication and connected production data infrastructure used to support real users and real application activity.

Normal AppForge usage generates meaningful platform activity through account authentication, projects, builds, agent operations, entitlement changes and other product workflows.

The objective is genuine customer usage — not artificial keep-alive traffic.

---

## Integrations and platform services

AppForge is being designed as an extensible product-building platform rather than a closed generator.

Its broader integration architecture includes roles for services such as:

- **Supabase** — authentication, PostgreSQL/data services and scalable backend infrastructure;
- **Stripe** — subscriptions, checkout, credit purchases and billing lifecycle;
- **GitHub** — source repositories, export, version control and development workflows;
- **Fly.io / isolated execution infrastructure** — production hosting and safe execution environments where configured;
- **Vercel** — supported generated-product deployment and frontend deployment workflows;
- **Netlify** — supported generated-product deployment;
- **Make** — external workflow and application automation;
- **BubblaV AI Chatbot** — customer support, onboarding, FAQs and escalation;
- **Datadog** — production telemetry, diagnostics and operational monitoring;
- **PostHog** — product analytics, funnels, feature usage and customer behaviour;
- additional AI, automation, deployment, observability and business integrations as AppForge expands.

Integrations are activated only when their credentials and production configuration are present.

---

## Production architecture

| Layer | Technology / responsibility |
| --- | --- |
| Customer UI | React 18, Vite, Tailwind CSS, TanStack Query, React Router |
| API | Express 4, tRPC v11, Zod |
| Authentication | Supabase Auth |
| Application database | PostgreSQL + Drizzle ORM |
| Billing | Stripe |
| AI generation | OpenAI-compatible model infrastructure |
| Agent pipeline | Planner, coding, validation, review, testing and improvement responsibilities |
| Build transport | Server-Sent Events with scalable fan-out support |
| Validation | Sandboxed compile/test/build and stack-specific checks |
| Source control | GitHub integration |
| Deployment | Preview, ZIP, Vercel, Netlify, Fly.io, GitHub paths |
| Analytics | PostHog-compatible product analytics architecture |
| Observability | Health probes, structured logging, Sentry/Datadog-compatible monitoring |
| Automation | Make and additional workflow integrations |
| Support | BubblaV/customer-support integration architecture |
| CI/CD | GitHub Actions |

The full AppForge application requires its API, build pipeline and streaming runtime. Static frontend deployment alone is not the complete AppForge production service.

---

## Security and platform isolation

AppForge is designed around several non-negotiable security rules:

- production secrets remain server-side;
- Supabase service-role credentials are never shipped to the browser;
- Stripe secret keys and webhook secrets remain protected;
- deployment tokens remain protected;
- LLM provider credentials remain protected;
- protected operations require authenticated authorization;
- admin operations require administrator authorization;
- users can access only projects they are authorized to access;
- generated applications do not automatically inherit AppForge's own secrets;
- access codes are scoped and auditable;
- security and moderation failures are surfaced through operational monitoring.

---

## Reliability and production monitoring

AppForge is intended to operate as a real production service rather than a demonstration generator.

Production monitoring covers the critical path including:

- website/application availability;
- authentication;
- database/Supabase connectivity;
- project creation;
- build pipeline failures;
- AI/provider failures;
- build validation;
- deployment failures;
- billing/webhook health;
- critical third-party integrations;
- CI/CD and release health.

Failures should be traceable to a concrete component so they can be corrected rather than silently presented to customers as an unexplained failed generation.

---

## AppForge quality standard

The platform's quality target is not "AI produced some files." A successful AppForge product journey means:

**Account works → access works → prompt is understood → project is created → agents execute → generated source is retained → applicable validation passes → deployment/export succeeds → the result can be used and tested → feedback can be applied.**

Different target technologies require different levels of automated validation. Native/mobile/game products may require their relevant SDKs, stores or engine toolchains before final release. AppForge should clearly report those requirements instead of pretending a structural check is equivalent to native runtime verification.

AI generation can make mistakes. AppForge's role is to reduce those mistakes through planning, validation, testing, repair, review and iteration, while giving the user a path to correct remaining issues.

---

## Developer setup

Prerequisites include Node.js 20+, npm, PostgreSQL/Supabase configuration and an OpenAI-compatible model credential for AI builds. Billing and deployment integrations require their corresponding production credentials.

```bash
git clone https://github.com/Anselm04/AppForge.git
cd AppForge
npm install
cp .env.example .env

npm run validate-env -- --strict
npm run build
npm start
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Production secrets must never be committed to the repository or README.

---

## The AppForge vision

AppForge is being built as the core AI product-building engine for **TrillionAi Tech**.

Its purpose is to make creating a serious digital product dramatically more accessible: a person should be able to bring an idea, explain what the product must do, and have AppForge coordinate the technical work required to turn that idea into something they can actually deploy, use, test and improve.

For professional users and businesses, AppForge becomes an AI development workforce and orchestration layer: planning work, generating code, validating changes, maintaining project history, integrating services and accelerating repeated product development.

For TrillionAi Tech, AppForge provides the foundation for building and operating future products at scale while maintaining centralized administration, access management, billing, analytics, observability and deployment capability.

### Target experience

> **Describe what you want. AppForge plans it, builds it, validates it, deploys it and helps you keep improving it.**

That is the product AppForge is being engineered to become.

---

## License

MIT

# AppForge

> **Describe a digital product. AppForge turns the request into a validated contract, researches it, plans it, builds it with specialist agents, validates the generated artifact, previews it, deploys supported runnable stacks, verifies the live result, and reports an evidence-backed certification state.**

AppForge is the autonomous AI product-building platform developed by **TrillionAi Tech**. The engineering standard is not “AI generated some code.” The standard is that the requested product is preserved through planning and implementation, real source files are produced, placeholders are rejected, the artifact is validated in isolation, and production readiness is not claimed without the required evidence.

## Fresh production audit — 1 October 2026

**Audited production baseline:** `34d19ac5fddc9d10aecbf9e1e9dc814c32898174`

The complete GitHub Copilot implementation list **#1 through #30** is present in the current codebase and is covered by dedicated regression/contract tests. On the audited baseline:

- CI Pipeline passed.
- Test & Coverage passed, including the production golden-path contract.
- Product Factory Validation passed.
- Lint & Format passed.
- Type Check passed.
- Production Build passed and the built server passed liveness.
- Security Gate passed.
- NPM Audit passed.
- Secret Scanning passed.
- CodeQL passed.
- Workflow Supply-Chain Gate passed.
- Disaster Recovery Backup passed.
- Repository Backup & Restore Drill passed.
- Repository Metadata Backup passed.
- Production deployment passed.
- The production release converged to exactly two started application machines.
- `/api/health/live` and `/api/health/ready` passed.
- Anonymous execution, billing, build, preview and application boundaries failed closed as required.
- Customer entry routes passed.
- Production was verified to be serving the exact audited commit.
- Chromium production-shell interaction verification passed.

### Production-readiness incident fixed during this audit

The prior production release failed because `/api/health/ready` remained HTTP 503 with:

```text
reason: database_schema
```

The root cause was an **immutable migration-history checksum mismatch**. A recovery change had added the `recovery_checkpoints` table to the already-applied baseline migration `20260703_001`, changing its SHA-256 checksum. AppForge correctly refused to mark startup ready.

The repair:

1. restored the original baseline migration byte-for-byte;
2. moved recovery checkpoints into a new forward migration, `20261001_007`;
3. preserved fail-closed checksum verification;
4. redeployed the exact repaired commit; and
5. passed readiness, customer-route, exact-SHA and browser verification.

This incident is an example of the intended production rule: **never rewrite an applied migration; add a new forward migration instead.**

---

# Copilot implementation audit: #1–#30

|   # | Area                                        | Audited implementation state                                                                                                                                                                   |
| --: | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Prompt Understanding                        | Implemented and tested: product-type classification, secondary capabilities, ambiguity detection and clarification.                                                                            |
|   2 | Canonical Product Contract                  | Implemented and tested: one schema-validated contract preserves the original prompt, requirements, stack, security, runtime, deployment and monetization intent.                               |
|   3 | Queue and Build Context                     | Implemented and tested: typed contract/intent survives queue transport and invalid queue payloads fail closed.                                                                                 |
|   4 | Technology-Stack Selection                  | Implemented and tested: explicit adapters, compatibility enforcement, no silent fallback to generic React.                                                                                     |
|   5 | Research System                             | Implemented and tested: contract-driven live research, source/evidence recording, conflict handling and safety boundaries.                                                                     |
|   6 | Planner                                     | Implemented and tested: structured architecture/tasks, requirement mapping, dependencies, file ownership and stack preservation.                                                               |
|   7 | Agent Coordination                          | Implemented and tested: specialist tasks, dependencies, ownership boundaries, resumability and persisted coordination state.                                                                   |
|   8 | Code Generation                             | Implemented and tested: real task-owned source files, requirement-linked evidence, no placeholder/fake-success acceptance.                                                                     |
|   9 | Scaffold System                             | Implemented and tested: stack-specific infrastructure floors that cannot replace missing product implementation.                                                                               |
|  10 | Placeholder / Incomplete Product Protection | Implemented and tested: detects TODOs, fake handlers/forms/APIs, empty services/schemas, missing workflows and incomplete required capabilities.                                               |
|  11 | Requirements System                         | Implemented and tested: stable requirement IDs link prompt → tasks → files → tests → validation → deployment evidence.                                                                         |
|  12 | Generated Project Structure                 | Implemented and tested: safe paths, imports, entrypoints, manifests, dependencies, lockfiles and scripts.                                                                                      |
|  13 | Artifact Persistence                        | Implemented and tested: versioned artifacts, per-file/aggregate SHA-256 integrity, current snapshot invariants and tamper detection.                                                           |
|  14 | Preview System                              | Implemented and tested: exact artifact identity, isolated preview boundary, no generic AppForge shell substituted for runnable products.                                                       |
|  15 | Runtime Architecture                        | Implemented and tested: stack-specific runtime/startup/health/shutdown policy.                                                                                                                 |
|  16 | Security Implementation                     | Implemented and tested: secret leakage, injection, SSRF, path traversal, unsafe process execution, auth/tenant boundaries, upload/AI-tool controls and dependency security.                    |
|  17 | Authentication / Authorization              | Implemented and tested: Supabase identity, project ownership, organization roles, protected execution/billing/admin operations and generated-product privilege isolation.                      |
|  18 | Database / Persistence                      | Implemented and tested: locked transactional checksummed migration chain, ownership/billing integrity constraints, backup/restore proof and generated-product DB isolation.                    |
|  19 | Integrations                                | Implemented and tested: named provider requirements, connection/retry/webhook/secret policy and artifact validation.                                                                           |
|  20 | AI-Agent Products                           | Implemented and tested: bounded tools, approvals, memory policy, prompt-injection/refusal boundaries and truthful tool-result handling.                                                        |
|  21 | Monetization                                | Implemented and tested: subscriptions, one-time/usage/credits policy, server-authoritative access, signed/idempotent webhooks and entitlement checks.                                          |
|  22 | Deployment                                  | Implemented and tested: trusted destinations, exact artifact identity, environment/runtime/database policy and deployment audit records.                                                       |
|  23 | Operations / Observability                  | Implemented and tested: health, readiness, liveness, metrics, logs, traces, queue/Redis/DB/provider/cost signals and authenticated diagnostics.                                                |
|  24 | Recovery / Rollback                         | Implemented and tested: immutable known-good checkpoints, exact artifact identity, rollback and failure-class guidance.                                                                        |
|  25 | Build Status / UX                           | Implemented and tested: durable stages, approvals, maturity, failure stage, structural-only truthfulness and no false completion.                                                              |
|  26 | Evidence / Audit Trail                      | Implemented and tested: append-only project evidence for intake, research, plan, files, validation, repairs, security, monetization, deployment, limitations and certification.                |
|  27 | Certification Logic                         | Implemented and tested: structured → generated → runnable → behaviorally verified → deployment verified → monetization verified where applicable → production certified.                       |
|  28 | Regression Coverage                         | Implemented: 25 explicit scenarios across product families, ambiguity/short/long prompts, capabilities, recovery, preview isolation and no-placeholder artifacts.                              |
|  29 | CI / Release Infrastructure                 | Implemented and live-proven: lint, format, types, tests, product-factory validation, security, build, SHA-256 artifacts, exact-SHA release evidence, preview and production fail-closed gates. |
|  30 | Final Product-Factory Flow                  | Implemented and tested: the final evidence-driven verdict is authoritative; no project can claim production readiness while an applicable final-flow step remains incomplete.                  |

Passing these 30 sections means the implementation checklist is complete. It does **not** mean every external provider, native SDK, app store, optional studio or third-party account is automatically configured for every customer.

---

# What AppForge can actually do from the current code

## 1. Understand a plain-language product request

AppForge can:

- preserve the original prompt;
- classify the primary product type;
- detect requested secondary capabilities;
- detect ambiguous intent instead of silently guessing;
- produce clarification questions;
- create one canonical interpretation;
- create stable functional requirements;
- record non-functional, security, runtime, deployment, integration and monetization requirements;
- select and preserve a compatible technology stack.

### Canonical product types

The code currently recognizes 12 product types:

1. Website
2. SaaS application
3. Mobile app
4. Desktop app
5. Game
6. AI agent
7. Developer tool
8. API
9. E-commerce product
10. Browser extension
11. Automation tool
12. Data product

### Secondary capabilities AppForge can model

- authentication
- database
- billing
- AI
- analytics
- administration
- teams
- notifications
- search
- file uploads
- external integrations
- deployment

---

## 2. Research before building

The product-factory pipeline can create contract-driven research requirements and record:

- queries;
- sources;
- decisions;
- uncertainty/conflicts;
- product/stack-specific documentation research;
- integration research;
- deployment research;
- monetization/security research.

Research is treated as evidence, not as permission to override the user’s requirements or platform authorization boundaries.

---

## 3. Build an architecture and implementation plan

The planner can produce and validate:

- architecture summary/modules;
- implementation tasks;
- task sequence;
- dependencies;
- acceptance criteria;
- requirement-to-task mappings;
- task-to-file mappings;
- specialist ownership;
- per-task validation requirements.

The planner is blocked from silently changing the canonical product type or selected stack.

---

## 4. Coordinate specialist agents

AppForge has coordinated responsibilities for areas including:

- frontend
- backend
- database
- AI
- integrations
- security
- deployment
- operations
- general implementation/review

The coordination layer enforces task dependencies and file ownership and can reconcile/resume persisted task state.

---

## 5. Generate and validate real source code

The code-generation path:

- requires the planned files;
- requires real implementation rather than fake success;
- links implementation to requirement IDs;
- rejects TODO-only files and common placeholder patterns;
- rejects empty handlers/components/services and fake API success;
- verifies generated project structure;
- validates dependencies and lockfiles;
- applies contract-aware security scanning;
- can run repair cycles when validation fails.

Scaffolds provide stack infrastructure only. They are not accepted as substitutes for the requested product implementation.

---

# Supported technology stacks

AppForge currently has **17 canonical stack adapters**.

## Runnable stacks

These have runnable validation paths in the current product factory:

| Stack                | Typical products                            |
| -------------------- | ------------------------------------------- |
| `react-node`         | web apps, SaaS, e-commerce, developer tools |
| `static-html`        | websites                                    |
| `next-node`          | websites, SaaS, e-commerce, developer tools |
| `phaser-html5`       | browser games                               |
| `three-js-3d`        | 3D games/sites/data products                |
| `api-service`        | Node APIs/developer services                |
| `node-service`       | APIs, automation and developer services     |
| `ai-agent-node`      | Node AI agents                              |
| `browser-automation` | browser automation                          |
| `data-visualization` | data/analytics products                     |

A runnable stack is still only production-certified when its individual artifact passes all applicable validation, preview, deployment and live-verification evidence.

## Structural-only stacks

These generate source/project structure but are **not automatically production-certified** because the required native/runtime toolchain is outside the currently certified AppForge build boundary:

| Stack               | Current truth                                                                 |
| ------------------- | ----------------------------------------------------------------------------- |
| `react-native-expo` | mobile source deliverable; native release verification required               |
| `flutter-firebase`  | Flutter source deliverable; native SDK/signing/store verification required    |
| `electron-react`    | desktop source deliverable; native packaging verification required            |
| `tauri-rust`        | desktop source deliverable; Rust/Tauri native packaging verification required |
| `python-service`    | generated Python service source; currently structural-only in certification   |
| `ai-agent-python`   | generated Python agent source; currently structural-only in certification     |
| `chrome-extension`  | extension source deliverable; browser-store/runtime verification required     |

AppForge deliberately reports these as structural output instead of pretending that source generation equals a verified native release.

---

# Artifact, preview and certification

AppForge can:

- persist generated files;
- create versioned snapshots;
- compute per-file and aggregate SHA-256 integrity;
- prevent working/partial artifacts from masquerading as final artifacts;
- serve static validated artifacts directly where appropriate;
- use an isolated runtime for runnable previews;
- bind preview evidence to snapshot ID, artifact version and SHA-256;
- refuse to substitute a generic AppForge shell when the real runtime is unavailable;
- deploy supported validated artifacts;
- verify the live response and exact artifact identity;
- perform browser verification where required;
- persist requirement-linked deployment evidence;
- record known-good recovery checkpoints;
- assign an evidence-backed certification level;
- expose unresolved final-flow limitations.

---

# Deployment and source-delivery capabilities

## Implemented deployment paths

The current code contains real implementations for:

- **Fly.io** deployment
- **Vercel** deployment
- **Netlify** deployment
- AppForge isolated/live preview
- ZIP source export

The current AppForge platform release itself is live-verified on Fly.io at the audited baseline.

## GitHub

AppForge includes authenticated GitHub workflows for:

- connection status;
- OAuth/connect flow;
- push/export source to a repository;
- import source from a repository.

## GitHub Pages and source export

GitHub Pages is not a supported production deployment destination and is not
offered in deployment metadata or the UI. Authenticated GitHub source export
remains available; exporting a repository does not claim that it has been
published or verified on GitHub Pages.

---

# Authentication, accounts and authorization

The current platform code includes:

- Supabase authentication;
- sign-up and login;
- session persistence/refresh;
- logout/session revocation paths;
- forgotten-password/password-reset flows;
- authenticated API boundaries;
- project ownership enforcement;
- organization membership/role checks;
- administrator/owner boundaries;
- SSO organization configuration/discovery surfaces;
- owner-scoped and role-scoped server checks;
- CSRF protection for cookie-authenticated mutations;
- rate limiting and slowdown controls.

Generated products do not inherit AppForge’s production identity or database credentials.

---

# Billing, credits and controlled access

AppForge contains Stripe-backed commercial access code for:

- subscription status;
- Stripe Checkout;
- credit purchases;
- Customer Portal;
- webhook processing;
- plan credit grants;
- refund/recovery accounting;
- duplicate-event/idempotency protection;
- effective-tier and entitlement checks.

The platform also contains:

- build-credit accounting;
- credit reservation/refund behavior;
- monthly refill logic;
- owner unlimited-access handling;
- lifetime/unlimited access handling;
- god-code access records;
- OTP/SMS verification support for controlled code redemption.

A customer product requesting monetization cannot reach production certification merely because billing code exists; the exact artifact needs verified monetization/entitlement evidence.

---

# Project lifecycle and continuing development

The project APIs include real operations for:

- create/list/open projects;
- project build logs;
- plan revision and approval;
- monetization approval;
- integration approval;
- resume after approval;
- evidence viewing;
- deployment choices;
- ZIP download;
- Senior Dev changes;
- Senior Dev approval/status;
- snapshots;
- recovery status;
- rollback to a known-good snapshot;
- file read/update/validation;
- required environment variables;
- revenue-readiness checks;
- database setup guidance;
- deploy-health inspection.

Senior Dev is designed for targeted improvements to an existing project rather than unnecessary full regeneration.

---

# Editing, collaboration and project tooling

The codebase includes application surfaces and APIs for:

- project chat;
- project asset attachment;
- versioned file writes;
- visual HTML editing;
- collaboration rooms;
- collaborator invites/removal;
- join/heartbeat/leave;
- collaborative versions;
- template creation/cloning;
- template marketplace surfaces;
- deep research;
- GitHub import/export;
- architecture and other specialist studio surfaces.

These platform modules exist in code, but their presence is not by itself the same as an end-to-end production certification for every optional workflow.

---

# Artifact/document tooling

The AppForge router contains artifact operations for:

- listing and reading artifacts;
- creating document artifacts;
- creating spreadsheet artifacts;
- creating presentation artifacts;
- creating PDFs;
- importing/extracting PDFs;
- artifact analysis.

These are platform utility capabilities and are separate from the core generated-product certification chain.

---

# Language and localization support

The AppForge language menu currently defines **130 locale choices**, including Māori and RTL languages.

However, only **11 locales currently have complete reviewed AppForge UI catalogs**:

- English
- Māori
- Chinese
- Spanish
- Hindi
- Arabic
- French
- Portuguese
- Japanese
- Korean
- German

Every other menu choice is explicitly labeled **English fallback**. Selecting
one keeps the English interface and document language/direction rather than
implying that an unreviewed catalog is translated.

Generated products can also receive locale/i18n instructions through the localization capability, but that does not mean AppForge itself has a reviewed full translation catalog for all 130 menu entries.

---

# Optional build/studio capabilities present in code

The build-capability system contains extension/studio definitions for:

- live web search;
- video editing/rendering;
- graphics design;
- music/lyrics;
- AI marketing;
- interactive AR;
- education/courses/AR classrooms;
- invention/patent workflows;
- architecture/BIM;
- game development;
- 3D product/CAD;
- legal/contracts;
- finance/fintech;
- healthcare/HIPAA-oriented generation;
- native mobile packaging;
- voice/podcast;
- data/BI;
- localization;
- realtime team collaboration.

These should be described as **available code/studio capabilities**, not automatically as production-certified end-to-end products. Each external provider, specialist toolchain and generated artifact still has to satisfy its applicable validation and runtime evidence.

---

# Operations, monitoring and security

The platform code includes:

- structured application logging;
- recursive secret redaction;
- Sentry integration;
- PostHog integration;
- Prometheus-compatible operational metrics;
- protected production metrics access;
- process liveness;
- dependency-aware readiness;
- database health checks;
- shared Redis health checks;
- build/deployment/model/pipeline metrics;
- capacity/abuse/rate-limit signals;
- distributed production rate limiting;
- queue diagnostics;
- security scans for generated projects;
- GitHub CodeQL, dependency audit and secret scanning;
- immutable GitHub Action references;
- exact-SHA release gating.

### Sentry production release gate

The production release gate now requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
`SENTRY_PROJECT`, and the deterministic `appforge@<release-commit-sha>`
identifier. It creates that release and uploads the build's source maps against
the same identifier; missing configuration blocks production release. Local and
non-production CI builds remain usable without Sentry credentials. This code
gate does not claim a Sentry upload has succeeded until the real release workflow
completes with valid credentials.

---

# Recovery and data integrity

The production data/recovery model includes:

- one locked, transactional, checksummed AppForge migration chain;
- migration checksum verification;
- fail-closed ownership/billing integrity migrations;
- database backup scripts;
- backup checksums;
- restore drills;
- recovery-readiness CI;
- versioned build artifacts;
- known-good recovery checkpoints;
- exact artifact/deployment hashes;
- rollback to previous verified state;
- self-healing that must revalidate and re-run the final product-factory verdict.

**Applied migrations are immutable.** New schema work must be a new forward migration.

---

# Launch safeguards and external verification

The following code safeguards are enforced. They do not replace the external
account configuration and live verification required for a paid-customer
release:

1. Mobile, desktop, Chrome extension, and Python adapters are structural-only
   source deliverables. UI, preview, deployment, and certification paths refuse
   to represent them as deployed or production-certified.
2. GitHub Pages has been removed as a production deployment destination.
   Authenticated GitHub source export remains supported.
3. Only 11 of 130 locale choices have reviewed catalogs. Every unsupported
   choice is visibly labeled and uses the English interface.
4. The legacy recipe-generated `src/lib/hostedRuntime.ts` fallback has been
   removed. Hosted runnable apps use validated artifacts and the isolated
   preview path.
5. Project/build status types, metrics, and UI no longer treat a generic
   `completed` value as a validated or production-certified state. Agent/task
   completion states remain unchanged.
6. Production releases fail closed unless Sentry credentials and the exact
   deterministic release identifier are configured and source maps upload
   against that release.
7. The production release gate queries GitHub branch protection/rulesets and
   refuses release if suitable main-branch protections cannot be verified.
8. The production release gate performs read-only live checks for mandatory
   Stripe and any enabled/configured Vercel, Netlify, or Supabase SSO provider.
   It records sanitized provider, timestamp, release/artifact identity, and
   result evidence. Dry runs are restricted to non-production.

**External release evidence is still required.** The gate must run successfully
against the exact release commit with repository metadata read permission,
Sentry credentials, and credentials for each mandatory or enabled provider.
These safeguards and unit tests are not proof that any external account,
deployment, charge/webhook flow, SSO login, or Sentry upload has been
successfully verified. Review [the production gate guide](docs/PRODUCTION_GATE_93_TO_100.md)
for required configuration and live-evidence expectations.

---

# Production certification model

Certification is deliberately graduated:

```text
structured
  → generated
  → runnable
  → behaviorally-verified
  → deployment-verified
  → monetization-verified (when required)
  → production-certified
```

A production candidate is not promoted when required evidence is missing.

For #30, the final product-factory report independently checks applicable steps including:

- canonical contract;
- ambiguity resolution;
- stack selection;
- live research;
- architecture;
- implementation plan;
- specialist-agent completion;
- real source files;
- artifact persistence;
- prompt/stack/requirement preservation;
- placeholder protection;
- requirement-linked behavior evidence;
- isolated build;
- runtime;
- preview;
- exact validated artifact deployment;
- live verification;
- billing/entitlement verification when requested;
- monitoring;
- recovery;
- honest certification;
- exposed limitations.

`productionReady` is true only when the certification decision is production-certified **and** no applicable final-flow step remains incomplete.

---

# CI and release discipline

The current release chain is designed to fail closed.

A release requires relevant evidence including:

- lint and formatting;
- TypeScript checks;
- complete automated tests and coverage thresholds;
- product-factory validation;
- production golden path;
- generated-project/security/isolation/recovery checks;
- dependency vulnerability audit;
- CodeQL;
- secret scanning;
- immutable workflow-action references;
- production build;
- built-server liveness;
- SHA-256 artifact integrity;
- exact current `main` SHA;
- successful exact-SHA CI and security runs;
- production environment requirements;
- two-machine production convergence;
- live/readiness checks;
- auth-boundary checks;
- customer route checks;
- exact released commit verification;
- Chromium live-shell verification.

A stale queued release is intentionally refused rather than being allowed to roll production backwards.

---

# Developer setup

## Requirements

- Node.js 22+
- npm 10.x
- PostgreSQL/database configuration
- Supabase configuration for authentication
- Redis for certified multi-machine production coordination
- at least one configured supported AI/model provider
- Stripe credentials when exercising billing
- deployment credentials for the selected provider

## Install

```bash
git clone https://github.com/Anselm04/AppForge..git
cd AppForge.
npm install
cp .env.example .env
```

## Core verification commands

```bash
npm run validate-env -- --strict
npm run lint
npm run typecheck
npm run test -- --run
npm run test:e2e
npm run build
npm start
```

Production secrets must never be committed to the repository, generated applications, documentation, logs or browser bundles.

---

# Current engineering rule

AppForge should not add features by weakening verification.

The operating rule is:

> **Preserve what already works. Fix what is actually broken. Do not call a generated product production-ready until the exact artifact has the evidence required for its stack and requested capabilities.**

For customers, AppForge’s purpose is to remove unnecessary technical barriers without hiding the difference between generated source, a validated artifact, a deployed product and a genuinely production-certified product.

For TrillionAi Tech, AppForge is the product-factory foundation for repeatedly planning, generating, validating, deploying, verifying, repairing and operating software with centralized security, billing, evidence, observability and recovery.

> **The standard is not “AI generated code.” The standard is “the product actually works.”**

---

## License

MIT

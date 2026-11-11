# AppForge source-of-truth map

This file records which repository artifacts are authoritative so future fixes strengthen the existing system instead of creating competing implementations.

## Rules

1. Change the authoritative source first.
2. Generated, presentation, migration-history, example, and compatibility files must follow the authority; they do not redefine it.
3. If two runtime paths intentionally duplicate a value across a client/server boundary, a regression test must lock their parity.
4. Do not replace an existing subsystem just because another file exposes a similar API. Confirm the authority below first.

## Authorities

| Domain | Authoritative source | Derived / supporting sources | Guard |
| --- | --- | --- | --- |
| Agent build pipeline | `src/agents/.pipeline_parts/part0.txt` … `part4.txt` | `src/agents/pipeline.generated.ts`, `src/agents/pipeline.ts` | `scripts/assemble-pipeline.mjs`; CI build must not mutate tracked source |
| Planner live research | `src/agents/researchAgent.ts`, `src/services/webSearch.ts`, `src/lib/researchEvidence.ts` | Integration metadata / docs | Research evidence and loop guardrail tests |
| Builder retry / redesign policy | `src/lib/neverGiveUp.ts` plus pipeline parts | `pipeline.generated.ts` | Agent-loop and redesign-loop tests |
| Supported build stacks | Pipeline part stack registry | `Home.tsx` stack selector, stack metadata | Source-of-truth parity test; do not add a UI-only stack |
| Build capabilities | `src/lib/buildCapabilities.ts` | capability picker / studios / agent hints | capability tests |
| Runtime environment readiness | `src/utils/env-validator.ts` | `.env.schema.json`, `.env.example`, environment docs | `productionEnvValidator.test.ts`, `environmentSourceOfTruth.test.ts` |
| AI provider readiness | `src/lib/llmProviderConfig.ts`; provider construction in `src/lib/llmProviders.ts` | `.env.example`, `.env.schema.json` | multi-provider environment tests |
| App database schema | `src/db/schema.ts` plus immutable `APPFORGE_SCHEMA_MIGRATIONS` in `src/db/ensureSchema.ts` | `appforge_schema_migrations` ledger; `drizzle/` historical/diff material | migration checksum/invariant tests, recovery governance, `src/db/README.md` |
| Supabase preview migrations | `supabase/migrations/*` only for Supabase preview/optional hosted SQL | — | `supabase/migrations/README.md` explicitly separates this from AppForge app schema |
| Owner-approved USD prices and recurring add-on | `src/services/appForgePricePolicy.ts` and verified Stripe Price objects; checkout `src/services/stripeCheckout.ts`; webhook fulfillment `src/webhooks/stripe.ts` | `src/pages/Pricing.tsx`, landing prices, billing portal and historic env aliases | pricing, webhook, invoice-credit, customer-flow and recovery tests |
| Credits charged by AppForge | `src/lib/credits.ts` | pricing UI and pipeline messages | credit tests |
| Integration/plugin registry | `src/integrations/catalog.ts` | `health.ts`, `runtime.ts`, PluginWorkspace | integration catalog coverage tests |
| Production integration behavior | `src/integrations/runtime.ts`, `src/integrations/health.ts` | catalog metadata | integration runtime/health tests |
| AppForge server/runtime | `package.json` (`build`/`start`), `src/` server and deployment contracts | `Dockerfile`, hosting-specific configs and `docs/FLY_INDEPENDENT_RUNTIME.md` | Full-stack health, build and end-to-end acceptance tests |
| Fly-only hosting implementation | `fly.toml`, `.github/workflows/deploy-production.yml` | legacy Fly documentation and capacity checks | Fly-specific qualification only; **not** a requirement to run AppForge on another host |
| MCP server contract | `src/routes/mcp.ts` | integration catalog entry | MCP interoperability tests |
| Project snapshot currently active | database transaction paths in `src/db.ts` | projects router rollback endpoint | `snapshotSourceOfTruth.test.ts` |

## Current instructions versus dated evidence

The owner has instructed continuous development toward a fully working AppForge. Historical files such as `docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md`, dated launch audits, old proposal documents and archived plans are **historical evidence**, not executable stop-work instructions. Their past-tense statements about frozen builds, disabled checkout, draft PRs, and obsolete prices do not override current product decisions or current tested source.

Every defect must be followed through to verified engineering closure. Keep scoped protections that prevent fraud, surprise charges, exposure of secrets, unbounded provider costs and loss of customer data. A failing gate identifies missing implementation/evidence; it does **not** justify pausing all engineering. Conversely, a documentation change alone never proves a production feature works.

The current approved monthly USD prices are Starter $79, Builder $199, Studio $499 and Enterprise from $2,499 (sales-led), with optional $19 Aftercare Plus; do not reintroduce obsolete $49/$149/$399 as new-purchase amounts. Validate every live transaction against the approved Stripe Price object and respect existing contracted subscriptions.

## Important generated-file rule

`src/agents/pipeline.generated.ts` is generated by `scripts/assemble-pipeline.mjs`. Do not hand-author a permanent pipeline change only in that file. Update the corresponding `.pipeline_parts` source and regenerate. The production build gate verifies that assembly does not leave tracked source modified.

## Environment rule

A specific legacy AI provider is not mandatory. Production requires at least one provider recognized by `src/lib/llmProviderConfig.ts` and constructed by the runtime provider layer. `.env.example` and `.env.schema.json` are documentation/schema mirrors and must never narrow the runtime to one provider.

## Database rule

The Express/Fly application model is defined in `src/db/schema.ts`, while the only production migration executor is the immutable `APPFORGE_SCHEMA_MIGRATIONS` chain in `src/db/ensureSchema.ts`. Applied versions and SHA-256 checksums are recorded in `appforge_schema_migrations`; changing an applied migration must fail closed. SQL under `drizzle/` is supporting historical/diff material, and SQL under `supabase/migrations` serves the Supabase GitHub preview / optional Supabase-hosted path. Neither directory is a second production migration engine.

## Audit status

Source-of-truth audit completed on 2026-09-16. Confirmed existing protections were retained; only verified drift was corrected. Future backlog work should consult this map before adding or replacing implementation paths.

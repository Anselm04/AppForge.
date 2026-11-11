# AppForge: Fly-independent runtime (billing-safe recovery)

Status: **implementation path documented, NOT a certified public deployment**. Last reviewed 2026-11-11.

## Why a static Vercel deployment is insufficient

`vercel.json` builds only `dist/client`. AppForge requires a persistent Node process for Express/tRPC, SSE building, browser validation, preview routes, background work, and payment webhooks. Do not market a Vercel-only UI as a working builder.

## Immediate route: local Linux, then a paid-or-existing persistent host

1. Clone this repository on a trusted Linux computer, install the Node.js version defined in `package.json` (at least 22.22.1), and run `npm ci`.
2. Provision real PostgreSQL and Redis. You may use existing compatible services or local Docker containers. Do **not** use the separate `supabase/migrations` folder as the AppForge application schema migration path; see `docs/SOURCE_OF_TRUTH.md`.
3. Populate a private, untracked `.env` from `.env.example`, using legitimate supported AI provider credentials, Supabase Auth configuration, database/Redis URLs, secure session secrets, and billing credentials **only when testing billing**. Never put secrets in git, screenshots, or logs.
4. Run `npm run typecheck`, `npm run test -- --run`, `npm run test:e2e`, `npm run build`, and `npm run audit:launch`. Correct failures instead of bypassing gates.
5. Start the actual compiled application: `NODE_ENV=production node dist/server.js`. Check `/api/health/live`, `/api/health/ready`, the actual authenticated customer journey, and the SSE builder from the same origin. A successful health endpoint is **not** proof builds work.
6. For public service, move this same image/process onto an always-on, supported Linux VM or container host with TLS reverse proxy, durable data, isolated build execution, backup/restore, correct DNS, and a public Stripe webhook endpoint. Confirm host supports required processes, filesystem isolation, memory and execution limits. Do not assume serverless platforms can run the build engine.
7. Before taking payments, run a real customer acceptance test with approved Stripe test mode, Supabase authentication, generated project creation, edits, persisted snapshots, source export, and an actual external deployment. Live payments require separate authorised checks.

## Current limits

- The existing production GitHub workflow is **Fly-specific**; it is not an alternative-host deployment workflow.
- `src/services/productionAutoDeploy.ts` still assumes Fly deployment and must not be represented as a working generic deployment adapter.
- `src/services/deployer.ts` supports a customer-owned Vercel path for supported generated projects, but this does **not** host the AppForge builder itself.
- A provider-neutral CI/CD workflow, credentials, TLS endpoint and full end-to-end verification are still required to switch the public service.
- Do not substitute sample build output or fake customer transactions for proof.

## Billing-safe Fly hold

While Fly billing is unresolved, the Fly runtime deploy, Redis provisioning and capacity-guard workflows are **manual-only**. They are retained for an authorised future return to Fly. Never manually invoke them during the billing hold. Other workflows may reference Fly for verification; audit them before any broader infrastructure changes. This repository change does not stop existing Fly machines or stop Fly billing. Account-level machines, volumes, subscriptions and invoices must be reviewed through Fly itself.

## Source of truth

`docs/SOURCE_OF_TRUTH.md` defines canonical build, schema, credits, auth, price and migration code. For hosting, the **actual** server entry point and build/runtime contracts are independent of Fly; `fly.toml` governs only a Fly deployment.

## Provider-neutral production integration verification

The legacy integration ID `sprites-fly` is retained for existing records and admin clients, but **Fly.io is not a required host**. Production integration verification checks the configured HTTPS `PUBLIC_APP_URL` or `APP_URL` at `/api/health/ready`, then verifies either the configured isolated build/preview/health runner or a real existing-host/Docker validation runtime. It must not infer a healthy builder from a Fly application name or contact Fly simply because a historical environment variable remains set. An HTTPS application liveness response alone is not sufficient to certify generated customer products; build isolation and end-to-end acceptance remain separate requirements.

# AppForge Fly Redis Recovery Checkpoint — 2026-09-16

## Preserved production candidate

- Repository: `Anselm04/AppForge.`
- Preserved source SHA: `70f39798240a4f63ee67dc6394694f65f5d7a5cb`
- Recovery branch: `recovery/2026-09-16-pre-redis-fix`
- Fly application: `appforge-unfurling-moon-9058`

This recovery branch was created before any Redis infrastructure remediation so the exact last verified application state remains recoverable.

## Verified state

The latest production validation completed successfully for the preserved SHA, including:

- `npm ci`
- lint
- TypeScript typecheck
- unit/integration tests
- production golden-path contract
- production dependency audit
- production build
- Docker builder verification
- pinned production public configuration validation

The Fly deployment authenticated successfully with `FLY_API_TOKEN`, then stopped at the runtime-secret gate because Fly does not currently expose a `REDIS_URL` secret for the AppForge application.

The deployment gate is intentionally fail-closed. Do not remove or bypass the `REDIS_URL` requirement to force a deployment: AppForge now relies on shared Redis state for safe two-Machine coordination, shared rate limiting, build coordination, and recovery invariants.

## Exact blocker

`REDIS_URL` is missing from Fly runtime secrets for `appforge-unfurling-moon-9058`.

All other names checked by the production deployment gate were present at the time of the failed run:

- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BUILT_IN_FORGE_API_KEY`
- `OWNER_EMAIL`

## Safe recovery sequence

1. Provision or identify the intended production Redis service inside the same Fly organization. Fly's supported managed Redis integration is Upstash Redis.
2. Obtain its private Redis connection URL without printing it into CI logs or committing it to Git.
3. Store that URL as the Fly application secret `REDIS_URL` on `appforge-unfurling-moon-9058`.
4. Confirm only the secret name is visible with `flyctl secrets list --app appforge-unfurling-moon-9058`.
5. Rerun the failed production deployment or trigger a new verified `main` release.
6. Require the deployment workflow to pass all post-deploy gates:
   - exactly two started `app` Machines
   - `/api/health/live`
   - `/api/health/ready`
   - anonymous auth boundaries fail closed
   - customer entry/deep-link routes return non-empty HTTP 200 responses
7. Only after those checks are green should this recovery checkpoint be considered superseded.

## Do not do

- Do not place the Redis connection URL in `fly.toml`, `.env` files committed to Git, issues, workflow logs, or documentation.
- Do not weaken the production workflow to make Redis optional for the two-Machine deployment.
- Do not report the Fly deployment as successful until the post-deploy runtime and customer-flow checks pass.

## Recovery rollback

If a later remediation causes a regression, restore from the preserved source SHA or this recovery branch and investigate from there rather than bypassing production gates.

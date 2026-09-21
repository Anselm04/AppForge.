# AppForge Recovery Inventory

This inventory defines what must be recoverable for AppForge to return to service after a severe incident. It intentionally records names, responsibilities, locations, and verification requirements — never secret values.

## Source control

System: GitHub repository `Anselm04/AppForge.`

Must be recoverable:
- Full Git history, refs, branches, and tags.
- Pull requests/issues/releases metadata backup.
- CI/security/deployment workflows.
- CODEOWNERS and review policy.
- Recovery governance policy.
- Latest known-good production SHA.

Recovery evidence:
- Verified Git bundle.
- SHA-256 checksums.
- Clean restore rehearsal.
- `git fsck --full --strict`.
- Exact restored SHA match.

## Off-site recovery storage

Must be recoverable:
- At least one independent encrypted repository backup.
- Prefer two independent providers/credential boundaries.
- Backup decryption key retained independently from GitHub.

Required non-secret configuration names:
- `OFFSITE_BACKUP_PASSPHRASE`
- `OFFSITE_1_ENDPOINT`
- `OFFSITE_1_REGION`
- `OFFSITE_1_BUCKET`
- `OFFSITE_1_ACCESS_KEY_ID`
- `OFFSITE_1_SECRET_ACCESS_KEY`
- Optional equivalent `OFFSITE_2_*` values.

Verification:
- Upload.
- Download.
- SHA-256 validation.
- HMAC validation.
- Decryption.
- Git bundle verification.
- Exact SHA recovery.

## Owner identity and privileged access

Must be recoverable:
- GitHub owner access.
- Password-manager recovery.
- At least two independent MFA/passkey/hardware-key paths.
- Offline provider recovery codes.

Never store recovery codes or private keys here.

## Domain registrar and DNS

Must be recoverable:
- Registrar ownership.
- Domain lock/unlock recovery procedure.
- DNS zone/configuration inventory.
- MFA and offline recovery path.

Verification:
- Confirm owner can access registrar independently of daily device.
- Export or otherwise document DNS configuration after material DNS changes.

## Supabase

Must be recoverable:
- Database data and schema.
- Migrations.
- Auth configuration.
- RLS/policies.
- Storage object inventory and restore procedure.
- Required Edge Functions/configuration if used.
- Environment/configuration inventory without secret values.

Verification target:
- Periodic restore into an isolated recovery environment/project.
- Authentication and authorization verification.
- Critical database/RLS checks.

## Fly.io

Must be recoverable:
- App identity and configuration.
- `fly.toml`.
- Required secret-name inventory.
- Deployment/release history sufficient to identify a known-good version.
- Independent record of a known-good production image/release where feasible.
- Production `Dockerfile` and build contract used by Fly remote builds.
- Dependency manifest/lockfile parity required to reproduce the same production builder environment from a trusted SHA.

Required production secret names include:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OWNER_EMAIL`
- At least one supported LLM-provider credential used by the runtime router, such as `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `BUILT_IN_FORGE_API_KEY`, `FORGE_API_KEY`, or `OPENAI_API_KEY`.

Verification target:
- Recreate/redeploy exact trusted SHA.
- Rebuild the production Docker builder stage from the trusted SHA before deployment and require it to succeed without relying on developer-machine `node_modules` state.
- Confirm the Docker build uses the repository dependency manifest and lockfile consistently before release.
- Health/readiness/auth-boundary smoke verification.
- After a restore or redeploy, verify every private REST surface still fails closed to anonymous callers before reopening customer traffic.
- Confirm at least one supported LLM provider secret name is present before reopening generation. The built-in Forge credential is optional when another supported provider is configured.
- Confirm the Alpine builder can reproduce the release from the committed lockfile, including the Rollup musl package bootstrap without relying on a developer-machine cache.

### Alpine builder recovery note — 20 September 2026

The production Docker builder now bootstraps the Rollup musl native package with `npm pack` plus direct archive extraction after the clean locked `npm ci`. This avoids the npm Arborist second-install failure seen in release validation while preserving a reproducible clean build. Recovery drills must continue to rebuild the builder stage from a trusted SHA and must not depend on cached developer `node_modules`.

## Shared Redis two-Machine coordination

Recovery invariant reviewed 16 September 2026:
- `REDIS_URL` is a production correctness dependency for the redundant Fly fleet, not an optional performance setting.
- BullMQ jobs, Redis queue claims, build event pub/sub, distributed hard rate-limit buckets, and other cross-instance coordination must use shared Redis so a request routed to the second Machine does not receive unrelated local state.
- Production environment validation fails closed when `REDIS_URL` is missing or malformed.
- The production deployment workflow refuses a release when the Fly secret-name inventory does not include `REDIS_URL`.
- `/api/health/ready` verifies the shared Redis connection in production. Liveness remains process-only so a temporary Redis outage does not cause Fly to restart both otherwise healthy HTTP processes, while readiness correctly removes the affected release from service certification.
- In-memory build queue/rate-limit behavior remains useful for local development and test/degraded-mode coverage, but it is not a certified substitute for shared Redis in two-Machine production.

Verification target:
- Confirm both started Fly Machines use the same production `REDIS_URL` secret name/configuration.
- Confirm `/api/health/ready` returns 503 when shared Redis cannot be reached and returns 200 only after Redis and the database are ready.
- Confirm hard rate limits use Redis-backed buckets in production so alternating requests between Machines cannot double the effective limit.
- Confirm BullMQ/Redis queue claims prevent duplicate project execution across Machines.
- During recovery, restore shared Redis access before declaring the redundant fleet production-ready.

## Single-writer recurring side effects

Recovery invariant reviewed 16 September 2026:
- Both Fly Machines execute the same server bootstrap. Any recurring job that causes an external side effect must therefore be distributed-safe rather than assuming only one process exists.
- The Vanta compliance heartbeat uses a Redis `SET NX` interval-slot claim (`appforge:vanta:heartbeat:<slot>`) so exactly one Machine emits heartbeat evidence for a given interval.
- If shared Redis coordination is unavailable in production, the Vanta heartbeat fails closed and emits no uncoordinated duplicate evidence; it retries on the next scheduled interval.
- Future cron/poller/background features that can charge money, mutate customer data, deploy code, send messages, create compliance evidence, or trigger autonomous work must use BullMQ, a database/Redis lock, an idempotency ledger, or an equivalent single-writer/deduplication mechanism before they are production-critical.

Verification target:
- Start both production Machines and confirm only one Vanta heartbeat is accepted per interval slot.
- Confirm the slot claim is shared through production Redis, not process memory.
- Confirm loss of Redis does not cause both Machines to emit the same recurring side effect.
- Treat a new recurring external side effect without distributed ownership/idempotency as a two-Machine production regression.

## Production service availability invariant

Recovery invariant reviewed 16 September 2026:
- AppForge is a revenue-facing production service and must keep exactly two Fly app Machines as the normal steady-state target so one Machine can fail without becoming a total service outage and stale blue/green replacements are not accidentally revived into over-capacity.
- `auto_stop_machines` is disabled in production; `auto_start_machines` remains enabled; `min_machines_running` must remain two.
- Production deployment uses blue/green replacement so the previous healthy fleet remains available until replacement Machines pass health checks.
- Fly can transiently expose old stopped Machines or briefly leave a replacement stopped immediately after blue/green cutover. The production deployment workflow therefore reasserts `app=2`, starts only enough stopped app Machines to restore the exact target, waits for platform convergence when more than two are temporarily started, and refuses to certify the release unless exactly two app Machines are started.
- The scheduled Fly capacity guard independently reasserts count two, starts only the number of stopped app Machines required to restore the target, waits for convergence rather than stopping Machines blindly when Fly temporarily reports more than two, and then verifies repeated public liveness.
- The scheduled Production Customer Flow Smoke is two-Machine aware: connection-level and 5xx cutover noise is retried, while customer-route failures and application-level authorization contract failures remain red.
- Recovery must not depend on an idle or post-deploy Machine wake-up succeeding before health, authentication, or billing traffic can be served.
- A restored Fly configuration that re-enables production auto-stop, changes the two-Machine target, removes blue/green replacement, removes either capacity-reconciliation control, removes shared Redis, removes recurring single-writer coordination, or removes the two-Machine-aware customer smoke is not equivalent to the certified production availability posture and must be reviewed before customer traffic resumes.

Verification target:
- Confirm the deployed Fly service reports exactly two started app Machines after every release and recovery once blue/green convergence is complete.
- Confirm Fly health checks pass for the replacement fleet before blue/green cutover completes.
- Confirm the deployment workflow can recover a replacement Machine that transitions to stopped immediately after cutover without reviving every historical stopped Machine.
- Confirm a temporary count above two is allowed to converge after `scale count 2` rather than being "fixed" with blind stop commands during cutover.
- Confirm `/api/health/live` remains reachable without requiring an auto-start wake-up.
- Confirm recovery of `fly.toml` preserves `auto_stop_machines = false`, `auto_start_machines = true`, `min_machines_running = 2`, the liveness check, and blue/green deployment.
- Run the Fly Production Capacity Guard to reconcile accidental capacity drift back to exactly two app Machines and fail closed if that steady state cannot be established.
- Run the Production Customer Flow Smoke and confirm transport retries do not mask persistent 5xx, customer-route failures, or incorrect authorization responses.

## Production CI boot-liveness invariant

Recovery invariant reviewed 18 September 2026:
- A trusted AppForge SHA is not release-ready merely because client/server bundles were created; the built production server must actually boot and answer `/api/health/live` before the CI release gate can pass.
- The CI liveness probe starts the compiled `dist/server.js` with production settings, waits for the health endpoint, and then performs deterministic process cleanup before reporting success.
- Process cleanup must not overwrite a verified liveness success with a shell/trap exit-code artifact. Conversely, cleanup hardening must never convert a failed or unreachable server into a passing build.
- Any change to the production CI boot probe is recovery-impacting because restore/redeploy procedures depend on the same executable startup evidence before a SHA is treated as known-good.

Verification target:
- Build the production client/server artifacts from a clean dependency install.
- Start `dist/server.js` and require HTTP success from `/api/health/live`.
- Confirm the server process is terminated after the probe without changing the successful job exit status.
- Confirm an early server exit or a liveness timeout still fails the Production Build job and therefore fails the CI Release Gate.

## Production deployment freshness invariant

Recovery invariant reviewed 15 September 2026:
- A queued production deployment must never roll AppForge backward after `main` has advanced to a newer release candidate.
- Production deployment concurrency cancels an older in-progress deployment when the replacement release is ready to enter the same production deployment group.
- Both release validation and the Fly deployment job must resolve `refs/heads/main` from the remote repository and require it to equal `RELEASE_SHA`.
- The release freshness check is repeated immediately before `flyctl deploy` so a SHA that becomes stale after validation cannot be shipped.
- If the current `main` SHA cannot be resolved, the deployment fails closed rather than guessing that a queued SHA is safe.

Verification target:
- Queue a newer `main` release while an older deployment exists and confirm the obsolete deployment cannot become the final production release.
- Confirm a stale `RELEASE_SHA` fails before `flyctl deploy`.
- Confirm the deployed SHA is the same SHA that passed the current CI release gate and remains the current `main` at deployment time.

## Production authorization canary

Recovery invariant reviewed 16 September 2026:
- A production release is not considered recovered merely because `/api/health/live` and `/api/health/ready` succeed.
- Anonymous GET canaries for protected preview, build, project/app, and billing reads must receive HTTP 401.
- Anonymous state-changing POST canaries for AI extraction, agent execution, generation, and checkout must fail closed with HTTP 401 or HTTP 403. A 403 is valid when CSRF protection rejects the request before authentication; neither status permits execution or data access.
- The production deployment workflow probes these boundaries after every release so a route refactor cannot silently convert a recovered system into an exposed one.
- If any anonymous authorization canary returns a successful or otherwise unexpected status after restore or redeploy, keep the release out of service, identify the routing/authentication regression, fix it in source, rerun CI/security/build, and deploy the corrected SHA. Do not bypass the canary to complete recovery.

Verification target:
- Confirm `/api/preview-auth/1` and `/api/build/1` return 401 to anonymous callers.
- Confirm anonymous POST requests to AI extraction, agent build, generation, and checkout entry points are rejected with 401 or 403 before request execution.
- Confirm anonymous project/app and billing compatibility reads return 401.

## Build queue and customer credit recovery

Must be recoverable:
- Build reservation state recorded in the credit ledger.
- Attempt identity (`projectId` + queued `createdAt`) used by build refund idempotency keys.
- Persisted build events required to replay terminal `done`/`error` state after reconnects or worker restarts.
- BullMQ/Redis configuration needed for distributed builds, with Redis-list and in-memory degraded-mode behavior documented in source.

Recovery invariants:
- Production must use shared Redis; Redis-list and in-memory fallbacks are not certified as a two-Machine production steady state.
- A failed or incomplete paid build refunds the original reservation with an attempt-specific idempotency key.
- Duplicate queue admission refunds only the duplicate reservation and must not affect the active build reservation.
- If a duplicate job reaches a worker while the same project is already active, the worker uses the same duplicate-refund idempotency key as queue admission before returning. This prevents queue/worker races from stranding or double-refunding credits.
- Terminal build events are persisted before publication so a reconnect can recover the final result even if Redis pub/sub delivery was missed.
- Retry/recovery must never infer billing from the user's current entitlement; it must use the reservation state of the original attempt.

Verification target:
- Exercise duplicate admission through BullMQ, Redis-list fallback, and memory fallback in test/degraded environments and confirm one active build plus exactly-once duplicate refunds.
- Exercise production BullMQ across multiple workers and confirm one logical project build is not executed twice when requests/workers are distributed across Machines.
- Exercise worker failure and timeout and confirm a persisted terminal error plus exactly-once reservation refund.
- Exercise disconnect/reconnect around terminal publication and confirm persisted terminal replay without duplicate execution or charging.

## Stripe

Must be recoverable:
- Product/price identifiers.
- Webhook endpoint configuration.
- Subscription/entitlement mapping logic.
- Required webhook secret recovery/rotation procedure.
- Billing reconciliation procedure.
- Shared PostgreSQL `stripe_webhook_events` replay ledger and advisory-lock behavior.

Recovery invariant:
- Stripe event processing is multi-Machine safe only when both Machines share the same PostgreSQL database. `processStripeEventOnce` takes a transaction-scoped PostgreSQL advisory lock derived from the Stripe event ID, checks the shared event ledger, runs the handler once, and records the event before releasing the transaction.

Verification target:
- Deliver the same controlled test-mode webhook concurrently to both Machines and confirm only one handler execution/ledger insertion.
- Controlled test-mode checkout/webhook path.
- No production secrets stored in repository backup.

## Snapshot source-of-truth recovery

Recovery invariant reviewed 15 September 2026:
- A build snapshot selected as current and the canonical `projects.generatedFiles` copy must be synchronized in the same database transaction.
- Snapshot activation must reject a snapshot that does not belong to the target project.
- Successful snapshot activation must invalidate the live-preview cache so preview, rollback, download, and deployment reads converge on the newly active state.
- A recovery or rollback procedure must use the same snapshot activation function rather than independently changing snapshot flags and project files.

Verification target:
- Activate a prior snapshot and confirm it becomes the sole current snapshot while `projects.generatedFiles` matches its file set.
- Confirm a snapshot from another project cannot be activated.
- Confirm the next preview/read after activation observes the restored snapshot rather than stale cached output.

## Generated-product certification recovery

Recovery invariant reviewed 18 September 2026:

- A production build is not recoverable or releasable unless its numbered requirement contract and linked executable behavioral tests are retained with the generated source.
- Generated code must be installed, tested, built, and booted only in a disposable Sprites or Docker environment. Recovery must never replace an unavailable isolation provider by executing customer-generated code on an AppForge production host.
- The Sprites bridge configuration consists of `SPRITES_BUILD_URL` (or the compatible `SPRITES_EXEC_URL`) and `SPRITES_API_TOKEN`. Provider ownership, endpoint recovery, credential rotation, and a controlled proof run must remain independently available to the owner.
- An isolated success response is valid only when it includes an isolation ID and explicit passing evidence for install, tests, build, and runtime. Missing or partial evidence fails closed.
- Fly deployment certification requires the live site to serve the SHA-256 identity of the exact validated generated artifact before root, asset, and real-browser checks run.
- The terminal customer `done` event must remain withheld until the remote deployment returns matching artifact identity plus successful HTTP, asset, and Chromium evidence.

Verification target:

- Restore or rotate the Sprites bridge credentials and run a controlled generated product through install, behavioral tests, build, and runtime boot in a disposable environment.
- Disable both Sprites and Docker isolation and confirm production generation fails at the isolation gate without starting generated code on the AppForge host.
- Tamper with or remove the deployed `/.well-known/appforge-build.json` identity and confirm production certification fails.
- Restore the exact validated artifact, verify the identity matches, then confirm root, same-origin assets, and the rendered browser page pass before a terminal success event is emitted.

Must be recoverable:

- Sprites bridge account ownership, endpoint configuration, and token rotation.
- Fly account ownership and deployment token rotation.
- Generated requirement manifest, executable tests, source snapshot, and artifact SHA-256 certification evidence.
- A Docker isolation runtime as an independently controlled alternative where the production architecture provides it.


## Browser authentication continuity recovery

Recovery invariant reviewed 20 September 2026:

- Supabase refresh credentials remain server-managed in Secure/HttpOnly cookies and must never be copied back into localStorage.
- The current browser-tab/session bearer token may be mirrored in sessionStorage so a normal page reload does not erase the credential required by `auth.me`, protected API calls, and server-side owner recognition.
- The durable localStorage record contains only the non-secret user identity used for UI continuity. It must not be treated as proof of authentication or owner status.
- Owner/Admin authorization remains server-derived through `auth.me.isOwner` and `ownerOnlyProcedure`; a client-stored email or user record must never grant owner access.
- When a bearer token is expired or rejected, AppForge removes the sessionStorage bearer and falls back to the server HttpOnly session/refresh-cookie path. Sign-out clears both the user continuity record and the browser-session bearer.

Verification target:

- Sign in as a confirmed user, reload the same browser tab, and confirm protected `auth.me` remains authenticated.
- Sign in as the canonical owner, reload the page, and confirm the server again reports `isOwner: true` and the Admin navigation remains visible.
- Close the browser session and confirm no refresh token exists in Web Storage.
- Expire/reject the bearer and confirm AppForge removes the stale sessionStorage token and uses the secure server cookie refresh path rather than trusting the local user record.
- Confirm a non-owner cannot obtain Admin access by editing localStorage or sessionStorage.

Must be recoverable:

- Supabase project ownership and public client configuration.
- Server-side access/refresh cookie behavior and rotation.
- The browser-session access-token continuity contract.
- Canonical owner authorization logic and owner-only server procedures.


## AI providers and automation services

Must be recoverable:
- Provider account ownership.
- Credential rotation path.
- Quota/limits/configuration required for AppForge agents.
- Safe fallback/degraded-mode expectations where applicable.

AI systems must never be the sole holder or chooser of recovery credentials or trusted restore points.

## Observability and incident evidence

Must be recoverable or independently accessible:
- Deployment logs.
- Security workflow results.
- CI status history where practical.
- Monitoring/alerting account access.
- Incident timeline records without secret values.

## Recovery dependency rule

Any new critical provider, database, deployment target, authentication mechanism, billing dependency, secret-management system, object store, shared coordination service, recurring side-effect worker, or AI execution environment must be added to this inventory in the same change that makes it production-critical.

If a critical dependency cannot be independently recovered, it must be treated as an unresolved resilience risk.

## Quarterly owner review

Confirm:
- Two independent owner recovery paths.
- Independent backup decryption-key access.
- At least one off-site backup restore succeeds.
- Latest known-good production SHA is recorded.
- Provider ownership and recovery access still work.
- Recovery documentation matches current architecture.
- Shared Redis is reachable and required by both production Machines.
- Recurring external side effects still have distributed single-writer/idempotency controls.
- Exact two-Machine Fly production recovery is still enforced by deployment, capacity guard, readiness, and customer smoke workflows.
- No discontinued provider remains an undocumented dependency.

This document contains no secret material by design.

## Live customer-shell browser recovery invariant

Recovery invariant reviewed 21 September 2026:
- A release is not fully certified by HTTP route availability alone; the deployed customer shell must remain interactable in a real mobile Chromium session.
- The post-deploy gate must prove the landing prompt accepts text and enables Generate, the compact navigation opens, the language menu exposes more than 100 choices, selecting French changes the live document locale and translated controls, and both dark/light theme controls toggle successfully.
- This browser check runs only after the exact release SHA has deployed, two-Machine reconciliation has passed, live/readiness checks are green, private API boundaries fail closed, and customer entry routes return non-empty HTTP 200 responses.
- A browser-shell failure blocks release certification even when health endpoints remain green, because a reachable service with broken primary controls is not equivalent to a recoverable customer-ready release.

Verification target:
- Run the production deployment workflow for the exact trusted SHA.
- Require the Chromium customer-shell step to pass against the public Fly production URL.
- Treat missing prompt interaction, broken compact navigation, fewer than 100 language choices, failed French locale application, or non-functional theme toggles as a production regression requiring correction before the release is considered customer-ready.


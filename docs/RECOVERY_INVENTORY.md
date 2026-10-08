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
- `OWNER_PHONE`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
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

Recovery invariant reviewed 9 October 2026:
- The normal steady-state fleet is exactly two started app Machines with passing health checks and the same immutable release SHA.
- Production disables auto-stop, keeps auto-start enabled, and requires two minimum running Machines. Blue/green replacement retains the healthy fleet until the replacement passes health checks.
- Deployment and scheduled verification share the non-cancelling `fly-production-runtime` concurrency group. Both use the read-only verifier; neither scales the fleet or revives historical stopped Machines.
- Transient replacement states receive a bounded convergence window. Missing capacity, failed health checks, mixed releases or missing commit labels fail verification and require explicit release recovery.
- Shared Redis, single-writer side effects, public readiness, authorization canaries and customer-route checks remain mandatory.

Verification target:
- Require exactly two started app Machines after convergence, passing health checks and identical `GH_SHA` labels. Deployment additionally requires the approved release SHA.
- Run the Fly Production Capacity Guard to verify capacity; a failed guard does not automatically repair or certify the fleet.
- Preserve `auto_stop_machines = false`, `auto_start_machines = true`, `min_machines_running = 2`, liveness checks and blue/green deployment during recovery.
- Run the Production Customer Flow Smoke; transport retries must not mask persistent failures or incorrect authorization responses.

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
- Every queued build carries a typed, runtime-validated canonical product contract alongside the original prompt; Redis, BullMQ, in-memory fallback, resumed execution, repair cycles, and deployment retries must preserve that exact contract rather than reconstructing it from free text.
- Queue deserialization fails closed when the contract is missing or invalid, and worker admission rejects any job whose original prompt or selected stack disagrees with the persisted project contract before project state is mutated.
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

### Explicit interrupted-build recovery — 2026-10-08

The authenticated build event GET is observational: reconnecting subscribes to events and does not enqueue a paused worker. Owners must use **Retry saved build** for `retry_after_error`, `agent_timeout`, `still_building`, or a numbered `still_building_soft_ceiling` pause. The protected resume procedure retains ownership, canonical intent, plan/integration/monetization approval, reservation, and atomic build-claim checks. User cancellation, missing credentials, insufficient credits, and unapproved decisions are not retryable through this action.

A successful claim persists a `build_resume` event before queue admission. Reconnect replay begins at the latest such event, so a prior attempt's pause or terminal error cannot stop the resumed stream. Earlier events remain stored for audit and recovery; they are not deleted. Failed queue admission restores the original pause reason and the existing reservation refund behavior. The client starts a fresh stream after successful resume and stops reconnecting to a recoverable paused worker.

Recovery verification must exercise the pause allowlist and cancellation exclusions, latest-attempt replay, duplicate admission and credit recovery, then a real saved-plan retry across the production workers. Source tests alone do not certify a complete generated-product journey.

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
- A delayed payment-failure notification reconciles the current Stripe subscription status rather than forcing `past_due`. A failed Stripe lookup returns a retryable webhook error without changing local status.
- Subscription cancellation updates match both the user and canceled subscription ID so a late cancellation cannot revoke a replacement subscription.

Verification target:
- Deliver the same controlled test-mode webhook concurrently to both Machines and confirm only one handler execution/ledger insertion.
- Controlled test-mode checkout/webhook path.
- Deliver an old payment-failure event after a successful retry and confirm the subscription remains active; repeat with a temporary Stripe lookup failure and verify no local write until retry succeeds.
- Replace a canceled subscription, replay its cancellation, and confirm the replacement retains its status and tier.
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

Recovery invariant reviewed 23 September 2026:
- Technology-stack selection is governed by explicit stack adapters. Unknown explicit stacks must fail instead of being silently converted to React.
- Structural-only adapters (mobile native, desktop native, browser extensions, and Python-native outputs where configured structural-only) must never be promoted to production-certified deployment until their native runtime/toolchain has been verified.
- Production certification must read the canonical product contract's selected stack and enforce the adapter's runtime/deployment status before deployment.
- Recovery of generated-product certification must preserve the adapter registry and stack-specific build/runtime metadata so a restored AppForge instance cannot misclassify structural output as a live deployable product.

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



## Generated-product deployment contract

Recovery invariant reviewed 28 September 2026:
- Production deployment must pass the canonical generated-product deployment contract before any provider action. The selected stack, runtime metadata, deployment metadata, required environment/config artifacts, database migration/schema evidence when required, and requested worker/scheduled-job support must agree with the canonical product contract.
- Production destinations are fail-closed: only the trusted production destinations implemented by AppForge may be used, and the selected stack adapter must explicitly support the requested destination.
- Every packaged production artifact carries `appforge.production.json` with the deployment version, startup and health contract, domain/TLS policy, asset handling, database requirements, worker/scheduled-job policy, scaling/resource limits, bounded deploy and health timeouts, and rollback policy.
- Production identity remains SHA-256 based. The deployed build identity must match the exact validated artifact before AppForge may report success; the deployment manifest is also hashed and returned with the verified deployment result.
- A successful production certification emits a deployment audit record tied to destination, stack, artifact SHA-256, artifact version, verified URL, and verification timestamp. A missing or failed verification must never be converted into a successful deployment record.
- Recovery uses the previous verified artifact/version as the rollback target. Operators must not mark an unverified artifact current merely because generation, provider upload, or container startup succeeded.
- These invariants apply to generated customer products independently of the AppForge host deployment. They do not authorize direct execution of generated code on the AppForge host or reuse of AppForge production credentials.


## Operations and observability recovery invariants

Section 23 observability is part of production recovery evidence:
- Structured application logs must remain recursively redacted before console/Sentry emission; production diagnostics must never expose credentials or secret values.
- `/api/health/live` remains process-only liveness. `/api/health/ready` remains dependency-aware readiness. The full health endpoint may report coarse database/Redis state, while detailed operational diagnostics remain authenticated.
- `/metrics` is the Prometheus-compatible operational metric surface. It contains aggregate operational labels only and must not contain user prompts, email addresses, access tokens, cookies, API keys, or generated source.
- Build, deployment, model, and pipeline-agent telemetry must remain tied to actual execution paths. A generated file, queue admission, provider upload, or model response is not a successful build/deployment unless the existing completion and production-verification gates succeed.
- Queue diagnostics must report the actual active backend (BullMQ, Redis list, or local degraded memory queue), queue depth, worker activity, Redis configuration/connection state, and explicit capacity values.
- Owner diagnostics remain protected by `ownerOnlyProcedure`; normal authenticated users receive only coarse service diagnostics. Public health routes must not reveal integration secrets or owner-only operational traces.
- Operational alert rules cover queue backlog, database/Redis availability, repeated build/deployment failures, rate-limit pressure, HTTP error/latency pressure, and process capacity. Recovery is not complete while critical observability alerts remain active without an understood incident explanation.
- Grafana/Prometheus dashboards are derived from the same metrics emitted by the application. A dashboard panel with no live application metric is documentation only and must not be treated as recovery proof.

## Section 24 durable generated-product recovery checkpoints

Recovery invariant reviewed 28 September 2026:
- Every successfully validated final generated-product snapshot is recorded in `recovery_checkpoints` with its project ID, snapshot ID, artifact version, and the immutable snapshot SHA-256.
- A production-verified recovery point additionally records deployment contract version, deployment-manifest SHA-256, verified live URL, and source `production_verified`.
- Recovery checkpoint creation revalidates snapshot ownership, artifact version, and persisted artifact SHA-256 before storing or updating a checkpoint.
- `project_id + artifact_version + source` is unique so retrying checkpoint persistence cannot create ambiguous duplicate recovery points.
- Failed deployment, failed preview, provider outage, interrupted build, or partial generation must never replace the newest known-good checkpoint.
- The safe rollback API selects the newest known-good checkpoint and activates its exact snapshot through `markSnapshotAsCurrent`; it never copies working files or toggles snapshot state independently.
- Source-only structural products may use a `validated_artifact` checkpoint. Production rollback must prefer a `production_verified` checkpoint and rerun production verification after redeployment.
- Queue interruption, duplicate attempts, failed/incomplete builds, credit refunds, paused builds, database/migration incidents, provider failures, preview failures, and partial generation follow the procedures in `docs/RECOVERY_AND_ROLLBACK.md`.

Verification target:
- Complete a validated build and confirm a `validated_artifact` checkpoint records the exact snapshot version and SHA-256.
- Complete a production-certified build and confirm a `production_verified` checkpoint records deployment version, deployment-manifest SHA-256, and verified live URL.
- Attempt to record a checkpoint with a mismatched snapshot, version, or artifact hash and confirm it fails closed.
- Restore the newest known-good checkpoint and confirm atomic snapshot activation invalidates preview cache and preserves artifact integrity.
- Confirm failed/partial/deployment-error paths leave the prior known-good checkpoint unchanged.
- Confirm recovery governance requires the Section 24 runbook whenever recovery-critical implementation changes.



## Section 25 build-status and approval recovery invariants

Recovery invariant reviewed 29 September 2026:
- Build lifecycle stage is durable state. Recovery must preserve the distinction between researching, planning, architecture, generating, persisting, validating, repairing, previewing, browser verification, deployment, monetization, production candidate, and production certified.
- A validated artifact is not production-certified. Snapshot persistence or compile/test success may set project status to `validated`, but only verified production deployment may set `production-certified`.
- Output maturity is independently recorded as structural, runnable, verified, or certified so recovery does not infer maturity from file presence or a generic completed flag.
- `failure_stage` records the stage active when the project enters a failed state, so incident recovery identifies the failing boundary rather than only a generic failure.
- Plan, monetization, and external-integration approvals are persisted before generation. Recovery must not silently approve a plan, enable monetization, or request integration credentials.
- An approval hold preserves the canonical prompt, product contract, selected stack, validated plan, and original paid reservation. Resume reuses that exact persisted context rather than reclassifying the prompt or charging a second reservation.
- A plan revision request is persisted and fed back to Planner before generation resumes.
- AppForge workspace/preview routes are not equivalent to a deployed generated product. Recovery must never present an AppForge shell URL as the generated product's production URL.
- A post-generation file edit invalidates any prior production certification and returns the project to validated production-candidate state until production verification is repeated.

Verification target:
- Confirm a newly created build exposes durable stage transitions and exact output maturity.
- Confirm a validated snapshot is `validated` / `production-candidate`, not `completed` or `production-certified`.
- Confirm production certification occurs only after deployment identity, runtime/HTTP checks, and applicable browser verification succeed.
- Confirm plan, monetization, and integration approval holds occur before Coder generation and can be resumed from the same canonical contract without a second reservation.
- Confirm a plan revision is incorporated before generation resumes.
- Confirm failure state captures the exact failing stage.
- Confirm no fallback live-product URL points to an AppForge application route when no verified generated-product URL exists.


## Section 26 evidence and audit-trail recovery invariants

Recovery invariant reviewed 30 September 2026:
- Project evidence is append-only at both application and database layers. Direct UPDATE/DELETE of evidence rows is rejected; FK cascade cleanup is permitted only as part of deleting the owning project. Recovery must restore prior evidence rows; retries, repairs, redeployments, and self-healing add new evidence and never overwrite earlier events.
- Intake evidence preserves the original prompt, canonical product contract, resolved product intent, and selected technology stack.
- Research evidence preserves the actual queries, accepted and rejected sources, decisions, uncertainty, conflicts, and provider failures used by planning.
- Planning evidence preserves architecture, implementation tasks, requirement mappings, implementation sequence, plan revisions, and approval state.
- Generated source remains authoritative in the versioned working/final artifact stores. Evidence binds those files to project artifact versions, snapshot IDs, integrity metadata, and SHA-256 hashes rather than duplicating mutable source copies.
- Validation, repair, security, integration, monetization, deployment, and certification results are durable project evidence. Failed attempts are evidence and must survive a later successful retry.
- Production certification evidence must identify the exact verified snapshot/version/hash and the deployment verification record. A prior production checkpoint must never certify a different current snapshot after regeneration, repair, or rollback. A production candidate is not production-certified evidence.
- User evidence access remains scoped to the owning project user. Cross-project owner audit access remains protected by server-side `ownerOnlyProcedure`.
- Recovery is incomplete if project evidence, versioned snapshots, recovery checkpoints, or their artifact identities disagree.
- Unresolved validation/security risks shown as current evidence must come from the active current snapshot, not merely the highest-version snapshot. This matters after rollback, when a newer failed snapshot may remain preserved for audit.

Verification target:
- Create a project and confirm intake evidence contains the unchanged prompt, contract, product intent, and selected stack.
- Complete research/planning and confirm queries, sources, decisions, architecture, tasks, and requirement manifest are visible through the evidence bundle.
- Force a validation/repair retry and confirm both the failed validation and repair attempt remain after the later successful validation.
- Confirm versioned generated files remain recoverable from snapshots and match the artifact version/integrity/hash exposed by evidence.
- Exercise monetization/integration approval and deployment paths and confirm their outcomes append evidence without deleting earlier events.
- Confirm a failed deployment retry remains in the trail and a later verified deployment adds separate certification evidence for the exact artifact.
- Confirm an older production-verified checkpoint does not set `productionVerified` for a newer or rolled-back current snapshot unless snapshot ID, artifact version, and SHA-256 all match exactly.
- Confirm direct UPDATE/DELETE attempts against `project_evidence` are rejected while owning-project deletion can still cascade its evidence rows.
- Confirm project users can read only their own audit trail and the admin project-evidence endpoint remains owner-only.
- Exercise self-healing/redeployment and confirm repair, failure, deployment, and certification evidence remains additive across recovery cycles.


## Section 27 certification-logic recovery invariants

Recovery invariant reviewed 30 September 2026:
- Certification is a fail-closed evidence decision, not a synonym for build completion or successful deployment.
- The canonical certification ladder is: structured, generated, runnable, behaviorally verified, deployment verified, monetization verified, production candidate, production certified.
- Structural-only or compile-only stacks may be preserved and recovered as source artifacts, but recovery must never upgrade them to runnable, production candidate, deployed, or production certified without a verified native runtime/toolchain.
- Production certification is product/stack specific. Browser products require verified live HTTP identity plus real browser rendering; service products require verified runtime health endpoints; structural/native outputs require their own native verification before becoming deployable.
- Production certification requires applicable requirement resolution, linked passing behavioral tests, runtime evidence, security evidence, deployment evidence, operational evidence, and recovery evidence for the exact current artifact.
- If monetization was requested, production certification additionally requires same-artifact verified monetization/provider/entitlement evidence. Approval to generate billing code is not monetization verification.
- Missing or stale evidence must keep the project below production certified and record the missing evidence in the certification audit trail.
- Self-healing follows the same certification rules as a normal build. A repaired artifact receives fresh validated and production-verified recovery checkpoints and must be re-certified from its own evidence rather than inheriting the prior artifact's certification.
- Recovery must preserve the exact artifact version and SHA-256 associated with certification evidence. A rollback or repair invalidates certification until the restored/repaired artifact satisfies the certification decision again.

Verification target:
- Confirm a structural-only stack stops at generated/source maturity and cannot become production candidate or production certified.
- Confirm a runnable product with resolved requirements and passing linked behavioral tests can become a production candidate before live deployment evidence exists.
- Confirm browser products fail certification when browser verification is missing even if HTTP deployment succeeds.
- Confirm service products fail certification when required health verification is missing.
- Confirm a monetized product remains production candidate when billing/provider/entitlement verification is absent, even after successful application deployment.
- Confirm verified monetization evidence applies only to the same artifact version.
- Confirm a non-monetized runnable product reaches production certified only when all applicable requirement, behavioral, runtime, security, deployment, operational, and recovery evidence is present.
- Confirm self-healing cannot restore production certified status unless the repaired artifact independently satisfies the same certification rules.


## Section 27 monetization-certification recovery review

Recovery invariant reviewed 30 September 2026:
- A monetized generated product is not production certified from billing-code generation or user approval alone.
- Production monetization verification is tied to the exact current artifact version, snapshot identity, SHA-256, and verified live URL.
- The deployed product must expose its server-side billing health endpoint and report `configured=true`, `verified=true`, and `state=connected` before monetization evidence can satisfy production certification.
- A missing, unreachable, malformed, unconfigured, or provider-failing billing-health response records unverified monetization evidence and leaves the artifact below `production-certified`.
- Recovery, rollback, and self-healing must rerun the same deployed billing verification for the restored or repaired artifact; monetization evidence from an older artifact version must not be inherited.
- Billing-health verification must never accept client-side state, configuration presence alone, route existence alone, or monetization approval as proof that the provider and configured price are working.

Verification target:
- Confirm approval-only monetization evidence cannot certify an artifact.
- Confirm a monetized deployment with failed or unconfigured billing health remains a production candidate and records the failed evidence against that artifact version.
- Confirm a deployed monetized artifact can satisfy the monetization gate only when its billing health reports configured, verified, and connected.
- Confirm a new artifact version cannot reuse the prior version's monetization evidence.
- Confirm self-healing and rollback re-enter the same fail-closed monetization verification path before production certification.


## Section 29 CI and release infrastructure recovery review

Recovery invariant reviewed 1 October 2026:
- Production release evidence is commit-specific. A release may proceed only when the exact current `main` SHA has a successful CI Pipeline run and a successful Security Scanning run.
- Manual production dispatch is not a bypass. It must resolve to current `main`, prove exact-SHA CI/security evidence, and then rerun release validation before deployment.
- Failed, cancelled, missing, stale, or still-running required evidence is not success. The deployment gate must fail closed rather than infer success from branch state or an earlier commit.
- Contract, planner, research, generated-project structure, generated-code completeness/security, isolated-build behavior, and recovery guardrails are explicit CI prerequisites instead of relying only on incidental inclusion in the broad test suite.
- CI and PR-preview artifacts carry a SHA-256 manifest that is verified before the artifact is retained. Missing or mismatched hashes block the gate.
- The PR preview workflow must boot the exact built server and prove runtime liveness. It must not claim a Vercel preview deployment because automatic Vercel Git deployment is disabled in this repository.
- Production deployment must continue to verify that every started production Machine serves the exact release SHA after deployment.

Verification target:
- A failed exact-SHA Security Scanning run blocks both automatic and manual production release.
- A missing exact-SHA CI run blocks manual production release.
- A stale SHA cannot deploy after `main` advances.
- Product-factory validation failure blocks Production Build and the CI Release Gate.
- Artifact-integrity mismatch fails before upload/promotion.
- Preview build/runtime failure fails the preview deployment gate.
- Recovery checks remain mandatory and cannot be skipped by successful unrelated jobs.


## Section 30 Final Product-Factory Flow recovery review

Recovery invariant reviewed 1 October 2026:
- The final customer handoff is governed by one authoritative product-factory verdict, not by a legacy generic `completed` status or a deployment-only success.
- Production readiness requires the validated contract, resolved intent, selected stack, live research, architecture/plan, completed specialist-agent outputs, real persisted source, requirement preservation, placeholder protection, requirement-linked evidence, isolated build/runtime verification, exact-artifact preview/deployment/live verification, requested monetization/entitlement proof, operational monitoring, and recovery evidence.
- The final verdict is fail-closed: a lower-level certification decision cannot make `productionReady` true when an earlier product-factory stage is missing.
- Legacy project status `completed` is not accepted by the build worker as proof that the current attempt reached the validated/certified final flow.
- Any incomplete applicable final-flow step is emitted as an explicit limitation and is included in the project evidence bundle.
- The project may be marked `production-certified` only when the authoritative Section 30 report has `productionReady: true`; otherwise it remains validated/production-candidate.
- Structural-only outputs remain honest source deliverables and expose runtime/deployment limitations instead of being presented as production-ready.
- The final-flow report is bound to the current persisted artifact and exact deployment evidence, so stale artifacts cannot inherit readiness.

Verification target:
- Missing contract, research, plan, coordination, artifact, isolation, deployment, monitoring, monetization, or recovery evidence must keep `productionReady` false.
- The final build event must carry `productionReady`, the full final-flow report, and explicit limitations.
- Project evidence must expose the same report and limitations for customer/admin audit.
- No final-flow code path may restore `completed` as a shortcut to production readiness.


## Production readiness convergence recovery review

Recovery invariant reviewed 1 October 2026:
- AppForge intentionally binds HTTP liveness before database/schema/Redis initialization completes so a dependency outage does not create a process restart loop.
- `/api/health/live` proves only that the HTTP process is alive. It must never be treated as production readiness.
- `/api/health/ready` remains the dependency-aware release gate and may legitimately return HTTP 503 while schema migrations, the application database, or shared Redis are still converging after a blue/green rollout.
- Production verification must therefore poll readiness for a bounded startup window instead of treating the first transient 503 as a permanent release failure.
- Every non-200 readiness response is surfaced in release logs so a persistent failure identifies whether startup, database, or Redis remains unhealthy.
- The gate remains fail-closed: if readiness never reaches HTTP 200 within the bounded window, customer-flow verification, exact-SHA confirmation, and browser verification must not proceed.

Verification target:
- A newly started release may return transient readiness 503 responses without being falsely failed before its dependencies finish initialization.
- A persistent startup/database/Redis failure still fails the deployment.
- Readiness response bodies remain visible in deployment evidence for diagnosis.
- Liveness success alone can never promote a release.


## Gate 1 production authentication lifecycle recovery review

Recovery invariant reviewed 4 October 2026:
- The production authentication lifecycle gate is a manual release-certification workflow, not a recovery mechanism and not a substitute for Supabase authentication backups or configuration recovery.
- The gate intentionally uses fresh real mailboxes/aliases and real production email-confirmation URLs. It must never manufacture, bypass, or persist confirmation tokens in repository history, workflow artifacts, logs, or recovery backups.
- Authentication reliability is not accepted from a single green pass. Each confirmed test account must survive ten logout/relogin cycles, hard reload/reopen checks, ten fresh-browser-context logins, and anonymous protected-route denials.
- The production customer-journey canary additionally re-authenticates ten times while the same build remains active, then reconnects to that same project and requires it to finish without becoming a duplicate or losing ownership/state.
- A separate second fresh hCaptcha token is required to start an independent second production build after the first is certified. The first project must remain production-certified after the second build completes.
- The reusable canary password remains an Actions environment secret, and confirmation URLs are transient inputs that must not be copied into recovery documentation.
- A recovered production environment is not considered authentication/build-continuity ready for paying customers until the repeated auth and build-continuity gates pass on the recovered revision.
- Failure of any required repetition is release-blocking evidence; recovery procedures must fix the underlying production authentication, session, queue, or persistence issue rather than weaken or skip the gate.

Verification target:
- Complete signup + real Gmail confirmation for ten independent fresh aliases/accounts.
- For every confirmed account used in the browser certification, require ten logout/relogin cycles with anonymous state proven after each logout.
- Require ten fresh browser-context logins plus hard reload continuity.
- During a real production build, perform ten logout/re-authentication cycles and prove the same project ID remains accessible and continues normally.
- Reconnect to the original build stream and require production certification.
- Start a second independent build with a different fresh hCaptcha token, require a different project ID, and confirm both products remain production-certified and independently reachable.
- Confirm no confirmation URL, password, access token, refresh token, mailbox credential, or hCaptcha token is committed to Git, uploaded as an artifact, or added to recovery documentation.


## Owner admin SMS MFA recovery invariant — 4 October 2026

- Owner admin APIs are not authorized by owner email alone. A valid short-lived
  admin MFA cookie is also required.
- The browser never chooses the SMS destination. Production uses only the
  server-side `OWNER_PHONE` value, with Twilio Verify credentials retained in
  the deployment secret store.
- The admin MFA cookie is HttpOnly, Secure in production, SameSite=Strict,
  bound to the current AppForge primary access token and browser user agent,
  and expires after a short interval.
- Normal sign-out clears the dedicated admin MFA cookie. A different or newly
  issued primary access token cannot reuse an old admin MFA cookie.
- Recovery must never restore, manufacture, or copy an admin MFA cookie as a
  substitute for a real Twilio verification.
- Logs, Git history, documentation, CI artifacts, and recovery backups must not
  contain the real owner phone number, SMS code, Twilio auth token, or full
  MFA-cookie value.

Verification target:
- After recovery, an authenticated owner without SMS MFA receives no admin data.
- A non-owner cannot request or verify the owner admin challenge.
- A real Twilio Verify challenge goes only to the configured owner phone.
- Wrong, expired, missing, and reused codes do not unlock admin access.
- A successful code creates only a short-lived session-bound admin authorization.
- Logout, a new primary login token, expiry, or a changed browser fingerprint
  requires SMS verification again.
- Production deployment refuses release when any required owner-MFA secret name
  is absent.


### Production admin MFA certification workflow

The repository includes a production browser challenge gate for owner MFA.
Recovery and release certification must preserve this behavior:
- the automated challenge gate authenticates the owner, reaches the locked admin
  screen, and requests a real Twilio Verify SMS to the fixed server-side owner phone.
- the real six-digit code is never accepted as a GitHub workflow input, secret,
  artifact, log value, or repository value.
- final live verification is completed only in a secure interactive browser
  session where the owner enters the code received on the physical phone.
- that interactive proof must confirm admin data is unavailable before MFA,
  available after approval, remains available across a hard reload only within
  the short MFA lifetime, and becomes locked again after logout plus a new login.


### Durable queue and live certification recovery

Production build admission requires BullMQ. Redis-list and process-memory fallback
are development-only; a BullMQ enqueue failure must reject admission and exercise
the existing reservation rollback. A restore must retain the durable Redis queue
and database ledger, then prove accepted jobs resume without another debit.

Owner SMS challenges accept exactly six ASCII digits through the shared schema.
Restoring this validator does not replace the required real Twilio challenge,
rejected wrong/expired/reused codes, or session-bound logout checks.

Production browser gates install the locked verifier from
`scripts/browser-verifier/package-lock.json` independently of application npm
dependencies. Restore both package manifests and the installer. Delivered-email
confirmation, new browser contexts and ten return-login cycles remain mandatory.

Production builds inject Sentry debug IDs into client and server artifacts. Upload
requires SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT. The repository variable
APPFORGE_SENTRY_SOURCEMAPS_REQUIRED=true makes missing credentials block a main
build. Without it, CI emits an explicit unverified-upload warning; such a build
is not evidence of working monitoring or actionable production alerts.


### Dedicated AppForge payment recovery

Recover the dedicated APPFORGE_STRIPE_ACCOUNT_ID, STRIPE_SECRET_KEY and
STRIPE_WEBHOOK_SECRET together, plus the seven AppForge subscription and credit
price secrets. The account behind the key must match before checkout, portal or
webhook processing. Never restore website/marketing credentials into AppForge.

Recreate the webhook subscription including checkout.session.async_payment_succeeded.
Unpaid sessions grant no credits. Completed and delayed settlement share one
PaymentIntent ledger identity. Refunds use current cumulative provider state and
retry when a tagged AppForge credit purchase has not yet been recorded. Paid
subscription invoices grant once from their settled line price, while current
subscription state controls entitlements. Recover the payment ledger with the
credit ledger; replay must not mint another grant or revoke replacement plans.

A dedicated account and live checkout/webhook/database/UI certification are
required before this billing configuration is deployed. Do not treat unit tests
as real-money certification or reuse another product's catalog as a shortcut.


### Shared Stripe account product isolation — 5 October 2026

Recovery invariant:
- AppForge uses the same Stripe account as other independent products; account-level isolation is not required and `APPFORGE_STRIPE_ACCOUNT_ID` must not be restored or reintroduced.
- Recover `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and only the AppForge-owned subscription/credit Price IDs used by AppForge.
- AppForge checkout metadata remains namespaced with `product_line=appforge`; AppForge entitlements and credit records must only be created from AppForge-owned prices and valid settled AppForge payments.
- Stripe events for unrelated products in the shared account must never create, change, cancel, refund, or grant AppForge entitlements/credits.
- The external marketing integration is optional. The catalogue website and every other product are not AppForge runtime, billing, deployment, or recovery dependencies.
- The product-isolation repair/release gates must fail closed if obsolete account-level Stripe isolation or production-facing cross-product coupling is reintroduced.

Verification target:
- Verify all AppForge subscription and credit Price IDs resolve to the intended AppForge products before reopening paid traffic.
- Exercise AppForge checkout, delayed/replayed webhook delivery, refund, cancellation, failed-payment reconciliation, and entitlement/credit idempotency.
- Deliver representative unrelated-product Stripe events from the shared account and confirm AppForge acknowledges/ignores them without mutating AppForge billing state.
- Confirm a deliberately AppForge-marked event with a non-AppForge price fails closed and grants nothing.


## 2026-10-08 authenticated build-entry hotfix
- Signed-out visitors are blocked from the build entry routes and redirected to sign-in before the build UI mounts.
- The server-authoritative owner identity bypasses customer CAPTCHA/moderation/credit gates only for the owner; customer gates remain fail-closed.
- Recovery validation must confirm a restored release preserves both boundaries: unauthenticated build entry remains closed and the verified owner can start a build without a customer CAPTCHA token.

## Signup confirmation and verification recovery — 2026-10-08

See `docs/AUTH_RECOVERY_RELEASE.md`. Initial signup uses server-side Supabase link generation plus Twilio Email; resend uses Supabase Auth SMTP. Restore and verify both delivery paths, the Supabase public/service credentials, trusted HTTPS confirmation origin and shared Redis abuse bucket. A healthy liveness endpoint does not prove these integrations work. Use controlled mailboxes and an immutable release revision for recovery evidence; never persist confirmation links, passwords, session cookies, or private keys in the report.

## Generated artifact preservation

Generation and edit hardening must retain approved source, backend and compliance modules even when the artifact exceeds historical golden file-count limits. Explicit user edits may delete files; automatic cleanup must not silently remove them. The approved-plan code-generation gate remains mandatory and rejects missing planned files. Regression evidence: `iterateReliable.test.ts` and `productHardeningGuardrails.test.ts`.

## Live build display recovery

The build page keeps a bounded recent-activity window and coalesces consecutive streaming chunks by agent. This display policy does not modify persisted event history, Redis delivery or recovery markers. A refresh reconstructs the display from the saved current-attempt events. Regression evidence: `src/lib/__tests__/buildLogView.test.ts` exercises 20,000 chunks, immutable snapshots and newest-failure retention.

## Code generation repair recovery

A code-generation rejection is a failed validation result in the bounded surgical repair loop, not a fatal restart that skips all completed tasks. Persist the rejected artifact and failure evidence before repair. Dependency diagnostics include the current package manifest; repair patches may target existing artifact files or paths owned by the approved plan only. Keep all subsequent compile, test, security and quality gates mandatory. Regression evidence: surgicalFix and productHardeningGuardrails tests.

## Build monitoring request budget

Live updates use authenticated SSE. Poll project status every 15 seconds only while active; stop polling paused, terminal or failed-access builds. Do not retry authentication, ownership or rate-limit rejections. Convert plain middleware HTTP 429 responses into a clear client error instead of a tRPC decoding failure. Preserve every server-side limiter and its existing limits. Regression evidence: `src/lib/__tests__/buildPolling.test.ts`.

## Fly fleet verification recovery — 2026-10-09

Production deployment and scheduled capacity verification share a non-cancelling concurrency group. Neither capacity verifier scales the entire fleet or starts historical stopped machines: those operations revived an old release during a failed blue/green retirement and later raced a deleted-machine lease. Poll for exactly two started app machines with passing health checks and matching image commit labels. The deployment verifier additionally requires the approved release SHA. Missing capacity fails visibly and requires a release recovery; this guard does not claim automatic remediation. Do not use the previous guard to recover a mixed fleet. Retain public readiness, anonymous-access, exact-commit and browser checks after fleet verification. Regression evidence: scripts/verify-fly-capacity.test.mjs (seven adverse/healthy cases).

## Free AI quota recovery — 2026-10-09

Do not retry permanent provider failures, exhausted daily quotas or unavailable quota limits. Respect Retry-After and Gemini RetryInfo delays; a cooldown beyond the bounded inline wait must return the original failure for failover/pause rather than retry early. Gemini quota rejection may select gemini-3.1-flash-lite and gemini-3.5-flash-lite once each using the same configured account key when no explicit model was requested or the internal pipeline allows fallback. No new credentials, paid billing, quality-gate bypass or synthetic generation is introduced. Google rate limits are project/model scoped; confirm active quotas and run a real generated-product journey before paid approval. Regression evidence: llmRetryPolicy.test.ts and llm.test.ts.

### Live browser verifier recovery — 9 October 2026

Production release verification requires the installed stable Chrome supplied by GitHub's Ubuntu runner. The existing mobile shell assertions still run through Playwright's supported Chrome channel; a missing browser or a failed interaction fails the release. This avoids repeating Chromium downloads and system-package installation after a healthy Fly rollout. Other callers of the spec retain the default Chromium selection.

If this gate fails after deployment, distinguish healthy runtime from incomplete release evidence. Preserve the healthy fleet while repairing verifier provisioning or the failing customer interaction, then rerun the exact release checks. Never mark a release verified from an installed-browser version check alone, and do not rerun historical-machine scaling as a browser recovery action.

## Free model availability recovery — 9 October 2026

The existing Gemini key may select each configured free fallback model once after exhausted quota, request timeout or provider 5xx unavailability. Bounded backoff still respects Retry-After; explicit caller model binding remains authoritative unless the internal pipeline opts into fallback. Exhausting every available model pauses the build and preserves its plan. No paid subscription, new account or relaxed validation is a recovery substitute. Regression evidence: llm.test.ts covers successful transient failover, bound callers and all-model exhaustion.

Build workspace recovery must also recognize persisted generated files after refresh. Access to code, preview and terminal must not depend only on an in-memory streaming notification; protected server ownership and artifact integrity checks remain authoritative.

## Production image builder recovery — 9 October 2026

Production deployment builds the same reviewed Dockerfile on the existing GitHub runner using Fly's local Docker builder. Require an available Docker daemon and a bounded twenty-minute deploy step; do not silently fall back to an unavailable remote builder. The Fly registry, existing protected deploy credential, blue/green strategy, exact release SHA and all post-deploy runtime, fleet and browser gates remain mandatory.

This removes the additional Depot builder dependency observed stalled while copying production dependencies. A failed build must leave the previous healthy release serving; it is not evidence that the new revision was deployed. Rerun a trusted exact-SHA release after correcting builder availability, then require matching healthy machine image labels and successful public checks before certification. No new provider account or subscription is required by this change.

### Artifact verification order recovery

Artifact creation and verification use the same locale-independent path ordering. Existing saved hashes and per-file versions are preserved; no artifact is resealed to bypass verification. Mixed-case names such as README.md and lowercase requirement files must verify together after recovery. Working and final artifact regression cases must still reject changed contents, foreign project/version bindings and invalid paths. The live saved-workspace error identified this ordering mismatch; successful source access and the full product journey remain separate release evidence.

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

Verification target:
- Recreate/redeploy exact trusted SHA.
- Rebuild the production Docker builder stage from the trusted SHA before deployment and require it to succeed without relying on developer-machine `node_modules` state.
- Confirm the Docker build uses the repository dependency manifest and lockfile consistently before release.
- Health/readiness/auth-boundary smoke verification.
- After a restore or redeploy, verify every private REST surface still fails closed to anonymous callers before reopening customer traffic.

## Production service availability invariant

Recovery invariant reviewed 16 September 2026:
- AppForge is a revenue-facing production service and must keep at least two Fly app Machines continuously running so one Machine can fail without becoming a total service outage.
- `auto_stop_machines` is disabled in production; `auto_start_machines` remains enabled; `min_machines_running` must remain at least two.
- Production deployment uses blue/green replacement so the previous healthy fleet remains available until replacement Machines pass health checks.
- Fly can transiently leave one successfully health-checked green replacement in a stopped state immediately after blue/green cutover. The production deployment workflow therefore reasserts `app=2`, starts any non-started app Machine, retries fleet reconciliation, and refuses to certify the release unless two app Machines are actually started.
- The scheduled Fly capacity guard independently reasserts count two, retries starts of any non-started app Machine through a bounded recovery loop, and then verifies repeated public liveness. This provides a second self-healing control after deployment rather than relying on one delayed start attempt.
- Recovery must not depend on an idle or post-deploy Machine wake-up succeeding before health, authentication, or billing traffic can be served.
- A restored Fly configuration that re-enables production auto-stop, reduces the minimum below two Machines, removes blue/green replacement, or removes either capacity-reconciliation control is not equivalent to the certified production availability posture and must be reviewed before customer traffic resumes.

Verification target:
- Confirm the deployed Fly service reports at least two started app Machines after every release and recovery.
- Confirm Fly health checks pass for the replacement fleet before blue/green cutover completes.
- Confirm the deployment workflow can recover a replacement Machine that transitions to stopped immediately after cutover and still establishes two started app Machines before release certification.
- Confirm `/api/health/live` remains reachable without requiring an auto-start wake-up.
- Confirm recovery of `fly.toml` preserves `auto_stop_machines = false`, `auto_start_machines = true`, `min_machines_running = 2`, the liveness check, and blue/green deployment.
- Run the Fly production capacity guard to reconcile accidental capacity drift back to two app Machines and fail closed if two started Machines cannot be established.

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
- A failed or incomplete paid build refunds the original reservation with an attempt-specific idempotency key.
- Duplicate queue admission refunds only the duplicate reservation and must not affect the active build reservation.
- If a duplicate job reaches a worker while the same project is already active, the worker uses the same duplicate-refund idempotency key as queue admission before returning. This prevents queue/worker races from stranding or double-refunding credits.
- Terminal build events are persisted before publication so a reconnect can recover the final result even if Redis pub/sub delivery was missed.
- Retry/recovery must never infer billing from the user's current entitlement; it must use the reservation state of the original attempt.

Verification target:
- Exercise duplicate admission through BullMQ, Redis-list fallback, and memory fallback and confirm one active build plus exactly-once duplicate refunds.
- Exercise worker failure and timeout and confirm a persisted terminal error plus exactly-once reservation refund.
- Exercise disconnect/reconnect around terminal publication and confirm persisted terminal replay without duplicate execution or charging.

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

## Stripe

Must be recoverable:
- Product/price identifiers.
- Webhook endpoint configuration.
- Subscription/entitlement mapping logic.
- Required webhook secret recovery/rotation procedure.
- Billing reconciliation procedure.

Verification target:
- Controlled test-mode checkout/webhook path.
- No production secrets stored in repository backup.

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

Any new critical provider, database, deployment target, authentication mechanism, billing dependency, secret-management system, object store, or AI execution environment must be added to this inventory in the same change that makes it production-critical.

If a critical dependency cannot be independently recovered, it must be treated as an unresolved resilience risk.

## Quarterly owner review

Confirm:
- Two independent owner recovery paths.
- Independent backup decryption-key access.
- At least one off-site backup restore succeeds.
- Latest known-good production SHA is recorded.
- Provider ownership and recovery access still work.
- Recovery documentation matches current architecture.
- No discontinued provider remains an undocumented dependency.

This document contains no secret material by design.
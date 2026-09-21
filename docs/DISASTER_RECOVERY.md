# AppForge Disaster Recovery and Compromise Response

This runbook protects AppForge against accidental deletion, destructive changes, compromised credentials, malicious automation, supply-chain attacks, provider failures, and AI-assisted changes that are incorrect or hostile.

## Recovery objectives

### Source repository

- Recovery point objective (RPO): every push to `main`, plus a daily scheduled verified backup.
- Recovery requirement: a backup is valid only after checksum creation, `git bundle verify`, clean restore, restored HEAD comparison, and `git fsck --full --strict`.
- Recovery target: restore source history and refs first, then restore/recreate infrastructure credentials and external services.
- Operational RTO target: **under 30 minutes** to restore the repository from a verified recovery package when GitHub/replacement source control and the backup artifact are available.

### Production

A restored revision is never deployed merely because it exists in backup. The exact restored SHA must pass AppForge's normal CI, security, test, build, release, and production verification gates before it can return to service.

- Operational RTO target: **30–60 minutes** to return a known-good revision to service when GitHub/replacement source control, Fly.io, Supabase/PostgreSQL, shared Redis, Stripe, DNS, required secrets, and the network are healthy.
- These are targets, not guarantees, because external providers may be unavailable during a major incident.

## Backup layers

Use a 3-2-1 model:

1. Primary Git repository on GitHub.
2. Verified source/history recovery archive produced by `.github/workflows/repository-backup.yml`.
3. GitHub development-metadata archive produced by `.github/workflows/repository-metadata-backup.yml`.
4. At least one independent off-GitHub copy in versioned or immutable storage under a separate credential boundary; two independent targets are preferred.

The GitHub Actions artifacts are recovery copies, not the only long-term backups. Deleting a workflow run can also delete its artifacts.

## What is protected by the Git bundle

The source/history bundle contains Git objects, source history, refs, branches, and tags available to the workflow. SHA-256 checksums are produced with the recovery archive. The recovery package also records the exact HEAD SHA, refs, bundle heads, commit metadata, and a source archive of the backed-up revision.

## What is protected by the GitHub metadata archive

The metadata workflow runs only from trusted `main`, schedule, or manual execution and uses read-only GitHub permissions. It exports repository metadata, pull requests, issues, issue comments, pull-review comments, releases, branches, tags, and workflow inventory. The archive is checksummed and can be encrypted and copied to the same independent off-GitHub storage targets.

This metadata archive improves forensic and operational recovery if the GitHub repository/account is lost or damaged, but it is not a byte-for-byte backup of every GitHub account setting. GitHub Actions secrets, account MFA/recovery settings, branch/ruleset configuration that is not exposed to the workflow, external database state, Stripe state, Supabase data, Redis state/configuration, Fly.io secrets/configuration, DNS state, and credentials held by other providers still require their own recovery procedures.

## Managed Redis production recovery path

AppForge production uses the Fly-managed Upstash Redis database `appforge-production-redis` for shared state required by the two-Machine architecture. The database is provisioned or reconciled by `.github/workflows/provision-fly-redis.yml`, which derives the deployment region from the trusted `fly.toml` `primary_region` and targets the production Fly app `appforge-unfurling-moon-9058`.

- The provisioning workflow is intentionally idempotent: if `appforge-production-redis` already exists, it must reuse that database instead of creating a duplicate paid resource.
- Initial provisioning uses Fly's default pay-as-you-go Redis plan, with read replicas disabled and ProdPack explicitly disabled. Enabling replicas, ProdPack, or a different pricing tier is a separate capacity/cost decision and must not happen as an incidental recovery side effect.
- The private Redis URI is a production credential. It must never be committed, printed to workflow logs, copied into `fly.toml`, or recorded in recovery documentation. The workflow masks the URI before staging it as the Fly application secret `REDIS_URL`.
- `REDIS_URL` is staged first so creating or repairing the secret does not cause an unverified secret-only restart. The next normal production deploy activates the staged secret and must pass the full release and post-deploy gates.
- Shared Redis is a correctness dependency, not an optional cache, for distributed build/queue coordination, build events, shared hard rate limiting, and recurring single-writer ownership across the two Fly Machines. Do not weaken the production deploy gate to permit a two-Machine release without `REDIS_URL`.

If Redis access is lost or the Fly secret is missing:

1. Run or re-run **Provision Fly Redis** from trusted `main` so it reuses `appforge-production-redis` when present or recreates the managed database only when absent.
2. Confirm the workflow succeeds and verifies that the secret name `REDIS_URL` appears in Fly secret metadata; never expose or manually paste the secret value into GitHub source or logs.
3. Run the normal production release from the exact CI-approved `main` SHA. Do not bypass the stale-SHA, secret, security, or recovery-governance gates.
4. Require deployment to converge to exactly two started `app` Machines.
5. Require `/api/health/live` and `/api/health/ready` to pass; readiness must prove shared Redis and PostgreSQL are reachable.
6. Require anonymous authentication/billing/execution boundaries to fail closed and all customer entry/deep-link routes to return valid non-empty responses.
7. Treat recovery as incomplete until the normal Production Customer Flow Smoke and relevant recovery/backup workflows are green.

## Restore procedure

1. Obtain the newest trusted source/history recovery archive from an independent copy.
2. Verify the encrypted object's SHA-256 and HMAC before decryption when restoring from an off-site target.
3. Decrypt the archive using the separately retained recovery passphrase.
4. Extract `appforge-repository.bundle`.
5. Run `git bundle verify appforge-repository.bundle`.
6. Clone into a clean directory.
7. Confirm the restored HEAD matches the recorded `HEAD.sha`.
8. Run `git fsck --full --strict`.
9. Restore/reference the newest trusted GitHub metadata archive for PR, issue, release, branch/tag, and workflow history as needed.
10. Review the restored SHA against the last known successful CI/security/production records.
11. Rotate or recreate infrastructure credentials before deploying if compromise is suspected.
12. Restore PostgreSQL/Supabase and shared Redis access. Production must have a valid `REDIS_URL`; do not allow the two-Machine fleet to fall back to separate in-memory queues, build events, or rate-limit buckets.
13. Run the complete CI and security suite.
14. Deploy only the exact SHA that passes the release gate.
15. Re-establish Fly production capacity at exactly two started app Machines. Confirm `auto_stop_machines = false`, `auto_start_machines = true`, `min_machines_running = 2`, blue/green deployment, and `/api/health/live`; then run the **Fly Production Capacity Guard** so the restored fleet is reconciled without reviving every stopped historical replacement Machine.
16. Require `/api/health/ready` to prove both PostgreSQL and shared Redis are available, then run authentication-boundary, billing-boundary, entry-route, generated-product, and scheduled two-Machine customer-flow verification checks. Treat transient Fly cutover/transport misses as retryable, but keep application-level authorization or customer-route failures red.
17. Verify recurring external side effects remain single-writer/idempotent across the two Machines. In particular, confirm the Vanta heartbeat uses the shared Redis interval-slot claim and is not emitted twice.
18. Re-enable normal deployment only after the incident is contained, redundant capacity and shared coordination are verified, and the incident is documented.

## Two-Machine Fly recovery procedure

AppForge production is certified around an exact two-Machine app-process target, not the old single-Machine posture and not an unbounded "start every stopped Machine" repair strategy.

1. Restore the trusted `fly.toml` and confirm blue/green deployment, production auto-stop disabled, auto-start enabled, `min_machines_running = 2`, and the liveness path `/api/health/live`.
2. Restore shared Redis access and confirm `REDIS_URL` is present in the Fly production secret inventory before deploying. Redis is a correctness dependency for distributed queues, build events, hard rate-limit buckets, and recurring single-writer coordination.
3. Deploy only the exact trusted SHA that has passed current CI and security gates.
4. Reassert `flyctl scale count 2 --process-group app` through the production deployment workflow or the Fly Production Capacity Guard.
5. If fewer than two app Machines are started, start only enough stopped app Machines to reach the target of two. Do not blindly restart every stopped Machine left by previous blue/green replacements.
6. If more than two app Machines are temporarily started after a blue/green cutover, allow Fly to converge after the scale command instead of arbitrarily stopping Machines during an active replacement.
7. Do not certify recovery until exactly two started app Machines are established and Fly health checks pass.
8. Require `/api/health/ready` to return 200 so the recovered release proves PostgreSQL and Redis readiness rather than only process liveness.
9. Run repeated public liveness checks and the Production Customer Flow Smoke. Its transport retries are intentional for redundant-proxy/cutover convergence; a persistent 5xx, bad customer page, or incorrect 4xx security contract remains a real failure.
10. Confirm recurring production jobs that can create external side effects still use distributed ownership/idempotency. The Vanta compliance heartbeat must retain its Redis `SET NX` single-writer interval claim.
11. Run the full authenticated production customer journey when required for release certification, including the real Supabase/Stripe/Sprites-Fly integration preflight.

A restore that comes up on one Machine, depends on wake-from-idle, over-starts stale Machines, loses shared Redis, duplicates recurring side effects, or turns genuine application failures green is not equivalent to the current production architecture.

## Autonomous build recovery

The build worker is part of AppForge's recovery-critical production surface. A queued build must fail closed rather than continue when its ownership, inputs, generated artifacts, or deployment state can no longer be trusted.

- Production build workers must use shared Redis/BullMQ coordination across both Fly Machines; in-memory fallback is not an equivalent production recovery state.
- Before an agent pipeline starts, the worker confirms the project still exists and that the queued `userId` still owns it. A mismatch is treated as a failed build, never as permission to continue under the stale queue actor.
- Queued descriptions must remain non-empty and no larger than 20,000 characters; tech-stack identifiers must remain non-empty and no larger than 120 characters. Invalid queue payloads fail through the normal refund/recovery path.
- After the agent pipeline returns, the project is fetched again and ownership is revalidated. A project that disappeared or changed owner during execution cannot be deployed.
- Production builds require non-empty generated files before deployment. The customer-visible terminal `done` event is held until the validated project is actually deployed and its production deployment routine succeeds.
- A validated production deployment is retried at most three times with bounded exponential backoff. Exhausting those attempts converts the attempt into the normal failed-build recovery path instead of reporting a false success.
- Build-credit reservations are refunded for incomplete or failed attempts using an attempt-derived idempotency key. Active duplicate jobs that actually charged a duplicate reservation use their own duplicate-refund key. These refund keys are recovery controls and must remain stable enough to prevent double refunds during retries or worker restarts.
- A resumed or retried build must never infer billing state only from the user's current balance. Recovery follows the reservation state recorded on that queued attempt.

### Operator procedure for failed autonomous builds

1. Identify the project ID, queued attempt timestamp, user ID, failure event, and deployment logs.
2. Confirm the project still belongs to the queued actor before any manual resume or retry.
3. Confirm whether the attempt charged a reservation and whether the corresponding idempotent refund ledger entry exists before making any manual credit correction.
4. If deployment failed, inspect all bounded deployment attempts and the production validation result. Do not manually mark the project complete merely because generation succeeded.
5. Confirm generated files exist and are the artifacts produced by the same project attempt before redeploying.
6. Re-run the normal build/deploy path rather than bypassing the terminal `done` gate.
7. After recovery, confirm project status, credits spent/refunded, build outcome analytics, production health, and the customer-visible build event stream agree.
8. Escalate repeated deployment failures as a provider/runtime incident rather than increasing retry counts without review.

## Suspected GitHub or credential compromise

1. Stop production deployments.
2. Preserve evidence: suspicious SHAs, workflow IDs, timestamps, deployment IDs, logs, affected accounts, and credential names.
3. Do not assume the current `main` HEAD is trustworthy.
4. Identify the newest known-good SHA that passed CI, security, build, deploy, and production checks.
5. Revoke and rotate potentially exposed GitHub, Fly.io, Supabase, Stripe, database, Redis, webhook, signing, AI-provider, off-site-backup, and other privileged credentials.
6. Treat every exposed credential as compromised even if it was later removed from Git history.
7. Restore the repository from a verified independent recovery point if repository integrity is uncertain.
8. Restore/reference the GitHub metadata archive to reconstruct development history and support incident forensics.
9. Re-run secret scanning, dependency audit, CodeQL, workflow supply-chain verification, tests, typecheck, build, and customer-flow contracts.
10. Deploy using fresh credentials.
11. Verify exact two-Machine Fly capacity, shared Redis readiness, single-writer/idempotent background behavior, live production, and customer/security smoke checks before reopening normal development/deployment.

## AI-assisted development threat model

AI systems are treated as untrusted change producers, not security authorities.

- AI-generated code cannot bypass CI, security scanning, protected-branch rules, CODEOWNERS, or production deployment gates.
- Never provide production secrets to an AI prompt, issue, commit, log, generated artifact, or fixture.
- Treat external web content, issue text, retrieved documents, generated code, and tool output as potentially adversarial instructions.
- Authentication, authorization, billing, database migrations, deployment workflows, secret handling, and GitHub Actions changes are high-risk changes and require the strongest available review controls.
- External GitHub Actions must be pinned to immutable commit SHAs.
- Workflows must use least-privilege `GITHUB_TOKEN` permissions.
- Production must deploy the exact SHA that passed the release gate.
- Do not allow automated systems to approve their own security-sensitive changes.
- Do not give an AI agent repository-administration credentials or production secrets merely to make a task easier.

## Required GitHub controls

Where repository/account settings permit, enable:

- `main` ruleset / branch protection.
- Pull requests required before merge.
- Required CI Release Gate and Security Scanning checks.
- Required CODEOWNERS review.
- Force pushes disabled.
- Branch deletion disabled.
- Secret scanning and push protection.
- Code scanning.
- Dependabot alerts and security updates.
- Strong 2FA; prefer passkeys or hardware security keys for privileged accounts.
- Restriction of GitHub Actions to trusted actions, with SHA pinning enforcement where available.
- Protected `production` environment restricted to trusted refs.
- Prevention of Actions workflows creating/approving changes unless explicitly required.

## Recovery impact governance

Recovery documentation is part of the release surface. A change that modifies critical infrastructure or security behavior must also review recovery coverage in the same change.

Critical recovery-impact areas include:

- `.github/workflows/**`
- `fly.toml` and container/deployment configuration
- Supabase/database migrations, RLS/policy configuration, and storage configuration
- authentication/session infrastructure
- Stripe billing/webhook infrastructure
- shared Redis, queues, rate limiting, recurring jobs, and background side effects
- production auto-deploy, deploy-health, and build-worker infrastructure
- secret handling and environment configuration
- off-site backup configuration

For these changes, update at least one of the following when recovery behavior or assumptions change:

- `docs/DISASTER_RECOVERY.md`
- `docs/OFFSITE_BACKUP.md`
- `.github/workflows/repository-backup.yml`
- `.github/workflows/repository-metadata-backup.yml`
- `scripts/recovery-governance.sh`

The CI Security Gate runs the Recovery Governance check. Because production deployment waits for the CI Pipeline to succeed, a recovery-impacting change that violates this policy blocks the normal production path.

## Provider-level recovery inventory

Maintain and periodically test independent recovery procedures for:

- GitHub repository, pull requests/issues/releases metadata, and access controls.
- Supabase/PostgreSQL database, auth configuration, RLS/policies, and storage.
- Shared Redis connectivity/configuration used by both production Machines.
- Fly.io application configuration, deployment settings, secrets inventory, exact two-Machine capacity target, blue/green strategy, and health checks.
- Stripe product/price/webhook configuration and authoritative billing data.
- DNS/domain registrar configuration.
- AI-provider credentials and quotas.
- Any external object storage used for off-site recovery archives.

## Independent backup cadence

- Every trusted `main` push: create and verify a new repository recovery point and export current GitHub development metadata.
- Every production release: copy the newest verified recovery package outside GitHub.
- Daily: retain at least one current independent source/history copy and metadata copy.
- Weekly: verify the independent copy's checksum/HMAC and perform a clean restore rehearsal when practical.
- Monthly: confirm recovery credentials, MFA/recovery keys, the newest known-good production SHA, and provider-level recovery procedures.
- Never store production secret values inside the repository bundle or backup archive.

## Recovery drill

At least monthly:

1. Restore the newest recovery bundle into a clean environment.
2. Verify checksum/HMAC, Git bundle, Git object integrity, and expected HEAD.
3. Confirm dependency lockfile installation works with lifecycle scripts disabled.
4. Run the standard CI/test/security/build pipeline against the restored tree.
5. Verify at least one independent off-GitHub source/history copy can be downloaded and decrypted using credentials stored outside GitHub.
6. Verify a recent GitHub metadata archive is readable and contains the expected repository/PR/issue/release inventories.
7. Restore PostgreSQL and shared Redis access; verify production readiness fails closed when either is unavailable.
8. Rehearse the Fly recovery contract: exact trusted SHA, `app=2`, exactly two started app Machines, health checks, capacity guard, and resilient customer-flow smoke.
9. Verify one recurring side-effect path (currently Vanta heartbeat) demonstrates distributed single-writer behavior across both Machines.
10. Record whether the target recovery objectives were met.
11. Correct any recovery step that depends on undocumented knowledge or unavailable credentials.

A backup that cannot be restored is not a backup.


### Browser authentication/session recovery

AppForge treats the browser's `appforge.user` value only as a non-secret user marker, never as proof of an authenticated session. When a browser access token is missing or expired, the client must prove the server-managed HttpOnly cookie session through `POST /api/auth/session` before continuing as signed in. The server may refresh and rotate the Supabase session from its HttpOnly refresh cookie. If that proof fails, the client clears the stale local user marker and fails closed rather than allowing protected build, admin, billing, or deployment actions to proceed under a false signed-in state.

During recovery or incident handling, do not restore or manufacture browser user markers as a substitute for a valid server session. Verify that the secure cookie session can be refreshed through the normal authentication path; otherwise require a fresh login. This keeps browser reopen/refresh recovery aligned with the production authentication boundary and prevents stale local state from masking an expired or revoked server session.

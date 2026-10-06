# AppForge Recovery and Rollback Runbook

This runbook is the operational contract for Section 24 — Recovery and Rollback.
It complements `DISASTER_RECOVERY.md`, `OWNER_BREAK_GLASS.md`, and
`RECOVERY_INVENTORY.md`. Never place secrets, recovery codes, private keys, or
live credentials in this document.

## Recovery invariants

1. A build snapshot is immutable recovery evidence. Working or partial files are
   never promoted as a rollback target.
2. Every validated known-good checkpoint records the project, snapshot ID,
   artifact version, and the snapshot's persisted SHA-256.
3. A production-verified checkpoint additionally records the deployment
   contract version, deployment-manifest SHA-256, and verified HTTPS live URL.
4. A checkpoint is written only after its snapshot/version/hash relationship is
   revalidated against persisted snapshot state.
5. Production verification never overwrites the underlying validated checkpoint;
   it adds a stronger production-verified recovery point for the same artifact.
6. Rollback activates the exact stored snapshot through
   `markSnapshotAsCurrent`. It must not manually copy files or independently
   toggle snapshot flags.
7. Partial generation, failed validation, failed deployment, or failed preview
   must not replace the last known-good checkpoint.
8. Credit refunds use attempt-specific idempotency keys. Recovery must not
   charge or refund from a user's current entitlement state.
9. Database restore and migration recovery are separate from application
   snapshot rollback and must follow the verified backup/migration procedure.
10. No recovery action is complete until health, authorization, artifact
    identity, and applicable customer-flow checks pass.

## Known-good recovery points

Two checkpoint levels are stored in `recovery_checkpoints`:

- `validated_artifact`: the immutable final snapshot passed AppForge's product
  validation gates and is safe to restore as source/artifact state.
- `production_verified`: the same snapshot was deployed and passed production
  identity plus runtime/browser or HTTP verification. It stores
  `deployment_version`, `deployment_manifest_sha256`, and `live_url`.

The tuple `project_id + artifact_version + source` is unique. Recording the
same checkpoint again updates that checkpoint rather than creating ambiguous
duplicates.

## Recovery matrix

| Failure | Safe recovery |
| --- | --- |
| Application failure | Restore the latest known-good checkpoint, verify integrity, then rerun normal release verification before reopening traffic. |
| Artifact corruption | Reject the corrupt artifact. Restore the latest checkpoint whose stored SHA-256 matches its immutable snapshot. |
| Database failure | Restore a verified database backup into an isolated recovery target, verify schema/data/RLS/auth invariants, then promote deliberately. |
| Migration failure | Roll back only when the migration is explicitly proven reversible; otherwise roll forward with a corrective migration. |
| Queue interruption | Restore Redis/BullMQ availability. Durable queued work may resume; persisted terminal build events are replayed after reconnect. |
| Interrupted build | Retry/resume the queued attempt only from persisted canonical build context. Partial working files never become current. |
| AI/provider failure | Pause or fail closed, refund an incomplete paid reservation exactly once, restore provider availability/credentials, then retry deliberately. |
| Deployment failure | Use bounded deploy retries. Keep the previous production-verified checkpoint as the recovery target; do not mark the failed deployment known-good. |
| Preview failure | Invalidate preview state and read from the current immutable artifact. Restore the latest known-good checkpoint if the current snapshot itself is invalid. |
| Credit refund problem | Reconcile the idempotent credit ledger before another refund/retry; never issue a second blind refund. |
| Duplicate build | Reject the duplicate queue/worker attempt and refund only its reservation using the duplicate attempt key. |
| Partial generation | Keep partial files as working state only. Do not expose them as hosted, downloadable, deployable, or rollback-ready output. |
| Paused build | Resolve the pause cause, then resume/retry from the persisted prompt/contract/stack; do not reclassify the original prompt. |

## Owner emergency procedure

Use this when customer safety, data integrity, billing integrity, or production
availability is at risk.

1. Freeze new deployments and destructive administration.
2. Identify the incident boundary: application, generated artifact, database,
   migration, queue, provider, deployment, preview, billing/refund, or account.
3. Preserve logs, deployment audit data, the current checkpoint record, and the
   exact current `main` SHA before changing state.
4. Select the newest recovery point whose evidence is appropriate:
   - `production_verified` for production rollback;
   - `validated_artifact` for source/artifact recovery.
5. Confirm the checkpoint snapshot still belongs to the project and its
   persisted artifact SHA-256 matches the checkpoint.
6. Activate the snapshot only through the atomic snapshot activation path.
7. For database incidents, follow the database restore/migration procedure
   instead of trying to repair data through an application snapshot.
8. Rotate credentials when compromise is possible.
9. Run CI/security/build plus health/readiness/authorization and relevant
   customer-flow checks.
10. Reopen traffic only after the recovered state is verified. Record what was
    restored, the checkpoint/version/hash used, and any follow-up repair.

## Generated-product rollback procedure

1. Read the project's latest `production_verified` checkpoint.
2. Confirm `snapshot_id`, `artifact_version`, and `artifact_sha256` agree
   with the immutable snapshot.
3. Activate that snapshot atomically.
4. Rebuild/redeploy from the exact snapshot bytes. Do not use working files.
5. Require the deployment identity endpoint to report the exact artifact
   SHA-256.
6. Require runtime health and browser/HTTP verification.
7. Create/update a production-verified checkpoint for the recovered deployment.
8. Keep the newer failed artifact available for diagnosis, but not current.

For source-only/structural products, use the newest `validated_artifact`
checkpoint and rerun the native/runtime verification required by that stack
before treating it as production-ready.

## Database and migration restore

1. Stop writes that can worsen divergence.
2. Identify the last verified backup and the migration level expected by the
   selected application SHA.
3. Restore to a separate recovery database first.
4. Apply versioned migrations in order.
5. Verify constraints, tenancy/RLS, authentication, critical row counts, and
   billing/replay ledgers.
6. If a migration failed, use rollback only when its reversal is tested and
   safe. Otherwise use a forward corrective migration.
7. Point a controlled recovery environment at the restored database and run
   health plus customer-flow verification.
8. Promote only after evidence passes. Never overwrite the only good backup.

## Queue and interrupted-build recovery

Production uses shared Redis/BullMQ. Restore shared coordination before
declaring the worker fleet recovered.

- BullMQ/Redis state is authoritative for queued execution; persisted project
  contract/prompt/stack is authoritative for build meaning.
- A stale or invalid queue payload is rejected and settled rather than repaired
  from free text.
- Terminal build events are persisted before pub/sub publication, allowing a
  reconnect to recover `done` or `error` state.
- A worker/deployment failure refunds the original paid reservation with its
  attempt-specific key.
- A retry must never promote partial working files or silently create a second
  paid build.

## Production account-lifecycle recovery

The production account-lifecycle gate is itself a recovery-critical control.
After an auth outage, Supabase configuration change, cookie/session change, or
production redeploy, AppForge must not be treated as customer-ready until the
real production lifecycle is re-proven.

- A fresh signup must request a real confirmation email.
- The confirmation link must be consumed out-of-band; confirmation URLs and
  tokens must never be written to GitHub comments, logs, artifacts, or source.
- A confirmed account must complete normal login and logout/relogin boundaries.
- A hard reload must preserve the active browser session.
- Removing the browser bearer token while preserving the HttpOnly cookie session
  must recover authentication through the server session endpoint; a stale local
  user marker alone is never accepted as proof of authentication.
- Logout must close protected routes before the next login.
- The full live gate may generate a one-time masked test password in memory so
  recovery verification does not depend on a long-lived test password secret.
- If any phase fails, account lifecycle remains uncertified and customer launch
  stays blocked until the underlying auth/session problem is fixed and the same
  gate passes again.

Recovery verification target:
- fresh production signup;
- real email confirmation;
- login;
- hard-reload persistence;
- forced HttpOnly-cookie session recovery after bearer removal;
- logout with anonymous protected-route denial;
- repeated relogin and fresh-browser-context recovery.

## Data-recovery verification checklist

Before declaring recovery complete:

- snapshot ownership verified;
- artifact SHA-256 verified;
- deployment version and manifest hash recorded when production verified;
- database restore/migrations verified where applicable;
- shared Redis/queue healthy;
- no duplicate active build;
- refund ledger reconciled;
- health and readiness pass;
- protected routes still fail closed anonymously;
- account signup/confirmation/login/logout/session recovery passes when auth or session controls were affected;
- generated-product identity matches the selected artifact;
- browser/HTTP production verification passes;
- owner records the recovered SHA/checkpoint and incident outcome.

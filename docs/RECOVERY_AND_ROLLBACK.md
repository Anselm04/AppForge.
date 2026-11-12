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

### Production image rebuilds after the Vite 8 migration

Recovery review (31 October 2026): the Alpine builder uses Vite 8's locked
Rolldown platform binding, installed by `npm ci --ignore-scripts`. Do not restore
the old manual Rollup binary installation: Rollup is no longer in the dependency
tree, so that step prevents production and recovery images from building.
Rebuild the production Docker target and pass its privilege-drop and fail-closed
startup checks before treating a rebuilt image as a recovery candidate. The
exact-SHA CI/security requirements, blue/green deployment, two-machine capacity,
health, authorization, and release-identity checks remain required. This build
change does not alter runtime secrets, persisted data, or migration recovery.

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

### Interrupted planning recovery

A recoverable interruption in research, planning, or architecture with no saved
product plan may retry planning from the persisted prompt/contract/stack. This
does not approve generation: the pipeline must save a plan and enforce plan,
monetization, and integration approvals before generating files. When a plan is
already saved, the normal approval/revision controls remain required. Cancellation,
missing credentials, and credit exhaustion do not qualify for this retry.

Roll back the application revision if recovery behavior regresses. No schema or
credential migration is introduced by this repair.

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

### Validated checkpoint truth — 15 October 2026

A successful generated-product validation may record a `validated_artifact`
checkpoint, but that checkpoint is recovery material only. The build worker must
keep `recoveryVerified` false until AppForge has fresh evidence that the exact
artifact can be restored/reopened and the required recovery verification passes.
Creating or persisting a snapshot is not itself restore proof and must never
promote the final product factory flow to a recovered or production-ready state.

Recovery verification target:
- select the exact stored checkpoint and verify project/snapshot/version/hash identity;
- restore or reopen the artifact through the supported recovery path;
- rerun applicable runtime, health, authorization, and customer-flow checks;
- record recovery as verified only after those checks succeed;
- preserve the prior known-good checkpoint if restore/reopen verification fails.

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

## Flutter qualification evidence boundary

The Flutter + Node qualification workflow is a recovery-critical evidence gate
for mobile runtime maturity. It must pin an official Flutter release identity,
verify that identity against the expected commit, preserve qualification logs and
artifacts, and fail closed when dependency, build, runtime, or interaction proof
cannot be produced.

A green trusted-shell qualification is evidence only for the exact scaffold,
runner, Flutter/Xcode/Android tooling, and interaction path exercised by that run.
It does not by itself promote arbitrary generated mobile products, authentication,
persistence, notifications, voice, background work, signing, deployment, store
release, or Golden Product behavior to verified or production-certified status.
If the qualification workflow regresses, keep the last known-good product/runtime
classification and repair/re-run the evidence gate before promoting mobile
maturity.

### Android trusted-fixture recovery review — 16 October 2026

Android qualification must fail closed unless the exact trusted fixture builds a
non-empty debug APK, boots an emulator to an ADB-ready and completed-boot state,
installs and launches the app, reaches the real Node backend through ADB reverse,
passes the Flutter integration test, and preserves the resulting evidence
artifact. KVM permission may be enabled on the hosted runner when `/dev/kvm` is
present and usable; otherwise the workflow may use its bounded software fallback.
A failed or incomplete Android run must retain the previous known-good mobile
maturity classification and must not be treated as runtime, release, signing, Play
Store, or arbitrary generated-product certification.

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


## AppForge USD subscription and Aftercare Plus billing recovery (9 November 2026)

**Financial source of truth:** The owner-approved new monthly charges are
Starter USD 79, Builder USD 199, Studio USD 499, Enterprise from USD 2,499
by individual contract, and optional Aftercare Plus USD 19. Essential aftercare
remains included in paid plans. New Stripe Prices belong to the AppForge product
line, are monthly and USD, and include exclusive tax behavior. Existing
subscriptions with legacy prices must not be silently repriced.

**Safe rollback of this change:** A code rollback must not delete or overwrite
paid Stripe subscription records, cancel a customer subscription, drop the new
`subscriptions.aftercare_plus` column, or remove the idempotent invoice ledger.
If an add-on fulfillment defect is found, stop new affected checkout sessions
while correcting the webhook handler, then replay verified settled Stripe
events using their original event/invoice IDs. The versioned additive schema
migration remains in place; do not edit applied migration checksums.

**Paid customer reconciliation:**
1. Inspect the actual Stripe customer, subscription, itemized recurring Price
   IDs, invoice lines, currency, quantity, billing period, taxes, and paid status.
2. Confirm exactly one recognized AppForge base plan. A distinct Aftercare Plus
   line is optional and must be quantity one at exactly USD 19/month.
3. Compare the approved Plan Price ID to the new subscription. Existing
   contracted legacy prices are handled separately, without silently charging
   the customer more or granting additional unapproved credits.
4. Verify the invoice is settled before granting monthly build/provider credits.
   The $19 Aftercare Plus invoice line must never trigger additional base-plan
   build credits.
5. Verify `subscriptions.aftercare_plus` matches the **current** paid/trialing
   Stripe subscription item; on cancellation it must become false. Check both
   directions: paid-without-access and access-without-payment.
6. Reconcile retries by Stripe event/invoice identity, not by timestamps or
   inferred billing metadata. Refunds, chargebacks, payment failures, price
   migrations, add-on cancellation and proration need evidence-based handling.
7. Present tax and optional third-party usage costs separately and conspicuously
   before authorizing checkout; never represent an amount as tax inclusive when
   the configured Price is exclusive.
8. Before announcing commercial readiness, verify live end-to-end signup,
   checkout, fulfillment, renewal, payment failure, cancellation, portal plan
   changes and add-on removal without double charges. Customer-build cost
   controls and delivery readiness must be verified independently.

**Operational audit fields:** Stripe Price IDs for each plan and add-on,
subscription ID, customer ID, invoice ID, event ID, currency, line item totals,
tax, payment status, plan entitlement, add-on entitlement, and customer-facing
acknowledgement. Do not log card details, raw API keys, customer passwords or
Stripe signatures. The public approved price IDs are identifiers, not
credentials.

**Live-price catalogue changes:** Making a legacy Price inactive must never be
misrepresented as cancelling an existing subscription. Before archival verify
the old Price is not used for new authorized checkout and preserve historic
invoice records. Never force-update existing Stripe subscriptions to new prices
without explicit customer notice and contractual/legal justification.

Billing qualification note: The new Stripe price IDs and optional Aftercare Plus item are not customer subscriptions until a real, authorised checkout has completed. CI cannot substitute for paid end-to-end confirmation. Existing subscriptions retain prior billing contracts unless the customer agrees to a migration.


## Engineering Verification Record and preview identity recovery (12 November 2026)

This review covers the customer-facing preview route and post-build security evidence changes in PR #327. The existing immutable snapshot and checkpoint mechanism remains authoritative; no new recovery database or remote deployment is introduced.

1. Before accepting preview success, verify the served boundary identifies the currently persisted snapshot ID, artifact version and SHA-256, and that the runtime returns a successful non-empty response. An unreachable, redirected-to-login, mismatched, or otherwise invalid runtime **must not** be marked preview-verified.
2. If verification fails, record a failed deployment/preview evidence event for that artifact, return an actionable error to the customer, and preserve all saved working files and the current immutable snapshot. Do not substitute a generic placeholder or synthetic screenshot to obtain passing evidence.
3. Post-build security scans must inspect the final persisted artifact files and record findings bound to that immutable snapshot identity. A critical/high blocking finding stops certification. Preserve evidence and require a repaired, newly validated snapshot; never edit the original checkpoint in place to conceal the finding.
4. A subsequent edit or repair creates a different artifact identity. Older security, preview, and production verification evidence must not authorize the new revision. Re-run the relevant tests and probes, with actual execution results.
5. For rollback, select the newest appropriate validated-artifact or production-verified checkpoint, verify its saved SHA-256, and activate it only through the existing atomic `markSnapshotAsCurrent` path. Confirm ownership, authorization, runtime, and current identity before exposing a recovered preview or reopening customer traffic.
6. During verification failure or recovery do not invoke Fly.io or reactivate retired hosting credentials. The source-level work proceeds on the local/provider-independent runtime; customer production deployment remains a separate, explicit, authorized operation.
7. Verify recovery by deliberately presenting a stale or mismatched artifact identity, a stopped preview runtime, and a blocking security scan, then confirm no false passing verification status or replacement of a known-good snapshot. Preserve those test results with the exact commit SHA.

The customer Evidence tab shows derived verification from recorded snapshots and events. It cannot, by itself, prove native Flutter compilation, app-store acceptance, billing, or million-user capacity. These require their own executed evidence and are intentionally left unverified when absent.

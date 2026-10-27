# TrillionAI Manager → AppForge

The dedicated service API is mounted at `/integrations/manager`. It delegates to AppForge's existing protected project procedures. It does not duplicate generation, deploy customer code directly, or grant administrative account access.

## Configure the existing AppForge deployment

Set these server-side variables through the existing host secret/configuration manager:

- `APPFORGE_MANAGER_TOKEN`: a dedicated random bearer token, at least 32 characters. Use a separate credential from browser sessions and the Marketing bridge.
- `APPFORGE_MANAGER_USER_ID`: the numeric AppForge company-owner user ID in AppForge's application database. This is not a Supabase Auth UUID. The service checks the database identity, owner email, ban state and account lifecycle.
- `APPFORGE_MANAGER_SCOPES`: defaults to `read`. Operational scopes are `build`, `plan`, `repair`, `recover`, `preview` and `deploy`. Configure only the capabilities Manager is authorized to use.
- `APPFORGE_MANAGER_DAILY_ACTION_LIMIT`: positive integer, maximum 1000; all new mutation commands count against a rolling 24-hour limit, including failures. Zero/unset blocks mutations. This bounds action count, not currency expenditure; existing provider limits and approval rules still apply.
- `APPFORGE_MANAGER_DEPLOY_DESTINATIONS`: empty by default. Production deployment requires both `deploy` scope and an explicitly allowed existing destination (`vercel`, `netlify`, `fly`, `github-pages`). Preview uses `preview` scope.

The new `20261027_010` migration adds private, RLS-protected command and repair queue tables through the authoritative `ensureAppSchema` migration chain. Applied migration checksums are unchanged. No existing product or billing data is rewritten. Existing application-database backups must include `appforge_manager_commands`, its command hashes/results, and `appforge_manager_repair_queue`.

Browser cookies and request-supplied owner identities cannot authenticate the service API. Requests with an Origin header are rejected. Browser CSRF protection remains unchanged; this dedicated server-to-server boundary authenticates with its own bearer token before any operation. Tokens are never returned or written to the command ledger.

## Discovery and inspection

All requests use `Authorization: Bearer <dedicated token>`.

- `GET /capabilities`: registered product types, build capabilities, technology stacks, runnable/source generation modes, enabled scopes and limits. A registered stack is not proof that a particular product runs.
- `GET /execution-readiness`: execution preflight eligibility; per-build execution and qualification remain required.
- `GET /projects` and `GET /projects/:id`: company project inventory and current state.
- `GET /projects/:id/evidence`, `/files`, `/download`, `/snapshots`, `/logs`, `/recovery`, `/deploy-options`, `/required-env`, `/revenue-readiness`: existing protected AppForge inspection/export capabilities.
- `GET /repairs/:taskId`: Senior Dev task progress.

The configured owner remains the principal in the existing protected procedures. AppForge's account lifecycle, project ownership, credits, approval, artifact-integrity, deployment and certification checks continue to run.

## Durable commands

`POST /commands` accepts `{requestId, action, input}`. Request IDs contain 1–100 letters, digits, underscores or hyphens. Reuse the same request ID only for identical action/input. Property order does not change the fingerprint.

| Action           | Input                                                                            | Scope                                             |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `build`          | `title`, `description`, optional registered `productType`, `techStack`, `locale` | `build`                                           |
| `approve_plan`   | `projectId`                                                                      | `plan`                                            |
| `revise_plan`    | `projectId`, `revision`                                                          | `plan`                                            |
| `resume_build`   | `projectId`                                                                      | `build`                                           |
| `repair`         | `projectId`, `request`, optional `mode`                                          | `repair`                                          |
| `approve_repair` | `taskId`                                                                         | `repair`                                          |
| `recover_build`  | `projectId`                                                                      | `recover`                                         |
| `deploy`         | `id`, `destination`                                                              | `preview`, or `deploy` plus destination allowlist |

A command completing means the existing operation returned, not that generation/deployment or customer fulfilment succeeded. The result retains the real AppForge response. Poll project/evidence state separately. Plan, monetization and external-integration approvals remain distinct; this API does not approve monetization/security policy or external credentials automatically. Account changes, deletion, raw shell access, secrets and billing-policy changes are not exposed.

`GET /commands/:requestId` returns durable status, result and repair execution state when applicable. Conflicting reuse returns 409. Replays never create another build or consume another action slot. Unknown outcomes stay `executing` with an error code; they are not automatically re-executed. A lost build response can be reconciled against its deterministic project title. Unresolved operations require inspection and an appropriate explicit recovery command, not blind retry with a new ID.

Repair commands atomically enqueue durable Senior Dev work when accepted. The server worker starts repairs without requiring a browser SSE connection. Collaborative repairs pause for `approve_repair`; resumed work uses the existing reservation without a second charge. Worker leases and task heartbeats coordinate restarts. A stale interrupted execution is failed and its reservation settled; it is not blindly replayed. Refund failures retry settlement only. Inspect the task and execution error before creating a new repair request. Revoking repair scope stops new worker claims; running provider work retains its own heartbeat and settlement obligations.

## Manager adapter contract

`POST /jobs` accepts Manager's `{taskId, action:"improve"|"educate", payload:{description, title?, productType?, techStack?}}`. It creates a durable build command. `GET /jobs/:taskId` independently inspects the project and validates its current artifact before returning `status:"verified"`, `projectId`, artifact version/hash and an authenticated evidence URL.

Verified build jobs explicitly return `deliverableKind:"source_artifact"` and `productionReady:false`. Queued builds, missing artifacts, approval pauses, source-only builds and browser redirects are never proof of a paid delivery or production release. Use AppForge deployment/certification evidence and the separate commercial acceptance flow before selling a product. Clarification requests remain pending with their actual questions.

Point Manager's AppForge adapter URL at `https://<existing-appforge-host>/integrations/manager` and its adapter token at the dedicated credential. The generic Manager job adapter handles submission/polling; a legacy native integration must not override this configured service adapter.

## Verification and deployment status

Local tests execute the command ledger on PostgreSQL and execute the emitted billing modules behind HTTP endpoints with PostgreSQL. Auth/provider responses and Stripe signed events in those tests are explicitly isolated fixtures; no live payment, customer acquisition or production revenue is claimed.

As observed on 27 October 2026, GitHub refused the infrastructure readiness job before allocating a runner: **“The job was not started because an Actions budget is preventing further use.”** Restoring the account's Actions allowance is required before the existing production workflows can deploy and verify these changes. Repository write access does not resolve this billing gate. No production service credentials were exported, billing limits changed, or deployment gates bypassed.

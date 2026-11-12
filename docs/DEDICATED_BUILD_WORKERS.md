# Dedicated AppForge build consumers (Fly-independent)

AppForge can run the existing HTTP API and BullMQ build consumers in separate Node.js processes without adding a hosting provider. This is an opt-in capability for verified deployments, **not** evidence of a completed customer build or production load certification.

## Existing single-process mode

The default remains unchanged: `npm start` launches the API and its existing embedded background services. Do not set external mode until a separate consumer has been configured and tested.

## Split-process mode

Both processes must have the same trusted database and Redis configuration, compatible environment secrets, and access to the already compiled `dist` code.

- API process: set `APPFORGE_BUILD_WORKER_MODE=external` and run `npm start`.
- Dedicated consumer process: run `npm run start:build-worker` with `REDIS_URL` and `DATABASE_URL` configured.
- Use the same Redis queue and database for both; do not allow an API-only instance to run without a functioning consumer or queued builds will not progress.
- Start with exactly one dedicated consumer during qualification. Additional workers are permitted only after testing lease fencing, queue fairness, spend reservations, host isolation and provider quotas.

The dedicated entry has no HTTP listener and never calls Fly. AppForge's other manager, sync and self-healing background services currently remain on the API process and require separate scaling review. The existing in-process BullMQ concurrency is two **per worker process**; adding consumers increases simultaneous AI demand and spending exposure.

Do not run generated code with direct host credentials. Sandbox isolation, per-user accounting, resource caps, and production readiness must be verified before enabling customer builds. No live hosting is required to create or review this source change. Verify with a local isolated environment and then use measured concurrency/load tests before release.

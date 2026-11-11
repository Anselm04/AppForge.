# Run the actual AppForge full-stack server without Fly.io

This is the **real** Express/tRPC/SSE application. The checked-in production Compose stack now maps port 3000 correctly and provisions private PostgreSQL and Redis services. It does not run a placeholder application or require Fly.io.

## Local Linux deployment

Use a trusted Linux host with Docker Engine and Docker Compose v2. From the repository root:

1. Create a private `.env.production` using the canonical env schema and examples. Set genuine Supabase authentication keys, a supported AI provider, JWT/COOKIE/PREVIEW secrets, permitted public URL, and other production runtime settings; do not commit credentials.
2. Define `POSTGRES_PASSWORD` and `REDIS_PASSWORD` as strong **URL-safe** values for this local Compose stack (both are interpolated into `DATABASE_URL` and `REDIS_URL`). Set `POSTGRES_USER` and `POSTGRES_DB` only if departing from the `appforge` defaults. This uses a private fresh PostgreSQL volume, **not** the existing Fly database; no customer data is migrated automatically.
3. `docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet`
4. `docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d`
5. `docker compose --env-file .env.production -f docker-compose.prod.yml ps`
6. `curl --fail http://127.0.0.1:3000/api/health/live`
7. `curl --fail http://127.0.0.1:3000/api/health/ready`; failed readiness identifies real runtime prerequisites that still need repair.

The application is exposed on loopback only. Do not open this port directly to the internet. A public launch requires a hardened TLS proxy, approved public hostname, security review, backups, and durable storage.

## Full-stack Linux-host build and verification mode

The production Compose app service runs the real React/Express server, but **Docker inside Docker is not automatically available** for generated-code validation. For local testing on an existing Linux computer with Docker Engine and Node installed, use the existing full-stack server directly on the host, with private PostgreSQL and Redis as supporting Compose services:

```sh
npm ci
npm run build
node scripts/start-local-fullstack.mjs
```

The launcher reads the existing private `.env.production`, starts real PostgreSQL/Redis services, and then executes `dist/server.js` on loopback port 3000. It uses the host Docker daemon for the existing hardened Docker validation path; it does not install Fly or contact Sprites. Run `curl --fail http://127.0.0.1:3000/api/health/ready` and exercise a real authenticated build/edit/export journey.

The Node process must be run on a **trusted owner-controlled Linux computer only**, because access to the host Docker daemon is security-sensitive. Do not expose this mode to public customers, or treat it as production-certified hosting. In a public deployment use a separately isolated and verified build runner; never expose the Docker socket to the internet or mount it unrestricted inside a customer-facing container.

## What is and is not established

- The production Docker image packages the same Node/React full-stack application and no longer installs Fly CLI.
- PostgreSQL and Redis run on a private Compose network and retain named volumes.
- A green liveness probe only establishes that the server is listening, **not** that authenticated builds, provider calls, execution isolation, billing or generated-product deployment are functional.
- Production AI builds require a verified isolated runner (existing-host isolation, secure Docker validation or an authorised isolated runtime). **Do not mount the host Docker socket into an untrusted customer-facing container to force the builder to start.** If no secure runner exists, customer builds appropriately fail closed.
- Do not substitute Vercel static hosting for the persistent backend. Do not reuse Fly production secrets or databases without a deliberate secured migration.
- Verify: registration, email/SMS, project creation, supported real AI provider, built output, editing/persistence, source export, supported external deployment, Stripe test checkout and recovery.

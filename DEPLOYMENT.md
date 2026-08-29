# AppForge Deployment Guide

AppForge is a **full-stack Node app** (Express API, tRPC, SSE builds, live preview). Production hosting should run the Docker image or `node dist/server.js` on a persistent VM.

**Vercel in this repo deploys only the static Vite client** — see [docs/VERCEL.md](docs/VERCEL.md). Do not expect `vercel.json` to run SSE builds or the AI pipeline.

---

## Recommended: Fly.io (full stack)

Fly.io runs the complete AppForge server: builds, Senior Dev, Stripe webhooks, signed previews, and sandbox validation.

### Why Fly.io

| Need                                      | Fly.io                      | Vercel (this repo)                             |
| ----------------------------------------- | --------------------------- | ---------------------------------------------- |
| SSE `/api/build/:id` (up to 20 min)       | ✅ Persistent VM            | ❌ No long-running server                      |
| `npm install` + `tsc` + vitest in sandbox | ✅ Full filesystem          | ❌ Not available                               |
| Stripe webhook `/api/webhooks/stripe`     | ✅ Express route            | ⚠️ Use legacy `api/` functions or proxy to Fly |
| PostgreSQL                                | ✅ Fly Postgres or external | External only                                  |
| Static marketing UI                       | ✅ Same deploy              | ✅ CDN (optional second deploy)                |

### Prerequisites

- Fly.io account — [fly.io](https://fly.io)
- `flyctl` — `curl -L https://fly.io/install.sh | sh`
- `flyctl auth login`

### Files

| File                    | Purpose                           |
| ----------------------- | --------------------------------- |
| `fly.toml`              | App config, ports, health checks  |
| `Dockerfile`            | Multi-stage production image      |
| `scripts/fly-deploy.sh` | Deploy + post-deploy health check |

### First-time setup

```bash
# Create app (does not deploy yet)
flyctl launch --name appforge --region lhr --dockerfile Dockerfile --build-target production --no-deploy

# Optional: Fly Postgres (or use Supabase — set DATABASE_URL / SUPABASE_DB_URL)
flyctl postgres create --name appforge-db --region lhr --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
flyctl postgres attach appforge-db --app appforge
```

### Secrets

Set production secrets with `fly secrets set`. Minimum for a working builder:

```bash
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="$(openssl rand -base64 48)" \
  COOKIE_SECRET="$(openssl rand -base64 48)" \
  BUILT_IN_FORGE_API_KEY="your-forge-or-openai-key" \
  BUILT_IN_FORGE_API_URL="https://forge.manus.im" \
  VITE_SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key" \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  STRIPE_STARTER_PRICE_ID="price_..." \
  STRIPE_BUILDER_PRICE_ID="price_..." \
  STRIPE_STUDIO_PRICE_ID="price_..." \
  OWNER_EMAIL="you@example.com" \
  CORS_ORIGIN="https://appforge.fly.dev" \
  APP_URL="https://appforge.fly.dev" \
  --app appforge
```

See [ENVIRONMENT.md](ENVIRONMENT.md) and `.env.example` for the full list (hCaptcha, Twilio SMS, Sentry self-healing, deploy tokens, etc.).

**`BUILT_IN_FORGE_API_KEY` is required** — without it, AI builds cannot run.

### Deploy

```bash
./scripts/fly-deploy.sh
# or
flyctl deploy --config fly.toml --dockerfile Dockerfile --build-target production
```

Rolling deploy: new machine must pass `GET /api/health` before traffic switches.

### Verify

```bash
curl https://appforge.fly.dev/api/health
npx tsx src/utils/smoke-test.ts https://appforge.fly.dev
flyctl logs --app appforge
```

### Stripe webhook

Register in Stripe Dashboard:

```
https://appforge.fly.dev/api/webhooks/stripe
```

Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.

### Scale

```bash
flyctl scale count 2 --app appforge
flyctl scale memory 512 --app appforge   # if sandbox builds OOM on 256MB
```

### Troubleshooting

| Symptom               | Check                                                                             |
| --------------------- | --------------------------------------------------------------------------------- |
| Health check fails    | `flyctl logs` — missing `DATABASE_URL`, `JWT_SECRET`, or `BUILT_IN_FORGE_API_KEY` |
| Build OOM             | `flyctl scale memory 512`                                                         |
| DB connection refused | Fly Postgres attachment or Supabase URL format                                    |

---

## Optional: Vercel (static client only)

Use Vercel when you want a CDN-hosted SPA that talks to your Fly (or other) API.

1. Deploy full app to Fly (above).
2. In Vercel: connect repo, use `vercel.json` (`npx vite build` → `dist/client`).
3. Set `VITE_*` env vars **or** rely on runtime `/config.js` from your API origin if you proxy the client through Fly.

Details: [docs/VERCEL.md](docs/VERCEL.md).

```bash
npm run deploy:preview    # PR previews (static client)
npm run deploy:production # production static client
```

**Do not** point users at Vercel alone expecting builds to work unless API URLs in `/config.js` or `VITE_*` point at your Fly backend.

---

## Docker (self-hosted)

```bash
docker build -t appforge --target production .
docker run -p 3000:3000 --env-file .env appforge
```

See [DOCKER.md](DOCKER.md).

---

## CI / GitHub Actions

| Workflow                | Trigger                      | Purpose                                 |
| ----------------------- | ---------------------------- | --------------------------------------- |
| `ci.yml`                | PR + push to `main`          | Lint, typecheck, test, build, security  |
| `deploy-preview.yml`    | PR                           | Build validation (no Vercel quota burn) |
| `deploy-production.yml` | Push to `main`               | Validate release + deploy to Fly.io     |
| `deploy.yml`            | Manual (`workflow_dispatch`) | Optional static Vercel client only      |

**GitHub repository secrets**

| Secret                                               | Required for                 | Notes                                                                                      |
| ---------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `FLY_API_TOKEN`                                      | Auto deploy to Fly on `main` | Create at [fly.io/user/personal_access_tokens](https://fly.io/user/personal_access_tokens) |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Manual Vercel deploy only    | Optional static CDN client                                                                 |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`  | Source map upload in CI      | Optional                                                                                   |

Vercel **automatic Git deploys are disabled** in `vercel.json` (`git.deploymentEnabled: false`) to avoid the >100/day rate limit. Production hosting is **Fly.io** (`appforge-unfurling-moon-9058`).

---

## Health & smoke tests

| Endpoint                | Purpose                  |
| ----------------------- | ------------------------ |
| `GET /api/health`       | Full health (DB, uptime) |
| `GET /api/health/live`  | Liveness                 |
| `GET /api/health/ready` | Readiness                |

```bash
npx tsx src/utils/smoke-test.ts https://your-api-host
```

---

## Support

- **Fly.io**: `flyctl logs`, `flyctl status`, [fly.io/dashboard](https://fly.io/dashboard)
- **Vercel (static)**: `vercel logs`, [docs/VERCEL.md](docs/VERCEL.md)
- **Stripe**: [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
- **GitHub Issues**: include deployment URL and sanitized logs

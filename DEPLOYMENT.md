# AppForge Deployment Guide (Phase 5)

AppForge uses Vercel for frontend deployment with automated CI/CD via GitHub Actions.

## Quick Start

### First-time setup

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link --name appforge --scope anselm04s-projects
```

### Deploy preview

```bash
# Deploy to preview (for PRs)
npm run deploy:preview
```

### Deploy production

```bash
# Deploy to production (main branch)
npm run deploy:production
```

## Automated Deployment

### Preview deployments

- Triggered automatically on pull requests
- Deploys to `appforge-preview-{PR_NUMBER}.vercel.app`
- Posts preview URL as PR comment
- Runs lint, test, and build checks

### Production deployments

- Triggered on push to `main` branch
- Deploys to `appforge.vercel.app`
- Runs full CI pipeline including security scan
- Executes smoke tests post-deployment

## Manual Deployment

### Using the deployment script

```bash
# Deploy preview
./scripts/deploy.sh preview

# Deploy production
./scripts/deploy.sh production
```

### Using Vercel CLI directly

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## Health Checks

### Check deployment health

```bash
curl https://appforge.vercel.app/health
```

### Expected response

```json
{
  "status": "ok",
  "timestamp": "2026-08-07T20:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "version": "1.0.0"
}
```

## Smoke Tests

### Run smoke tests

```bash
# Test local deployment
npx tsx src/utils/smoke-test.ts http://localhost:3000

# Test preview deployment
npx tsx src/utils/smoke-test.ts https://appforge-preview-123.vercel.app

# Test production deployment
npx tsx src/utils/smoke-test.ts https://appforge.vercel.app
```

### Smoke test checks

- ✓ Health endpoint responds
- ✓ API readiness
- ✓ Static assets load
- ✓ Root page returns HTML

## Environment Variables

### Required variables

Copy `.env.example` to `.env` and fill in:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-secret-key

# Vercel
VERCEL_TOKEN=your-vercel-token
```

### See ENVIRONMENT.md for complete list

## Rollback

### Rollback to previous deployment

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

### Emergency rollback

1. Identify last known good deployment
2. Run `vercel rollback <url> --prod`
3. Verify health endpoint
4. Run smoke tests

## Monitoring

### View deployment logs

```bash
# Recent logs
vercel logs

# Production logs
vercel logs --prod

# Follow logs
vercel logs --follow
```

### Check deployment status

```bash
# List deployments
vercel ls

# Get specific deployment
vercel inspect <deployment-url>
```

## Troubleshooting

### Build fails

```bash
# Check build locally
npm run build

# Check Vercel build logs
vercel logs --build
```

### Deployment fails

```bash
# Check Vercel project settings
vercel inspect

# Verify environment variables
vercel env ls
```

### Health check fails

```bash
# Check database connection
curl https://appforge.vercel.app/health

# Check logs for errors
vercel logs --prod --since=1h
```

## Best Practices

1. **Always test locally first**: `npm run build` before deploying
2. **Use preview deployments**: Test PRs before merging to main
3. **Monitor health**: Check `/health` after every deployment
4. **Run smoke tests**: Automated in CI, but verify manually for production
5. **Keep secrets secure**: Use Vercel environment variables, never commit `.env`
6. **Review logs**: Check deployment logs for warnings and errors

## Security

- All deployments use HTTPS
- Environment variables encrypted at rest
- Preview deployments isolated per PR
- Production requires passing CI checks
- Secret scanning in CI pipeline

## Next Steps

After deployment:

1. ✓ Verify health endpoint
2. ✓ Run smoke tests
3. ✓ Monitor logs for errors
4. ✓ Check application functionality
5. ✓ Update documentation if needed

---

## Fly.io Deployment (Alternative to Vercel)

If you prefer a dedicated VM with persistent PostgreSQL and full control over the runtime, Fly.io is a better fit than Vercel for AppForge's backend-heavy architecture.

### Why Fly.io for AppForge

- **Persistent PostgreSQL** — Fly Postgres runs alongside your app, no external Supabase dependency required
- **Full Node.js runtime** — Docker-based, so `server.ts` Express API, `tsc` compilation, and `vitest` tests all run natively
- **WebSocket/SSE support** — No serverless timeouts; the build pipeline's Server-Sent Events stream works reliably
- **Build validation sandbox** — the `buildValidator.ts` temp-sandbox compilation needs a real filesystem, which Fly's VMs provide
- **Secrets encrypted at rest** — `fly secrets set` stores env vars encrypted, never in code
- **Rolling deploys** — zero-downtime with health checks

### Prerequisites

- Fly.io account (free tier: 3 shared-cpu-1x VMs, 256MB RAM, 3GB persistent volume)
- `flyctl` CLI installed: `curl -L https://fly.io/install.sh | sh`
- Logged in: `flyctl auth login`

### Files Created

| File | Purpose |
|---|---|
| `fly.toml` | Fly app config: services, ports, health checks, env vars |
| `scripts/fly-deploy.sh` | One-command deploy with pre-flight checks and post-deploy health verification |

### Step 1: Launch the App (First Time Only)

```bash
# This creates the app on Fly.io but does NOT deploy
flyctl launch --name appforge --region lhr --dockerfile Dockerfile --build-target production --no-deploy
```

Choose a region close to your users: `lhr` (London), `iad` (Virginia), `ord` (Chicago), `syd` (Sydney), `nrt` (Tokyo), etc.

### Step 2: Create a PostgreSQL Database

```bash
# Create a 1GB Postgres cluster (free tier eligible)
flyctl postgres create --name appforge-db --region lhr --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1

# Attach it to your app (sets DATABASE_URL automatically)
flyctl postgres attach appforge-db --app appforge
```

If you prefer **Supabase**, skip this and set `SUPABASE_DB_URL` or `DATABASE_URL` manually in Step 3.

### Step 3: Set All Required Secrets

```bash
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="$(openssl rand -base64 48)" \
  COOKIE_SECRET="$(openssl rand -base64 48)" \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  STRIPE_STARTER_PRICE_ID="price_..." \
  STRIPE_BUILDER_PRICE_ID="price_..." \
  STRIPE_STUDIO_PRICE_ID="price_..." \
  STRIPE_STARTER_PAYMENT_LINK="https://buy.stripe.com/..." \
  STRIPE_BUILDER_PAYMENT_LINK="https://buy.stripe.com/..." \
  STRIPE_STUDIO_PAYMENT_LINK="https://buy.stripe.com/..." \
  BUILT_IN_FORGE_API_KEY="your-forge-or-openai-key" \
  BUILT_IN_FORGE_API_URL="https://forge.manus.im" \
  OWNER_EMAIL="anselm.perkins@gmail.com" \
  CORS_ORIGIN="https://appforge.fly.dev" \
  VITE_SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key" \
  SENTRY_DSN="https://..." \
  --app appforge
```

**CRITICAL**: The `BUILT_IN_FORGE_API_KEY` is required — without it, the AI build pipeline cannot run.

### Step 4: Deploy

```bash
# Option A: One-command script (recommended)
./scripts/fly-deploy.sh

# Option B: Manual deploy
flyctl deploy --config fly.toml --dockerfile Dockerfile --build-target production
```

The deployment process:
1. Builds the Docker image using the `Dockerfile` (multi-stage: deps → builder → production)
2. Pushes the image to Fly.io's registry
3. Starts a new VM with rolling strategy (zero downtime)
4. Runs the health check (`GET /api/health`) before marking the machine healthy
5. Stops the old VM once the new one passes health checks

### Step 5: Verify

```bash
# Check health
curl https://appforge.fly.dev/api/health

# Expected:
# {"status":"ok","timestamp":"...","uptime":...}

# Run smoke tests
npx tsx src/utils/smoke-test.ts https://appforge.fly.dev

# View logs
flyctl logs --app appforge

# Check status
flyctl status --app appforge
```

### Step 6: Register Stripe Webhook

In your Stripe Dashboard, add this webhook endpoint:
```
https://appforge.fly.dev/api/webhooks/stripe
```

Enable these 6 events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Step 7: Scale (When Needed)

```bash
# Scale to 2 VMs for redundancy
flyctl scale count 2 --app appforge

# Scale memory (if builds are memory-intensive)
flyctl scale memory 512 --app appforge

# Add a dedicated CPU for faster build validation
flyctl scale vm dedicated-cpu-1x --app appforge
```

### Fly.io vs Vercel: Which to Choose?

| Factor | Vercel | Fly.io |
|---|---|---|
| **Frontend CDN** | Excellent (edge) | Good (anycast) |
| **Backend runtime** | Serverless Functions (10s timeout) | Persistent VM (unlimited) |
| **SSE/WebSocket** | Limited timeouts | Full support |
| **Build validation** | Cannot run `npm install` in sandbox | Full filesystem access |
| **PostgreSQL** | External (Supabase) | Built-in Fly Postgres |
| **Docker** | Not supported | Native |
| **Cost (startup)** | Free tier generous | Free: 3 VMs + 1GB disk |
| **Cost (scale)** | Pay per invocation | Pay per VM-hour |

**Recommendation**: Use **Fly.io** for AppForge because the build pipeline's SSE streaming, sandbox compilation, and credit-metered agent phases require a persistent VM, not serverless functions.

### Troubleshooting

**Health check fails after deploy**
```bash
flyctl logs --app appforge
# Likely causes: DATABASE_URL wrong, JWT_SECRET missing, or BUILT_IN_FORGE_API_KEY not set
```

**Build hangs or times out**
```bash
# The build validation agent runs `npm install` in a temp dir.
# If memory is tight (256MB free tier), increase VM memory:
flyctl scale memory 512 --app appforge
```

**Database connection refused**
```bash
# If using Fly Postgres, verify attachment:
flyctl postgres status --app appforge-db
# If using Supabase, double-check DATABASE_URL format: postgresql://...
```

**"App not found"**
```bash
# Make sure you're in the repo root and fly.toml exists
ls fly.toml
# If you used a different app name at launch, use --app flag everywhere
flyctl status --app your-app-name
```

## Support

For deployment issues:

- **Vercel**: https://vercel.com/dashboard — `vercel logs`, `vercel inspect`
- **Fly.io**: https://fly.io/dashboard — `flyctl logs`, `flyctl status`, `flyctl doctor`
- **Stripe**: https://dashboard.stripe.com/webhooks
- **GitHub Issues**: Open an issue with your deployment URL and `flyctl logs` output

# Vercel deployment (static client only)

The AppForge **build engine** (Express API, tRPC, SSE `/api/build/:id`, live preview) requires a Node server. **Vercel in this repo deploys only the Vite client** (`vercel.json` → `dist/client`).

## What works on Vercel

- Marketing UI shell (if `VITE_*` or `/config.js` points API to your backend)
- Legacy Vercel Functions in `api/` (checkout, stripe-webhook) — separate from Express

## What does **not** work on Vercel alone

- Starting AI builds (SSE pipeline)
- Senior Dev Agent sessions
- Signed live preview (`/live/:projectId`)
- Stripe webhook at `/api/webhooks/stripe` (use Fly or route to Express)

## Recommended setup

1. Deploy **full app** to [Fly.io](../DEPLOYMENT.md#flyio-full-stack-recommended)
2. Optionally deploy **static client** to Vercel with `VITE_*` env vars pointing at your Fly URL, or use Fly for both.

## `vercel.json`

```json
{
  "framework": "vite",
  "buildCommand": "npx vite build",
  "outputDirectory": "dist/client",
  "git": {
    "deploymentEnabled": false
  }
}
```

Automatic Git deploys are **disabled** to avoid Vercel rate limits (>100 deploys/day). Use Fly.io for production (`deploy-production.yml`) or run `.github/workflows/deploy.yml` manually when you need a static client on Vercel.

No serverless rewrite can replace long-running SSE builds. Do not expect `vercel.json` to host the builder.

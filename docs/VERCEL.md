# Vercel deployment (static client only)

> **No-Fly operational note (2026-11-11):** Vercel may serve a static frontend, but the required persistent full-stack backend can run on **any qualified Linux Node/Docker host**, not only Fly.io. See [Fly-independent runtime](FLY_INDEPENDENT_RUNTIME.md). The Fly-specific examples below are historical and not a current hosting requirement.

The AppForge **build engine** (Express API, tRPC, SSE `/api/build/:id`, live preview) requires a Node server. **Vercel in this repo deploys only the Vite client** (`vercel.json` → `dist/client`).

## What works on Vercel

- Static marketing UI assets only. No dynamic backend, `/config.js` or authenticated customer journey is provided by this deployment.
- Legacy Vercel Functions in `api/` (checkout, stripe-webhook) — separate from Express

## What does **not** work on Vercel alone

- Starting AI builds (SSE pipeline)
- Senior Dev Agent sessions
- Signed live preview (`/live/:projectId`)
- Stripe webhook at `/api/webhooks/stripe` (must reach the complete Express server)

## Recommended setup

1. Deploy **the complete AppForge Node/React application** to a qualified persistent Linux/Docker host as described in [the Fly-independent runtime guide](FLY_INDEPENDENT_RUNTIME.md).
2. Use that full-stack host as the actual customer-facing application. This standalone Vercel static project is not a valid substitute and should remain disabled for AppForge customer traffic.

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

Automatic Git deploys are **disabled**. The old proxy rewrites that directed `/api`, `/config.js`, `/live` and `/sandbox-dev` to the retired Fly hostname have been removed from source. **This repository change does not update existing deployed Vercel assets.** Existing Vercel deployment aliases may still serve old rewrites until that deployment is retired or replaced. Do not promote this standalone static client as a working AppForge product. The real Node server is the hosting authority.

No serverless rewrite can replace long-running SSE builds. Do not expect `vercel.json` to host the builder.

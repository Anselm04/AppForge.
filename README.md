# AppForge

> AI-powered app, game, agent, tool, and website builder. Describe what you want, and a multi-agent pipeline plans, codes, validates, and helps you deploy a starter project — with optional iteration via the Senior Dev Agent.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org)

**Honest disclaimer:** AppForge uses large language models to generate code. It includes a **Build Validation Agent** that compiles Node/Vite projects in a sandbox and retries with error feedback — but **complex apps still need human review.** AppForge is a rapid prototype accelerator, not a guarantee of production-ready software.

---

## What AppForge is

AppForge is a **full-stack web application** (Express + React) where users:

1. Sign in with **Supabase Auth** (email/password)
2. Describe an app on the home page and pick one of **40 tech stacks**
3. Watch a **credit-metered AI pipeline** stream live over Server-Sent Events (SSE)
4. Download a ZIP, deploy to several destinations, or push to **GitHub**
5. Optionally iterate on an existing project with the **Senior Dev Agent**

The platform stores users, projects, credits, and generated files in **PostgreSQL via Drizzle ORM**. Schema is applied automatically on server boot (`ensureAppSchema`).

**Production hosting:** The full app (API + SSE builds + SPA) runs on **Fly.io** (`fly.toml`). **Vercel** in this repo only builds the static client (`vercel.json`) — it does **not** run the Express build server or SSE pipeline.

---

## Primary user flow

| Step | Route | What happens |
|------|-------|--------------|
| Sign up / log in | `/signup`, `/login` | Supabase Auth; session stored in browser `localStorage` |
| Create build | `/` (Home) | `trpc.projects.create` → redirects to `/build/:id` |
| Watch build | `/build/:projectId` | SSE `GET /api/build/:projectId` streams agent logs |
| Manage projects | `/dashboard` | List builds, credits, tier, links to improve/rebuild |
| Improve existing code | `/ai-builder` (Improve tab) | Senior Dev Agent with plan approval or autonomous mode |
| Design assets | `/editor` | Standalone SVG graphics editor (not wired into builds) |
| Billing | `/pricing` | Stripe Payment Links + credit packs |
| Redeem codes | `/redeem` | Owner-issued god codes |
| Admin | `/admin` | Owner-only analytics + god code minting (`OWNER_EMAIL`) |

**Credit gates:** A new build requires **5 credits** upfront. Senior Dev sessions require **6 credits**. Users with `unlimited` (lifetime god codes) skip balance checks.

---

## Build pipeline (what actually runs)

Entry: `src/agents/pipeline.ts` via `src/routes/build.ts`.

| Phase | Agent | What it does |
|-------|-------|--------------|
| 1 | **Planner** | LLM produces an architecture plan (tasks, modules) |
| 2 | **Coder** | LLM generates source files per task; parses multi-file output |
| 3 | **Validator** | Sandbox: `npm install` → `tsc` → Vitest → Vite build (Node stacks only) |
| — | **Auto-fix** | Up to 2 retries: validation errors fed back to Coder |
| 4 | **Triple audit** | Static regex scans (accessibility, security, performance scores) |
| 5 | **Reviewer** | LLM quality report written to `REVIEW.md` |
| 6 | **Testing agent** | Generates Vitest test files for modules |
| Post | **Scaffold merge** | Baseline files from `stackScaffolds.ts` merged with generated code |
| Post | **Compliance** | Vanta-style scaffolding injected (`compliance-template.ts`) |
| Post | **Snapshot** | Version stored in `build_snapshots` for rollback |

**LLM:** `BUILT_IN_FORGE_API_KEY` + `BUILT_IN_FORGE_API_URL` (OpenAI-compatible; Forge or OpenAI).

**Validation depth varies by stack:** React/Vite/Node stacks get full compile + test + build. Python, Flutter, game exports, and extensions get structural checks with warnings — not full execution.

**Credits:** The server deducts **5 credits once** when a build starts. Phase costs (Planner 2, Coder 3, Validator 2, Reviewer 1) are shown in the SSE stream for transparency but are **not** charged separately.

If credits run out mid-build, the pipeline **pauses** and can resume after top-up.

---

## Deploy & export

From the build page (`src/pages/Build.tsx`, `src/services/deployer.ts`):

| Destination | Requires | Notes |
|-------------|----------|-------|
| **Live preview** | `APP_URL` or `CORS_ORIGIN` | Signed URL → `/live/:projectId`; Vite apps are built in a temp dir |
| **ZIP download** | — | Always available |
| **Vercel** | `VERCEL_TOKEN` | Deployments API v13 |
| **Netlify** | `NETLIFY_AUTH_TOKEN` | ZIP upload |
| **Fly.io** | `FLY_API_TOKEN` | `flyctl deploy` in temp dir |
| **GitHub Pages** | `GITHUB_TOKEN` | Trees API + `gh-pages` branch |
| **GitHub repo** | GitHub OAuth (`GITHUB_CLIENT_ID/SECRET`) | Creates repo and pushes `generated_files` |

Deploy options show as configured/unconfigured via `trpc.projects.deployOptions`.

---

## Senior Dev Agent

Iterates on an **existing** project's generated files (`src/agents/seniorDevAgent.ts`):

- **Collaborative mode:** Produces a plan → user approves → executes step-by-step
- **Autonomous mode:** Plans and executes without approval
- Validates changes in a sandbox (same auto-fix loop as main pipeline)
- Costs **6 credits** per session
- Entry: Dashboard "Improve" or `/ai-builder?projectId=X&mode=improve`

---

## Subscription tiers

| Tier | Price | Monthly builds | Credit refill |
|------|-------|----------------|---------------|
| Free | $0 | 3 | 20 (initial) |
| Starter | $49/mo | 16 | 100 |
| Builder | $149/mo | 66 | 400 |
| Studio | $399/mo | Unlimited | 1,500 |
| Enterprise | $896+/mo | Custom | Unlimited |

Billing: Stripe Payment Links, Checkout Sessions, webhooks (`/api/webhooks/stripe`), and optional credit packs.

**God codes:** Owner mints encrypted one-time codes in `/admin`. Users redeem at `/redeem` for lifetime unlimited or bonus credits. SMS OTP tables exist in schema but redemption does **not** require SMS in current code.

---

## Supported tech stacks (40)

Defined in `src/agents/pipeline.ts` and `src/services/stackScaffolds.ts`. Scaffold depth varies — React/Vite shells are runnable; Unity/Godot exports are HTML placeholders; unknown stacks fall back to a generic Vite React shell.

### Web (11)
`react-node`, `react-python`, `vue-node`, `svelte-node`, `next-node`, `angular-node`, `vanilla-node`, `react-django`, `react-supabase`, `remix-node`, `astro-node`

### Games (7)
`phaser-html5`, `three-js-3d`, `babylon-js-3d`, `unity-webgl`, `godot-html5`, `react-native-game`, `flutter-game`

### AI / agents (6)
`ai-agent-python`, `ai-agent-node`, `openai-tool`, `langchain-tool`, `crewai-agent`, `autogen-agent`

### Desktop & mobile (5)
`electron-react`, `tauri-rust`, `react-native-expo`, `flutter-firebase`, `capacitor-ionic`

### Extensions, bots & APIs (11)
`chrome-extension`, `vscode-extension`, `discord-bot`, `telegram-bot`, `slack-bot`, `browser-automation`, `web-scraper`, `data-visualization`, `api-service`, `serverless-aws`, `serverless-vercel`

---

## Platform tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, React Router |
| API | tRPC v11, Zod, Express 4 |
| Auth | Supabase Auth (JWT); server verifies via service role → Drizzle `users` |
| Database | PostgreSQL + Drizzle ORM (`ensureAppSchema` on boot) |
| Payments | Stripe (subscriptions, webhooks, billing portal) |
| LLM | OpenAI-compatible API (`BUILT_IN_FORGE_*`) |
| Deploy targets | Vercel, Netlify, Fly, GitHub Pages, signed preview, ZIP |
| Observability | Sentry (optional), structured logging, health probes |
| CI | GitHub Actions — lint, typecheck, test, build, security scan |

---

## What is NOT the production path

These exist in the repo but are **not** what Home → Build uses:

| Item | Status |
|------|--------|
| `POST /api/ai/generate`, `/api/ai/iterate`, `/api/agents/build` | **410 Gone** — use `projects.create` + SSE build |
| AI Builder **"Build New"** tab (`/ai-builder`) | Legacy stub (`app-generator.ts`) — use **Home** instead |
| `supabase/migrations/` UUID schema | For Supabase GitHub integration / Vercel functions — **not** used by Drizzle server |
| `npm run db:migrate` | Expects `drizzle/` migration output; schema is ensured via `ensureAppSchema` |
| Redis build queue (`build-queue.ts`) | Stub — builds run synchronously in the SSE handler |
| Template marketplace component | Not routed in `App.tsx` |
| Cosine integration router | API exists; no UI route found |
| hCaptcha, SMS god-code OTP, Vanta API sync | Env/schema support; not enforced in user flows |

---

## Limitations (read this)

| Expectation | Reality |
|-------------|---------|
| Any app works perfectly | **No.** LLMs make mistakes. Complex systems need developer fixes. |
| All 40 stacks compile in CI | **No.** Full sandbox validation is for Node/Vite stacks; others get structural checks. |
| Deploy and forget | **No.** You configure env vars, databases, and API keys in the target host. |
| Vercel hosts the builder | **No.** Vercel deploys static client only. Full app needs Fly (or similar). |
| Games run at 60fps | **No.** Phaser/Three templates are starters, not polished games. |
| AI agents are autonomous | **No.** Generated agents need real API keys, tools, and error handling wired by you. |
| Graphics editor saves to projects | **No.** `/editor` is standalone; export SVG/PNG locally. |

**Honest value:** AppForge saves days of boilerplate for CRUD apps, landing pages, and API starters. For games, agents, and native apps it produces scaffolding you still need to finish.

---

## Prerequisites

- Node.js 20+ (22 in `Dockerfile`)
- npm 10+
- PostgreSQL (`DATABASE_URL` or `SUPABASE_DB_URL`)
- **Supabase project** (auth)
- **Stripe account** (billing)
- **OpenAI-compatible API key** (`BUILT_IN_FORGE_API_KEY`) — required for builds
- Optional: `VERCEL_TOKEN`, `NETLIFY_AUTH_TOKEN`, `FLY_API_TOKEN`, `GITHUB_TOKEN`, `GITHUB_CLIENT_ID/SECRET`, `SENTRY_DSN`, `REDIS_URL`

---

## Local setup

```bash
git clone https://github.com/Anselm04/AppForge.git
cd AppForge
npm install
cp .env.example .env
# Edit .env — see .env.example for all variables

npm run validate-env -- --strict

# Full stack (recommended): API + SPA on one port
npm run build
npm start
# → http://localhost:3000

# Frontend-only hot reload (API/SSE won't work without a proxy to Express)
npm run dev
# → http://localhost:5173
```

On first start, `ensureAppSchema()` creates tables if missing. You do **not** need to run `supabase/migrations` for the Express app.

---

## Critical environment variables

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://...

# Supabase Auth (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# LLM (REQUIRED for builds)
BUILT_IN_FORGE_API_KEY=your-key
BUILT_IN_FORGE_API_URL=https://api.openai.com/v1

# Secrets (REQUIRED in production)
JWT_SECRET=<openssl rand -base64 48>
COOKIE_SECRET=<openssl rand -base64 48>
OWNER_EMAIL=you@example.com

# Stripe (REQUIRED for billing)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_BUILDER_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...

# Production
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
APP_URL=https://yourdomain.com

# Deploy (optional — only destinations you use)
VERCEL_TOKEN=...
NETLIFY_AUTH_TOKEN=...
FLY_API_TOKEN=...
GITHUB_TOKEN=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

See `.env.example` for the full list.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile server (`dist/server.js`) + Vite client (`dist/client/`) |
| `npm run start` | Run production server (`node dist/server.js`) |
| `npm run dev` | Vite dev server only (frontend) |
| `npm run test` | Vitest |
| `npm run typecheck` | TypeScript check (client + server) |
| `npm run lint` | ESLint |
| `npm run validate-env` | Validate environment variables |
| `npm run db:studio` | Drizzle Studio (inspect DB) |

---

## Production deployment

**Fly.io (full app):**

```bash
fly deploy --config fly.toml
fly secrets set DATABASE_URL=... BUILT_IN_FORGE_API_KEY=... # etc.
```

Runtime public config is injected at `/config.js` so Supabase/Stripe keys can change without rebuilding.

**Vercel:** Static client only. Connect repo, set `VITE_*` env vars, deploy. Point API calls to your Fly (or other) backend — or users only get a static shell.

**Checklist:**
- [ ] `npm run validate-env -- --strict` passes
- [ ] Stripe webhook → `https://yourdomain.com/api/webhooks/stripe`
- [ ] `CORS_ORIGIN` and `APP_URL` match your domain
- [ ] Health checks: `/api/health`, `/api/health/live`, `/api/health/ready`
- [ ] `npm run typecheck && npm run test -- --run && npm run build` pass locally

See [DEPLOYMENT.md](DEPLOYMENT.md) and [DOCKER.md](DOCKER.md) for more detail.

---

## Security & governance

- **Owner-only admin** — hard-locked to `OWNER_EMAIL`
- **Content moderation** — regex keyword filter on project descriptions; 3-strike auto-ban
- **God codes** — SHA256-hashed, one-use, owner-minted
- **Compliance scaffolding** — injected into generated apps (audit logger, policies, etc.)
- **Rate limiting** — per-user + per-IP; Redis optional
- **Stripe webhook verification** — signature required
- **Signed live previews** — HMAC URLs for `/live/:projectId`

---

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Full health (DB, uptime) |
| `GET /api/health/live` | Liveness probe |
| `GET /api/health/ready` | Readiness (DB connectivity) |

---

## Graphics editor & brand kit

**`/editor`** — Standalone SVG canvas with drawing tools, templates, gradients, neon effects, and SVG/PNG export. Not connected to the build pipeline.

**`public/branding/`** — Logo, wordmark, hero banner, feature illustrations, and `BRAND-GUIDELINES.md`.

---

## FAQ

**Q: Where do I start a build?**  
A: Home (`/`), not the AI Builder "Build New" tab.

**Q: How many credits does a build cost?**  
A: **5 credits** reserved when the build starts. Senior Dev costs **6**.

**Q: Will my deployed app work without configuration?**  
A: Probably not. You need to set environment variables and external services on the host.

**Q: What if validation fails after auto-fix?**  
A: Download the ZIP, read `REVIEW.md`, and fix manually. The Validator tells you what failed.

**Q: Can I use generated code commercially?**  
A: Yes. You own the output; review security and compliance before production use.

---

## License

MIT — see [LICENSE](LICENSE).

## Support

Open a GitHub issue with:
1. Tech stack and app description
2. `REVIEW.md` from the build (if available)
3. Validation errors or SSE log excerpt
4. Tier and project ID

**Do not paste API keys or secrets in public issues.**

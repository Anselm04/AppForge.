# AppForge

> AI-powered app, game, agent, tool, and website builder. Describe what you want, and a multi-agent pipeline plans, codes, tests, validates, and deploys it — with automatic error recovery, built-in graphics design, and premium brand assets.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org)

**⚠️ HONEST DISCLAIMER:** AppForge uses large language models to generate code. No AI can guarantee 100% correct code for every app type. AppForge includes a **Build Validation Agent** that compiles code in a sandbox and auto-retry with error feedback — but **complex apps still require human review and manual fixes.** AppForge is a rapid prototype accelerator, not a magic wand.

AppForge turns natural language descriptions into **tested, compilable starter applications** through a real-time, credit-metered, multi-agent AI pipeline with built-in subscription billing, one-click deployment, GitHub export, a complete Supabase-backed auth system, an integrated premium graphics editor, and a production-grade brand kit.

## What it Actually Does

1. **Describe** — Write your idea (e.g., "A React CRM", "A Phaser platformer game", "A Discord bot with AI moderation")
2. **Plan** — The **Planner** agent creates an architecture blueprint with tasks (2 credits). Supports **35 tech stacks** including web apps, games, AI agents, desktop/mobile, extensions, bots, and APIs.
3. **Code** — The **Coder** agent writes production-quality code for each module, including **Vanta compliance scaffolding** (3 credits)
4. **Test** — The **Testing Agent** generates **actual unit tests** (Vitest) for every code module, compiled and run automatically
5. **Validate** — The **Validator** agent installs deps, type-checks (`tsc`), runs tests, and builds with Vite in a temp sandbox. If it fails, errors are fed back to the LLM for **auto-fix (up to 2 retries)** (2 credits)
6. **Review** — The **Reviewer** agent checks bugs, security, and whether validation passed or failed (1 credit)
7. **Design** — The **Graphics Editor** creates premium SVG visuals, icons, banners, and app mockups with 7 drawing tools, brand-native gradients, and neon glow effects
8. **Deploy** — One-click **Vercel** (if token set), **ZIP download** (always), or **GitHub push** (optional)

All phases stream live via **Server-Sent Events**. Watch the build progress in real time.

## What AppForge Does NOT Guarantee

| Claim | Reality |
|---|---|
| "Any app works perfectly" | **NO.** LLMs make mistakes. Complex apps (multi-player games, real-time systems, hardware integrations) often have compilation or logic errors that need manual developer fixes. |
| "Deploy and forget" | **NO.** Deployed apps need environment variables, database setup, and external API keys configured separately. AppForge generates the code; you configure the infrastructure. |
| "Zero security review needed" | **NO.** While Vanta scaffolding is injected, you must still review auth flows, secret handling, and data access before production. |
| "Games run at 60fps out-of-the-box" | **NO.** Phaser/Three.js games are generated as starter templates. Performance optimization, asset loading, and level design are manual work. |
| "AI agents are fully autonomous" | **NO.** Generated agents have tool-calling scaffolding. You must wire actual API keys, define tool schemas, and handle error recovery manually. |

**AppForge's honest value:** It generates a **solid, compilable starting point** with tests, compliance files, and proper structure — saving you days of boilerplate. For simple CRUD apps and landing pages, it often works out-of-the-box. For complex systems, it accelerates development by 50-70% but still requires a developer.

## Build Success Rates (Honest Estimates)

| App Type | First-try Compile | After Auto-fix (2 retries) | Manual Fixes Still Needed |
|---|---|---|---|
| Simple CRUD web app (React + Node) | ~70% | ~85% | Minor (styling, edge cases) |
| Landing page / marketing site | ~75% | ~90% | Minor (SEO, analytics) |
| Dashboard with charts | ~60% | ~80% | Moderate (data fetching, chart config) |
| Phaser 2D game | ~55% | ~75% | Moderate (physics tuning, asset paths) |
| Three.js 3D scene | ~50% | ~70% | Significant (shaders, lighting, models) |
| Discord/Telegram bot | ~65% | ~85% | Minor (webhook config, bot token) |
| AI agent (LangChain/AutoGen) | ~45% | ~65% | Significant (tool schemas, memory, RAG setup) |
| Chrome/VS Code extension | ~55% | ~75% | Moderate (manifest, permissions, publishing) |
| AWS Lambda service | ~60% | ~80% | Moderate (IAM roles, API Gateway mapping) |
| Unity/Godot WebGL export | ~40% | ~60% | Significant (engine-specific asset loading) |

These are estimates based on LLM code generation reliability. The **Validator** will tell you definitively whether YOUR specific build compiled.

## What it does

1. **Describe** — Write your idea on the home page (e.g., "A React CRM with Supabase auth and Stripe billing")
2. **Plan** — The **Planner** agent creates an architecture blueprint with tasks (2 credits)
3. **Code** — The **Coder** agent generates all source files: models, routes, components, hooks (3 credits)
4. **Test** — The **Testing Agent** generates and runs actual unit tests (Vitest) for every module (0 credits — runs with Coder)
5. **Validate** — The **Validator** agent installs deps, type-checks (`tsc`), runs tests, and builds with Vite in a temp sandbox. If it fails, errors are fed back for **auto-fix (up to 2 retries)** (2 credits)
6. **Review** — The **Reviewer** agent checks bugs, security, and whether validation passed or failed (1 credit)
7. **Design** — The **Graphics Editor** lets you create and customize premium SVG visuals, icons, banners, and mockups for your app using 7 drawing tools, 6 templates, neon glow effects, and brand-native gradients
8. **Deploy** — One-click push to **Vercel** (if token set), **ZIP download** (always), or **GitHub push** (optional)

All build phases stream live via Server-Sent Events so you watch progress in real time.

## Subscription Tiers

| Tier | Price | Builds | Credits | Trial |
|---|---|---|---|---|
| **Free** | $0 | 3/month | 20 | — |
| **Starter** | $49/mo | 16/month | 100 | 7-day |
| **Builder** | $149/mo | 66/month | 400 | 7-day |
| **Studio** | $399/mo | Unlimited | 1,500 | 7-day |
| **Enterprise** | $896+/mo | Custom contract | Unlimited | Custom |

**Credit usage per build:**
- Planner: 2 credits (architecture blueprint)
- Coder: 3 credits (all source files)
- Validator: 2 credits (compile + test + auto-fix in sandbox)
- Reviewer: 1 credit (quality report)
- Testing Agent: 0 credits (runs automatically with Coder)
- **Total per build: 8 credits**

If you run out mid-build, the pipeline **pauses** — top up credits or upgrade to resume exactly where it stopped.

## Supported Tech Stacks (35 Options)

### Web Applications
- `react-node` — React 18 + Vite + TypeScript + Express + PostgreSQL
- `react-python` — React 18 + FastAPI + PostgreSQL
- `vue-node` — Vue 3 + Vite + Express
- `svelte-node` — SvelteKit + Node.js
- `next-node` — Next.js 14 App Router + tRPC
- `angular-node` — Angular 17 + Express
- `vanilla-node` — Vanilla JS + Express
- `react-django` — React + Django REST
- `react-supabase` — React + Supabase (backend as a service)
- `remix-node` — Remix + Node.js
- `astro-node` — Astro Islands + React

### Games & 3D
- `phaser-html5` — Phaser 3 HTML5 Canvas/WebGL 2D game
- `three-js-3d` — Three.js WebGL 3D app or game
- `babylon-js-3d` — Babylon.js WebGL 3D engine
- `unity-webgl` — Unity WebGL export + HTML wrapper
- `godot-html5` — Godot 4 HTML5 export
- `react-native-game` — React Native game loop
- `flutter-game` — Flutter + Flame game engine

### AI Agents & Tools
- `ai-agent-python` — Python AI agent (OpenAI/Claude + function tools)
- `ai-agent-node` — Node.js AI agent (OpenAI SDK function calling)
- `openai-tool` — OpenAI GPTs / Assistants API custom tool
- `langchain-tool` — LangChain / LangGraph agent with RAG
- `crewai-agent` — CrewAI multi-agent crew orchestration
- `autogen-agent` — AutoGen conversational agent swarm

### Desktop & Mobile
- `electron-react` — Electron + React desktop app
- `tauri-rust` — Tauri (Rust core) + React/Vue frontend
- `react-native-expo` — React Native + Expo (iOS/Android)
- `flutter-firebase` — Flutter + Firebase backend
- `capacitor-ionic` — Ionic + Capacitor hybrid mobile

### Extensions, Bots & Automation
- `chrome-extension` — Chrome Extension MV3 + React popup
- `vscode-extension` — VS Code Extension API
- `discord-bot` — Discord.js bot
- `telegram-bot` — Telegram bot (Node or Python)
- `slack-bot` — Bolt.js Slack app
- `browser-automation` — Playwright / Puppeteer automation
- `web-scraper` — Web scraper (Python Scrapy or Node Cheerio)

### APIs & Data
- `data-visualization` — D3.js + React visualization
- `api-service` — Standalone REST / GraphQL API service
- `serverless-aws` — AWS Lambda + API Gateway + DynamoDB
- `serverless-vercel` — Vercel Serverless Functions / Edge

## Tech Stack (AppForge Platform)

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, TanStack Query, React Router |
| **API** | tRPC v11, Zod validation, Express 4 |
| **Auth** | Supabase OAuth (JWT session cookies, Secure + SameSite=Strict) |
| **Database** | PostgreSQL (Drizzle ORM), connection pooling (max 10), indexes |
| **Payments** | Stripe — Payment Links, Checkout Sessions, Webhooks, Billing Portal |
| **LLM** | OpenAI-compatible API (Planner / Coder / Reviewer / Validator / Testing agents) |
| **Deploy** | Vercel REST API v13, ZIP export, GitHub OAuth push |
| **Observability** | Sentry error tracking + performance, structured logging, health probes |
| **Rate Limits** | Per-user (authenticated) + per-IP fallback, Redis-backed optional |
| **CI/CD** | GitHub Actions — lint, typecheck, test, build, security scan |
| **Validation** | Temp sandbox: npm install → tsc → vitest → vite build (with auto-retry) |
| **Compliance** | Vanta SOC2 scaffolding auto-injected into every generated app |

## Architecture

```
src/
├── _core/           tRPC router, context, LLM invoke, env config, structured logger, cookies
├── agents/          Multi-agent pipeline with validation:
│   ├── pipeline.ts         Main orchestrator (Planner → Coder → Validator → Testing → Reviewer)
│   ├── buildValidator.ts   Real sandbox: npm install, tsc, vitest, vite build with auto-retry
│   ├── testingAgent.ts     Generates actual unit tests for every module (Vitest + Testing Library)
│   ├── seniorDevAgent.ts   Human-in-the-loop senior developer mode
│   ├── architectAgent.ts   Architecture planning
│   ├── backendAgent.ts     Backend design
│   ├── frontendAgent.ts    Frontend design
│   ├── databaseAgent.ts    Database schema design
│   ├── devopsAgent.ts      CI/CD and deployment design
│   ├── securityAgent.ts    Security audit report
│   ├── selfHealing.ts      Production error monitoring + auto-restart
│   └── types.ts            Agent interfaces
├── components/      React components (TopNav with tier badges, ErrorBoundary, Dark mode)
├── pages/           Home (35 tech stack selector), Dashboard, Build (live SSE), Pricing, Admin (5 tabs), AIBuilder, GraphicsEditor
├── routers/         tRPC routers:
│   ├── projects.ts         CRUD + deploy + download + tierStatus + techStack enum (35 options)
│   ├── subscriptions.ts    Stripe billing, checkout, payment links, billing portal
│   ├── github.ts           GitHub OAuth repo push
│   ├── cosine.ts           AI improvements
│   ├── admin.ts            Owner-only: analytics, god codes, SMS OTP, compliance export, moderation
│   └── moderation.ts       Content flagging, 3-strike auto-ban
├── db/              Drizzle schema + 15 tables with indexes:
│   ├── users, projects, subscriptions, credits, transactions
│   ├── userStrikes, moderationFlags, godCodes, smsVerifications
│   ├── complianceRecords, userSessions, agentLogs, githubConnections
│   ├── cosineConnections, seniorDevTasks, buildSnapshots
│   └── schema.ts           All tables, relations, and indexes
├── webhooks/        Stripe webhook handler (6 events)
├── middleware/      Supabase auth, rate limiting, slow-down, helmet, compression, CORS
├── routes/          Express: health (/live, /ready), build SSE, checkout, AI REST (legacy)
├── services/        Vercel deployer, ZIP exporter, compliance-template.ts, build-queue.ts, template-service.ts
├── utils/           AppError classes, env validator (checks all new keys), smoke tests, trpc client
└── __tests__/       Vitest: integration, setup, LLM, pipeline, hook tests
```

## Premium Visual Suite

### Graphics Editor (`/editor`)
A built-in premium design tool that creates **programmatic SVG** assets — not raster PNGs. Infinitely scalable at any size with no pixelation.

| Feature | Details |
|---------|---------|
| **7 Drawing Tools** | Select (move/resize), Rectangle, Circle, Text (12–96px), Line, Arrow, Image placeholder |
| **7 Gradient Presets** | Blue→Cyan, Gold→Amber, Violet→Pink, Teal→Emerald, Silver→Steel, Rose→Red, Orange→Amber |
| **Premium Effects** | Neon glow (`feGaussianBlur`), drop shadow (`feDropShadow`), brand-native 15-color palette |
| **6 Templates** | Social Post (1200×630), App Mockup (800×1000), Logo Canvas (600×600), Tech Diagram (1200×800), Hero Banner (1920×1080), App Icon (512×512) |
| **Export** | Native SVG download or copy raw SVG code to clipboard |
| **Keyboard** | Delete to remove selected element |

### Brand Kit (`public/branding/`)
Production-grade brand assets establishing the AppForge visual identity:

| Asset | Description |
|-------|-------------|
| `logo-mark.svg` | 1:1 three-node constellation mark (electric blue + neon cyan + silver) |
| `wordmark.svg` | 5:4 "AppForge" logotype in Inter Medium with gradient fill |
| `hero-banner.svg` | 16:9 constellation background with premium gradients |
| `social-preview.svg` | 1200×630 dark preview card |
| `feature-billing.svg` | Feature callout for billing capabilities |
| `feature-deploy.svg` | Feature callout for deployment |
| `feature-pipeline.svg` | Feature callout for multi-agent pipeline |
| `feature-security.svg` | Feature callout for security |
| `BRAND-GUIDELINES.md` | Full brand specification: colors, typography, gradients, spacing, sizing |

**Brand colors:** `#080c18` (deep navy), `#0d1117` (app background), `#4aa3ff` (electric blue), `#00e5ff` (neon cyan), `#00d4aa` (emerald success), `#ff6b35` (alert orange), `#f43f5e` (error red), `#fbbf24` (gold), `#f472b6` (rose).

## Prerequisites

- Node.js 20+
- npm 10+
- Git
- **Supabase project** (auth + database)
- **Stripe account** with 3+ Price IDs and Payment Links
- **OpenAI or Forge API key** (REQUIRED — without this, AI builds cannot run)
- **Vercel token** (optional — for one-click deploy)
- **GitHub OAuth app** (optional — for repo export)
- **Sentry account** (optional — for error tracking)
- **Twilio account** (optional — for SMS god code verification)
- **Resend account** (optional — for email notifications)
- **Redis server** (optional — for distributed rate limiting + build queue)

## Local Setup

```bash
git clone https://github.com/Anselm04/AppForge.git
cd AppForge

# Install dependencies
npm install

# Create environment
cp .env.example .env
# Edit .env — see .env.example for all required variables

# Validate your environment (catches missing keys)
npx tsx scripts/validate-env.ts --strict

# Generate and apply database migrations
npm run db:generate
npm run db:migrate

# Start dev server
npm run dev
```

The Vite dev server runs on `http://localhost:5173`. The Express API runs on `http://localhost:3000`.

## Critical Environment Variables

```bash
# Supabase (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
DATABASE_URL=postgresql://postgres:password@db...supabase.co:5432/postgres

# Stripe (REQUIRED for billing)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_STARTER_PRICE_ID=price_xxxxx
STRIPE_BUILDER_PRICE_ID=price_xxxxx
STRIPE_STUDIO_PRICE_ID=price_xxxxx
STRIPE_STARTER_PAYMENT_LINK=https://buy.stripe.com/xxxxx
STRIPE_BUILDER_PAYMENT_LINK=https://buy.stripe.com/xxxxx
STRIPE_STUDIO_PAYMENT_LINK=https://buy.stripe.com/xxxxx

# Auth (REQUIRED)
JWT_SECRET=<openssl rand -base64 48>
COOKIE_SECRET=<openssl rand -base64 48>

# Owner / Admin (REQUIRED for moderation & god codes)
OWNER_EMAIL=your-email@example.com
OWNER_PHONE=+1234567890

# LLM (REQUIRED — without this, builds cannot run)
BUILT_IN_FORGE_API_KEY=your-openai-or-forge-api-key
BUILT_IN_FORGE_API_URL=https://api.openai.com/v1  (or https://forge.manus.im/v1)

# Production
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production

# Optional
SENTRY_DSN=https://key@sentry.io/project-id
VERCEL_TOKEN=vt_xxxxx
REDIS_URL=redis://localhost:6379
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
HCAPTCHA_SECRET=0x...
RESEND_API_KEY=re_xxxxx
VANTA_WORKSPACE_ID=vanta_xxxxx
VANTA_API_TOKEN=vanta_xxxxx
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server + Express backend concurrently |
| `npm run build` | Type-check and create production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run Vitest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | ESLint on `src/**/*.ts,tsx` |
| `npm run format` | Prettier format |
| `npm run db:generate` | Generate Drizzle migration SQL |
| `npm run db:migrate` | Apply migrations to database |
| `npm run db:studio` | Open Drizzle Studio GUI |

## Docker

```bash
# Build and start the containerised stack
docker compose up --build

# Stop
docker compose down
```

See [DOCKER.md](DOCKER.md) for full Compose configuration.

## CI / GitHub Actions

`.github/workflows/ci.yml` runs on every push and PR:

1. **Lint** — ESLint + Prettier check
2. **Type Check** — `tsc --noEmit`
3. **Test** — Vitest with coverage (artifacts uploaded)
4. **Build** — Production build + Sentry source maps upload (if `SENTRY_AUTH_TOKEN` secret is set)
5. **Security Scan** — `npm audit` + `audit-ci`
6. **Summary** — Reports all job statuses; fails if build or test did not pass

Before opening a PR, run:
```bash
npm run typecheck
npm run test -- --run
npm run build
```

## Production Deployment Checklist

- [ ] Run `npx tsx scripts/validate-env.ts --strict` — zero errors, all required keys present
- [ ] Run `npm run db:generate && npm run db:migrate`
- [ ] In Stripe Dashboard: register webhook endpoint `https://yourdomain.com/api/webhooks/stripe`
- [ ] Enable these 6 Stripe webhook events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- [ ] In Stripe Payment Link settings: set after-payment redirect to `https://yourdomain.com/dashboard?success=true`
- [ ] Set `NODE_ENV=production` and `CORS_ORIGIN=https://yourdomain.com`
- [ ] Verify `/health`, `/health/live`, `/health/ready` all return 200
- [ ] Install `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` (`npm install` — needed for tests)
- [ ] Run `npm run typecheck` and `npm run test -- --run` locally before deploy
- [ ] Set up hCaptcha widget on Home.tsx (needs `HCAPTCHA_SITE_KEY` frontend + `HCAPTCHA_SECRET` backend)
- [ ] Configure Twilio for god code SMS (optional — `TWILIO_*` env vars)
- [ ] Configure Resend for email notifications (optional — `RESEND_API_KEY`)
- [ ] Configure Redis + BullMQ for build queue (optional — otherwise builds run synchronously)

## Security & Governance

- **Owner-only admin dashboard** — `ownerOnlyProcedure` is hard-locked to `OWNER_EMAIL`. No role escalation exploits possible.
- **3-strike moderation** — Regex-based content flagging on all build descriptions. 3 auto-flags = permanent ban with audit log.
- **God codes** — SHA256-encrypted, one-use, tier-specific. SMS OTP verification via Twilio before activation (if configured).
- **Vanta compliance** — Every generated app receives 9 mandatory files: audit logger, access controls, encryption policy, GDPR privacy policy, SOC2 boilerplate, incident response, data retention, security training, and third-party risk assessment.
- **HTTPS redirect** — 301 in production
- **Secure cookies** — `HttpOnly`, `Secure`, `SameSite=Strict`
- **Rate limiting** — Per-user + per-IP fallback, Redis-backed distributed optional
- **Slow-down** — Progressive delays
- **Helmet + CORS** — Whitelisted origins
- **Webhook signature verification** — Stripe `stripe-signature` header required
- **Zod validation** — All tRPC inputs and Express bodies
- **SQL injection safe** — Drizzle ORM parameterized queries
- **Graceful shutdown** — SIGTERM/SIGINT closes server, drains DB pool, force-exits after 30s

## Health & Monitoring

| Endpoint | What it checks |
|---|---|
| `GET /health` | Full health: DB connection, uptime, version |
| `GET /health/live` | Liveness probe (lightweight) |
| `GET /health/ready` | Readiness probe (DB connectivity) |

**Sentry** captures 500s with request context, user scope, and source maps. **Structured logging** emits JSON logs (method, path, status, duration, userId) compatible with Logtail / Datadog.

## Honest FAQ

**Q: Will my app work perfectly after clicking "Deploy"?**
A: For simple apps (CRUD, landing pages), often yes. For complex apps (games, real-time systems, AI agents), probably not. The **Validator** tells you if it compiled, but logical correctness requires your review.

**Q: Can it build a full MMORPG?**
A: It can generate a Phaser/Three.js starter with player movement, collision, and basic multiplayer scaffolding. A real MMORPG needs months of netcode, asset pipelines, and balance design. AppForge gives you the skeleton.

**Q: Can it build an AI agent that replaces a developer?**
A: No. It generates agent scaffolding (tool schemas, LLM calls, memory). The actual reasoning, tool integration, and error recovery require human design.

**Q: Why does the build sometimes fail validation?**
A: LLMs hallucinate imports, forget type annotations, or mismatch API versions. The **auto-fix loop** retries twice. If it still fails, you download the code, fix the errors, and learn what went wrong from `REVIEW.md`.

**Q: Is this safe for production customer data?**
A: The **AppForge platform** (this repo) is production-hardened. The **apps it generates** are starter templates with Vanta scaffolding. You must still audit auth, review data flows, and run penetration tests before handling real PII.

**Q: What happens if I run out of credits mid-build?**
A: The pipeline **pauses** at the current agent phase. Your project status becomes "paused". Upgrade your plan or purchase credits, then resume — the build continues exactly where it stopped, no progress lost.

**Q: Can I use the generated code commercially?**
A: Yes. The code is yours. AppForge injects Vanta compliance scaffolding to help with audits, but you are responsible for reviewing, testing, and deploying safely.

**Q: What does the Graphics Editor produce?**
A: Native, programmatic SVG assets — not raster images. Every element is infinitely scalable with no pixelation at any size. You get `<defs>` gradients, `<filter>` neon glows and drop shadows, and raw SVG code you can embed directly in your app or download as a file. See `public/branding/` for the production brand kit built with the same system.

## License

MIT License — see [LICENSE](LICENSE).

## Support

Open a GitHub issue with:
1. Your tech stack and app description
2. The `REVIEW.md` from your build (it contains the validation result and known issues)
3. Validation result (passed stage or specific error messages)
4. Your tier and build ID

**Do not paste API keys, secrets, or credit card numbers in public issues.**
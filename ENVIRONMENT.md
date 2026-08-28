# AppForge Environment Variables

Copy `.env.example` to `.env` and fill in values. Validate before deploy:

```bash
npm run validate-env          # warnings in development
npm run validate-env -- --strict   # fail on missing production requirements
```

## Validation (source of truth)

Runtime validation lives in **`src/utils/env-validator.ts`** (`validateEnv()`). It is invoked by:

- `npm run validate-env` (CLI)
- Server startup (production errors block boot; development logs warnings)

There is **no** `src/config/index.ts` — do not reference it in docs or scripts.

Example checks:

```typescript
// src/utils/env-validator.ts (abbreviated)
if (!config.SUPABASE_URL && !config.DATABASE_URL && !config.SUPABASE_DB_URL) {
  errors.push("Database connection required...");
}
if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
  errors.push(
    "JWT_SECRET is required and must be at least 32 characters in production",
  );
}
```

If the app fails to start, run `npm run validate-env -- --strict` and compare with `.env.example`.

---

## Required for production (full builder)

| Variable                                              | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `NODE_ENV`                                            | `production`                  |
| `DATABASE_URL` or `SUPABASE_DB_URL` or `SUPABASE_URL` | PostgreSQL / Supabase         |
| `JWT_SECRET`                                          | Session signing (≥ 32 chars)  |
| `COOKIE_SECRET`                                       | Cookie signing (≥ 32 chars)   |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`  | Client auth                   |
| `SUPABASE_SERVICE_ROLE_KEY`                           | Server verifies Supabase JWTs |
| `BUILT_IN_FORGE_API_KEY`                              | LLM for builds (required)     |
| `BUILT_IN_FORGE_API_URL`                              | OpenAI-compatible base URL    |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`          | Billing                       |
| `STRIPE_*_PRICE_ID` / payment links                   | Subscription tiers            |
| `OWNER_EMAIL`                                         | Admin lock                    |
| `CORS_ORIGIN`, `APP_URL`                              | Production URLs               |

---

## Optional integrations

### hCaptcha (project create)

When `HCAPTCHA_SECRET` is set, `projects.create` requires a valid captcha token.

- Server: `HCAPTCHA_SECRET`
- Client: `VITE_HCAPTCHA_SITE_KEY` or runtime `/config.js` → `hcaptchaSiteKey`

### SMS god-code redeem

When Twilio vars are set, redeeming a god code requires OTP to `OWNER_PHONE`.

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `OWNER_PHONE` (E.164)

If Twilio is unset, redeem works without SMS (owner-only minting still applies).

### Sentry + self-healing

- `SENTRY_DSN` — error reporting
- Self-healing watcher (`src/agents/selfHealing.ts`) starts only when **all** are set:
  - `SENTRY_DSN`, `SENTRY_API_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`

### Vanta

- `VANTA_WORKSPACE_ID`, `VANTA_API_TOKEN` — optional; compliance **scaffolding** is injected into generated apps. There is no live Vanta API sync job in AppForge server yet.

### Deploy targets (user exports)

- `VERCEL_TOKEN`, `VERCEL_TEAM_ID`
- `NETLIFY_AUTH_TOKEN`, `FLY_API_TOKEN`
- `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### Build tuning

- `BUILD_SSE_TIMEOUT_MS` — default 20 minutes for SSE build stream
- `REDIS_URL` — optional pub/sub for multi-instance SSE (builds still run in-process)

---

## Development

```bash
NODE_ENV=development
# Use .env from .env.example; JWT warnings are OK locally
npm run validate-env
npm run build && npm start   # full stack on :3000
```

---

## Vercel (static client deploy only)

Set `VITE_*` for Supabase/Stripe publishable keys. **API and webhooks** must hit your Fly (or Docker) backend — see [docs/VERCEL.md](docs/VERCEL.md).

Do **not** assume `DATABASE_URL` on Vercel runs the builder unless you also host Express elsewhere.

---

## Security

1. Never commit `.env` (gitignored).
2. Generate secrets: `openssl rand -base64 48`
3. Rotate after team changes.
4. Use `fly secrets set` or your host's secret manager in production.

---

## Troubleshooting

| Error                    | Fix                                                     |
| ------------------------ | ------------------------------------------------------- |
| Database required        | Set `DATABASE_URL` or `SUPABASE_DB_URL`                 |
| JWT_SECRET too short     | `openssl rand -base64 48`                               |
| Builds fail immediately  | Set `BUILT_IN_FORGE_API_KEY`                            |
| Captcha required locally | Unset `HCAPTCHA_SECRET` or set `VITE_HCAPTCHA_SITE_KEY` |
| Redeem asks for SMS      | Set Twilio vars or test without them in dev             |

---

## Database schema

AppForge uses Drizzle with **`ensureAppSchema()` on boot** — not `supabase/migrations/` for the Express app.

- `npm run db:migrate` → runs `ensureAppSchema()` (see `src/db/migrate.ts`)
- `supabase/migrations/` → Supabase GitHub integration only — see `supabase/migrations/README.md`

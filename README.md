# AppForge

> A TypeScript-based, multi-agent application-building platform.

AppForge is an in-development full-stack application for turning product ideas into structured build workflows. It combines a React interface, a TypeScript backend, an agent pipeline, database integration, and payment/webhook foundations.

## Status

AppForge is under active development. The repository is public for visibility, feedback, and collaboration; interfaces, agent behaviour, and configuration may change before a stable release.

## Highlights

- Multi-agent build pipeline for coordinating application-generation work
- React and TypeScript user interface
- tRPC-based backend foundations
- Supabase/PostgreSQL data layer
- Stripe webhook integration
- GitHub Actions workflows for CI, security checks, and deployment automation
- Docker files for containerised development and deployment experiments

## Architecture

```
src/
├── _core/       Core configuration, context, LLM, and tRPC utilities
├── agents/      Agent orchestration pipeline
├── components/  Shared React components
├── pages/       Home, dashboard, build, and pricing pages
├── routers/     Server/API routing
├── db/          Database schema and data-layer code
├── webhooks/    External event handlers, including Stripe
├── middleware/  API protection and error-handling middleware
└── utils/       Shared application utilities
```

## Prerequisites

- Node.js 20 or later
- npm
- Git
- A Supabase project and Stripe account if you intend to enable those integrations
- Docker Desktop or Docker Engine with Compose, optional

## Local setup

```bash
# Clone the repository
git clone https://github.com/Anselm04/AppForge..git
cd AppForge.

# Install dependencies
npm install

# Create your local environment file
cp .env.example .env

# Start the development server
npm run dev
```

The development URL is printed by Vite, normally `http://localhost:5173`.

## Environment configuration

Copy `.env.example` to `.env` and supply only the services you are using. Do not commit `.env` or production credentials.

Typical configuration includes:

```bash
# Application
NODE_ENV=development

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Optional: distributed rate limiting
REDIS_URL=redis://localhost:6379

# Optional: error monitoring
SENTRY_DSN=your-sentry-dsn
VITE_SENTRY_DSN=your-browser-sentry-dsn
```

Use the exact variable names expected by `.env.example` and the relevant source modules if they differ from this illustration.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run the Vitest test suite |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Run the configured linter |
| `npm run format` | Format source files with Prettier |

## Docker

Docker files are included for a containerised local environment.

```bash
# Build and start the development stack
docker compose up --build

# Stop the stack
docker compose down
```

See [DOCKER.md](DOCKER.md) for the included Compose configuration and deployment notes. Review environment values and exposed ports before using any production Compose configuration.

## Quality and automation

GitHub Actions workflows in `.github/workflows/` run checks for pushes and pull requests. They cover the build/test path and include security-oriented checks; review the Actions tab after every change.

Before opening a pull request, run:

```bash
npm install
npm run typecheck
npm run test -- --run
npm run build
```

## Security

- Keep secrets in environment variables or your deployment platform's secret manager.
- Rotate any credential that is accidentally committed or exposed.
- Review rate-limiting, authentication, and webhook verification before production use.
- Treat Docker, CI, and monitoring configuration as code: test it in a non-production environment first.

## Contributing

Contributions, issue reports, and architecture feedback are welcome. Please read the repository's [contribution guide](.github/CONTRIBUTING.md), use a focused branch, and include tests or clear manual verification steps with changes.

## Roadmap

Current areas of work include agent orchestration, reliable build execution, protected API routes, observability, database lifecycle management, and developer experience.

## License

This project is licensed under the terms of the [MIT License](LICENSE).

## Support

Open a GitHub issue with a reproducible description, relevant logs with secrets removed, and the expected versus actual behaviour.
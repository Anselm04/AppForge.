# Database Migrations

AppForge uses Drizzle Kit for database migrations with PostgreSQL/Supabase.

## Quick Start

```bash
# Install dependencies
npm install

# Set database URL
export DATABASE_URL=postgresql://user:password@localhost:5432/appforge

# Generate migrations from schema
npm run db:generate

# Run migrations
npm run db:migrate
```

## Commands

| Command | Purpose | Environment |
|---------|---------|-------------|
| `npm run db:generate` | Generate SQL migrations from schema | Any |
| `npm run db:migrate` | Run pending migrations | Production/Staging |
| `npm run db:push` | Push schema directly (dev only) | Development |
| `npm run db:studio` | Open Drizzle Studio UI | Development |

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_DB_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
```

## Development Workflow

1. Update `src/db/schema.ts`
2. Run `npm run db:generate`
3. Review generated SQL in `drizzle/`
4. Run `npm run db:migrate` or `npm run db:push`

## Drizzle Studio

```bash
npm run db:studio
```

Opens web UI to browse and edit your database.

## Production Deployment

1. Set `DATABASE_URL` in production environment
2. Run `npm run db:migrate` as part of deployment
3. Verify migrations completed successfully

## Best Practices

- ✅ Review generated migrations before committing
- ✅ Test migrations on local/staging database first
- ✅ Never edit committed migration files
- ✅ Use `db:push` only in development
- ✅ Keep migrations small and focused

## Resources

- [Drizzle Kit Docs](https://orm.drizzle.team/docs/kit-overview)
- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle + Supabase](https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase)

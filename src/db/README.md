# AppForge database migrations

AppForge production uses one migration authority:

- `src/db/schema.ts` defines the current Drizzle model used by application code.
- `APPFORGE_SCHEMA_MIGRATIONS` in `src/db/ensureSchema.ts` is the ordered production migration chain.
- `appforge_schema_migrations` in PostgreSQL records version, name, checksum, and applied time.
- `npm run db:migrate` executes that chain with an advisory lock and one transaction per migration.

Files under `drizzle/` are supporting historical/diff material. They are **not** a second production migration engine and must not be applied independently to the live AppForge database.

## Safety rules

1. Set `DATABASE_URL` explicitly. Production migration, backup, and restore tooling must never guess a database.
2. Never edit the SQL of an already-applied migration. The runtime verifies SHA-256 checksums and fails closed if migration history changes.
3. Add a new migration entry for every schema change.
4. Put data-quality preflight checks before stricter constraints. If invalid production rows exist, fail with an actionable reconciliation error rather than deleting or guessing data.
5. Keep migrations forward-safe and transactional. When destructive restructuring is unavoidable, use expand/backfill/contract across separate reviewed migrations.
6. Take and verify a backup before production schema changes.
7. Test empty-database, existing-production-shape, and restored-snapshot migration paths before release.

## Commands

```bash
export DATABASE_URL='<explicit-postgres-connection>'

npm run db:migrate
npm run db:generate   # development schema-diff assistance only
npm run db:studio     # development inspection only
```

`db:push` is development-only and must never replace the versioned production migration chain.

## Adding a production migration

1. Update `src/db/schema.ts`.
2. Add a new immutable entry to `APPFORGE_SCHEMA_MIGRATIONS`.
3. Include preflight/backfill SQL before any new `NOT NULL`, unique, or foreign-key constraint.
4. Add or update migration/invariant tests.
5. Update recovery documentation when migration assumptions or restore procedures change.
6. Run lint, typecheck, full tests, security scanning, production build, and release gate.
7. Back up production, run `npm run db:migrate`, then verify readiness and customer-flow checks.

## Backup and restore

Backups and restores require an explicit `DATABASE_URL`:

```bash
DATABASE_URL='<explicit-postgres-connection>' bash scripts/backup-database.sh
DATABASE_URL='<explicit-postgres-connection>' bash scripts/backup-verify.sh
DATABASE_URL='<explicit-postgres-connection>' bash scripts/backup-restore.sh backups/daily/<file>.sql.gz
```

Restore rehearsals create a separate restore database. Do not replace the current production database until the restored copy passes migration checksum verification, schema/data invariants, application readiness, and the normal release/customer-flow gates.

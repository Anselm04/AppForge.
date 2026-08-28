# Supabase migrations (integration only)

These SQL files are for **Supabase GitHub integration** and hosted Postgres provisioning — not for the Express/Drizzle app boot path.

The AppForge server applies schema via **`ensureAppSchema()`** on startup (`src/db.ts`). Running `npm run db:migrate` invokes the same helper (`src/db/migrate.ts`).

Do not assume running `supabase db push` alone is sufficient for a Fly/Docker Express deployment.

# Supabase migrations (GitHub integration only)

These SQL files are for the **Supabase GitHub Preview** check and optional Supabase-hosted Postgres with `auth.users`.

They are **not** applied by the AppForge Express server. Production app data uses **Drizzle ORM** and `ensureAppSchema()` in `src/db/ensureSchema.ts` (integer `users.id`, not UUID `auth.users`).

Do **not** run these migrations against your Fly/Drizzle database expecting the AppForge app schema.

If you use Supabase only for Auth, keep Auth in the Supabase dashboard and point `DATABASE_URL` at your Drizzle-compatible Postgres (Fly Postgres, Supabase pooler, etc.).

Migration 20261001213735 was recovered from the existing project's recorded
migration statements on 11 October 2026 after the GitHub integration reported
remote history absent from this directory. It preserves the applied SQL; no
production migration repair, reset, or replay was performed.

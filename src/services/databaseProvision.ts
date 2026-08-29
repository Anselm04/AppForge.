/** Database provisioning guidance for generated income apps (AppForge platform). */

export type DbProvider = "neon" | "supabase" | "generic";

export type DatabaseSetupGuide = {
  provider: DbProvider;
  label: string;
  steps: string[];
  migrationCommand: string;
  consoleUrl: string;
  envVars: string[];
};

export function detectDbProvider(techStack: string): DbProvider {
  if (techStack.includes("supabase")) return "supabase";
  return "neon";
}

export function databaseSetupGuide(
  techStack: string,
  options?: { projectName?: string; hasBillingSchema?: boolean },
): DatabaseSetupGuide {
  const provider = detectDbProvider(techStack);
  const name =
    options?.projectName?.replace(/[^a-z0-9-]/gi, "-").slice(0, 32) ??
    "appforge-app";
  const migration = options?.hasBillingSchema
    ? `psql "$DATABASE_URL" -f database/billing-schema.sql`
    : `psql "$DATABASE_URL" -f database/schema.sql`;

  if (provider === "supabase") {
    return {
      provider,
      label: "Supabase Postgres",
      consoleUrl: "https://supabase.com/dashboard/projects",
      envVars: ["DATABASE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      migrationCommand: migration,
      steps: [
        "Create a Supabase project at supabase.com/dashboard",
        "Settings → Database → copy Connection string (URI) → DATABASE_URL on your host",
        "Settings → API → copy URL and anon key → VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY",
        `Run migration on your machine: ${migration}`,
        "Redeploy so the app can connect to Postgres",
      ],
    };
  }

  if (provider === "neon") {
    return {
      provider,
      label: "Neon Postgres",
      consoleUrl: "https://console.neon.tech",
      envVars: ["DATABASE_URL"],
      migrationCommand: migration,
      steps: [
        `Create a Neon project (suggested name: ${name})`,
        "Copy the pooled connection string → DATABASE_URL on Vercel/Fly/Netlify",
        `Run migration: ${migration}`,
        "Enable SSL (Neon requires sslmode=require — included in connection string)",
        "Redeploy and confirm /health responds after DB is reachable",
      ],
    };
  }

  return {
    provider: "generic",
    label: "Postgres",
    consoleUrl: "https://www.postgresql.org/download/",
    envVars: ["DATABASE_URL"],
    migrationCommand: migration,
    steps: [
      "Provision any Postgres 14+ database",
      "Set DATABASE_URL on your deployment host",
      `Run migration: ${migration}`,
      "Redeploy the application",
    ],
  };
}

/** Quick check whether generated files include billing migration. */
export function hasBillingMigration(files: Record<string, string>): boolean {
  return Boolean(files["database/billing-schema.sql"]);
}

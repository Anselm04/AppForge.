import { getStackAdapter } from "./stackAdapters.js";
import type { ProductContract } from "./productContract.js";

export type DatabasePersistencePolicy = {
  required: boolean;
  modelNames: string[];
  tenantIsolationRequired: boolean;
  softDeleteRequired: boolean;
  seedRequired: boolean;
};

const SCHEMA_PATH =
  /(?:^|\/)(?:db|database|prisma|drizzle|models?|schema)(?:\/|\.|$)|firestore\.(?:rules|indexes\.json)$/i;
const MIGRATION_PATH =
  /(?:^|\/)(?:migrations?|drizzle)(?:\/|\.|$)|(?:^|\/)\d{4,}[_-].*\.(?:sql|ts|js|py|dart)$/i;
const SEED_PATH =
  /(?:^|\/)(?:seed|seeds|fixtures)(?:\/|\.|$)|(?:^|\/).*\.seed\.(?:ts|js|py|dart)$/i;
const RECOVERY_PATH =
  /(?:^|\/)(?:docs\/)?(?:database|db)[-_ ]?(?:recovery|backup|restore).*\.md$|(?:^|\/)(?:recovery|backup|restore)[-_ ]?(?:database|db).*\.md$/i;
const PERSISTENCE_PATH =
  /(?:^|\/)(?:db|database|repositories?|persistence|storage)(?:\/|\.|$)/i;

const DIRECT_DB_SECRET =
  /\b(?:DATABASE_URL|POSTGRES_URL|PGPASSWORD|MYSQL_URL|MONGODB_URI|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)\b|(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\//i;

const APPFORGE_DB_REFERENCE =
  /\bAPPFORGE_(?:DATABASE_URL|DB_URL|POSTGRES_URL)\b|\b(?:god_codes|credit_transactions|build_snapshots|agent_logs|senior_dev_tasks|cosine_connections|app_settings)\b/i;

function normalizeModelName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function textFiles(files: Record<string, string>): Array<[string, string]> {
  return Object.entries(files).filter(
    ([path]) => !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|pdf)$/i.test(path),
  );
}

function combined(entries: Array<[string, string]>): string {
  return entries.map(([, source]) => source).join("\n");
}

function isServerDatabasePath(path: string, source: string): boolean {
  if (PERSISTENCE_PATH.test(path)) return true;
  if (/^(?:server|api)\//i.test(path)) return true;
  if (/^(?:src\/server|app\/api|app\/db|lib\/server)\//i.test(path)) return true;
  if (/["']use server["']/.test(source)) return true;
  return false;
}

function isBrowserExposedCode(
  path: string,
  source: string,
  contract: ProductContract,
): boolean {
  if (/\.env(?:\.|$)/i.test(path) || /\.md$/i.test(path)) return false;
  const adapter = getStackAdapter(contract.selectedTechnologyStack);

  if (["browser", "mobile", "extension"].includes(adapter.runtime)) {
    return /\.(?:[cm]?[jt]sx?|dart|html)$/i.test(path);
  }

  if (/["']use client["']/.test(source)) return true;
  if (isServerDatabasePath(path, source)) return false;

  if (adapter.id === "react-node") {
    return /\.(?:tsx|jsx)$/i.test(path) || /^src\/(?:components|pages|hooks)\//i.test(path);
  }

  if (adapter.id === "next-node") {
    return /\.(?:tsx|jsx)$/i.test(path) && !/^app\/api\//i.test(path);
  }

  return false;
}

export function databasePersistencePolicy(
  contract: ProductContract,
): DatabasePersistencePolicy {
  const requirementText = [
    ...contract.coreWorkflows,
    ...contract.functionalRequirements.map((requirement) => requirement.text),
    ...contract.nonFunctionalRequirements,
  ].join(" ");

  const required =
    contract.secondaryCapabilities.includes("database") ||
    contract.productFamilies.includes("database");

  return {
    required,
    modelNames: [...new Set(contract.dataModels.map((model) => model.trim()).filter(Boolean))],
    tenantIsolationRequired:
      required &&
      (contract.productType === "saas_application" ||
        contract.secondaryCapabilities.includes("teams")),
    softDeleteRequired:
      required &&
      /\b(delete|deleted|deletion|archive|archived|restore|trash|recover|undo delete)\b/i.test(
        requirementText,
      ),
    seedRequired: required && contract.dataModels.length > 0,
  };
}

export function isDatabaseSchemaPath(path: string): boolean {
  return SCHEMA_PATH.test(path) && !/\.md$/i.test(path);
}

export function isDatabaseMigrationPath(path: string): boolean {
  return MIGRATION_PATH.test(path);
}

export function isDatabaseSeedPath(path: string): boolean {
  return SEED_PATH.test(path);
}

export function isDatabaseRecoveryPath(path: string): boolean {
  return RECOVERY_PATH.test(path);
}

export function databasePlannerInstruction(contract: ProductContract): string {
  const policy = databasePersistencePolicy(contract);
  if (!policy.required) return "";

  return [
    "DATABASE/PERSISTENCE PLAN — mandatory for this contract:",
    "- Include at least one task owned by the database agent.",
    "- The database task/file plan must include: schema/model definitions, at least one versioned migration, a development/test seed when data models exist, persistence/repository code, and docs/DATABASE_RECOVERY.md.",
    "- Schema must be derived from these contract data models: " +
      (policy.modelNames.length ? policy.modelNames.join(", ") : "the contract workflows"),
    "- Define indexes, relationships/foreign keys, constraints, created/updated audit fields, and validated write boundaries.",
    "- Use transaction-safe multi-record writes, explicit connection/error handling, and reversible/forward-safe migration procedures.",
    policy.tenantIsolationRequired
      ? "- This is tenant-scoped: schema and queries must enforce organization/workspace/tenant ownership."
      : "- Do not invent multi-tenancy when the contract does not require it.",
    policy.softDeleteRequired
      ? "- The contract includes delete/archive/restore behavior: plan a soft-delete/archive field and default queries that exclude deleted records."
      : "- Soft delete is optional unless the product workflow requires recoverable deletion.",
    "- Generated products must use their own database configuration. Never reference AppForge production database URLs, AppForge internal tables, or AppForge server persistence modules.",
    "- Direct database credentials are server-only. Browser/mobile/client bundles must never contain DATABASE_URL, PostgreSQL/MySQL/Mongo connection URIs, service-role keys, or database passwords.",
    "- Recovery documentation must cover migration, rollback/forward repair, backup, restore, and seed safety.",
  ].join("\n");
}

export function databaseCoderInstruction(contract: ProductContract): string {
  const policy = databasePersistencePolicy(contract);
  if (!policy.required) return "";

  return [
    "Database implementation requirements:",
    "- Implement the planned schema from the canonical product data models; do not substitute generic users/entities tables.",
    "- Include indexes, foreign-key/relationship rules, uniqueness/not-null/check constraints as appropriate, and created/updated audit fields.",
    "- Include versioned migration(s) and a database recovery document covering migrate, rollback/forward repair, backup, and restore.",
    policy.seedRequired
      ? "- Include deterministic development/test seed data guarded so it cannot accidentally seed production."
      : "- Seed data is not mandatory because this contract declares no persistent data models.",
    "- Validate user-controlled persistence inputs before writes and handle database errors explicitly.",
    "- Use a transaction for multi-record/state transitions that must commit atomically.",
    "- Configure connections from server/runtime environment only; close/release clients or pools cleanly.",
    policy.tenantIsolationRequired
      ? "- Enforce tenant/workspace/organization ownership in both schema and every tenant-scoped query."
      : "- Do not add a tenant boundary unless the contract requires one.",
    policy.softDeleteRequired
      ? "- Implement recoverable deletion using deletedAt/deleted_at, archivedAt/archived_at, or equivalent and exclude soft-deleted rows by default."
      : "- Hard deletion is acceptable only where the contract does not require recoverable deletion.",
    "- Never use APPFORGE_DATABASE_URL, AppForge internal persistence tables, or any host database credential.",
    "- Never expose DATABASE_URL, database passwords, service-role keys, or direct database connection URIs in browser/mobile/client code.",
  ].join("\n");
}

export function validateDatabasePersistenceArtifact(input: {
  files: Record<string, string>;
  contract: ProductContract;
}): string[] {
  const policy = databasePersistencePolicy(input.contract);
  if (!policy.required) return [];

  const entries = textFiles(input.files);
  const schemaEntries = entries.filter(([path, source]) =>
    isDatabaseSchemaPath(path) ||
    /CREATE\s+TABLE|pgTable\s*\(|sqliteTable\s*\(|model\s+\w+\s*\{|class\s+\w+\([^)]*(?:Model|Base)\)|firestore\.rules/i.test(
      source,
    ),
  );
  const migrationEntries = entries.filter(([path]) =>
    isDatabaseMigrationPath(path),
  );
  const seedEntries = entries.filter(([path]) => isDatabaseSeedPath(path));
  const recoveryEntries = entries.filter(([path]) =>
    isDatabaseRecoveryPath(path),
  );
  const persistenceEntries = entries.filter(
    ([path, source]) =>
      isServerDatabasePath(path, source) &&
      !isDatabaseMigrationPath(path) &&
      !isDatabaseSeedPath(path) &&
      !/\.md$/i.test(path),
  );

  const schemaSource = combined(schemaEntries);
  const persistenceSource = combined(persistenceEntries);
  const recoverySource = combined(recoveryEntries);
  const allSource = combined(entries);
  const problems: string[] = [];

  if (schemaEntries.length === 0) {
    problems.push("database contract: missing schema/model definition");
  }
  if (migrationEntries.length === 0) {
    problems.push("database contract: missing versioned migration");
  }
  if (policy.seedRequired && seedEntries.length === 0) {
    problems.push("database contract: missing development/test seed data");
  }
  if (recoveryEntries.length === 0) {
    problems.push("database contract: missing database recovery documentation");
  }
  if (persistenceEntries.length === 0) {
    problems.push("database contract: missing server-side persistence/repository implementation");
  }

  for (const modelName of policy.modelNames) {
    const token = normalizeModelName(modelName);
    const normalizedSchema = normalizeModelName(schemaSource);
    if (token && !normalizedSchema.includes(token)) {
      problems.push(
        `database contract: schema does not represent product model ${modelName}`,
      );
    }
  }

  if (
    schemaEntries.length > 0 &&
    !/CREATE\s+(?:UNIQUE\s+)?INDEX|\b(?:unique)?Index\s*\(|@@index|firestore\.indexes/i.test(
      schemaSource,
    )
  ) {
    problems.push("database contract: schema has no index definitions");
  }

  if (
    schemaEntries.length > 0 &&
    !/REFERENCES|\.references\s*\(|foreignKey|relations?\s*\(|belongsTo|hasMany/i.test(
      schemaSource,
    )
  ) {
    problems.push("database contract: schema has no relationship/foreign-key evidence");
  }

  if (
    schemaEntries.length > 0 &&
    !/NOT\s+NULL|\.notNull\s*\(|PRIMARY\s+KEY|primaryKey|UNIQUE|\.unique\s*\(|CHECK\s*\(/i.test(
      schemaSource,
    )
  ) {
    problems.push("database contract: schema has no constraint evidence");
  }

  if (
    schemaEntries.length > 0 &&
    !/(?:createdAt|created_at)[\s\S]*(?:updatedAt|updated_at)|(?:updatedAt|updated_at)[\s\S]*(?:createdAt|created_at)/i.test(
      schemaSource,
    )
  ) {
    problems.push("database contract: schema is missing created/updated audit fields");
  }

  if (
    persistenceEntries.length > 0 &&
    !/zod|z\.object|safeParse|\.parse\s*\(|pydantic|BaseModel|validate\w*\s*\(/i.test(
      persistenceSource,
    )
  ) {
    problems.push("database contract: persistence writes have no input-validation evidence");
  }

  if (
    persistenceEntries.length > 0 &&
    !/\.transaction\s*\(|\bBEGIN\b|\bCOMMIT\b|runTransaction|transaction\.atomic|session\.begin/i.test(
      persistenceSource,
    )
  ) {
    problems.push("database contract: no transaction handling evidence");
  }

  if (
    persistenceEntries.length > 0 &&
    !/try\s*\{|catch\s*\(|except\s+|finally\s*\{/i.test(persistenceSource)
  ) {
    problems.push("database contract: no explicit database error handling");
  }

  if (
    persistenceEntries.length > 0 &&
    !/DATABASE_URL|createPool|\bPool\s*\(|postgres\s*\(|drizzle\s*\(|PrismaClient|createClient\s*\(|sqlalchemy|AsyncSession|firebase|firestore|process\.env|os\.environ|getenv/i.test(
      persistenceSource,
    )
  ) {
    problems.push("database contract: no environment-backed connection handling");
  }

  if (policy.tenantIsolationRequired) {
    const tenantPattern =
      /tenant_?id|tenantId|organization_?id|organizationId|workspace_?id|workspaceId/i;
    if (!tenantPattern.test(schemaSource)) {
      problems.push("database contract: tenant-scoped product schema has no tenant ownership key");
    }
    if (
      !tenantPattern.test(persistenceSource) ||
      !/where|filter|eq\s*\(|query|select/i.test(persistenceSource)
    ) {
      problems.push("database contract: tenant-scoped persistence does not prove tenant-filtered queries");
    }
  }

  if (
    policy.softDeleteRequired &&
    !/deleted_?at|deletedAt|archived_?at|archivedAt|is_?deleted|isDeleted/i.test(
      schemaSource + "\n" + persistenceSource,
    )
  ) {
    problems.push("database contract: recoverable delete workflow has no soft-delete/archive implementation");
  }

  if (policy.seedRequired && seedEntries.length > 0) {
    const seedSource = combined(seedEntries);
    if (
      !/NODE_ENV|APP_ENV|development|test|ALLOW_?SEED|SEED_?DATABASE/i.test(
        seedSource,
      )
    ) {
      problems.push("database contract: seed script has no non-production safety guard");
    }
  }

  if (
    recoveryEntries.length > 0 &&
    !/migration|migrate/i.test(recoverySource)
  ) {
    problems.push("database contract: recovery docs do not cover migrations");
  }
  if (
    recoveryEntries.length > 0 &&
    !/backup/i.test(recoverySource)
  ) {
    problems.push("database contract: recovery docs do not cover backups");
  }
  if (
    recoveryEntries.length > 0 &&
    !/restore/i.test(recoverySource)
  ) {
    problems.push("database contract: recovery docs do not cover restore");
  }
  if (
    recoveryEntries.length > 0 &&
    !/rollback|roll forward|forward repair/i.test(recoverySource)
  ) {
    problems.push("database contract: recovery docs do not cover rollback/forward repair");
  }

  for (const [path, source] of entries) {
    if (
      isBrowserExposedCode(path, source, input.contract) &&
      DIRECT_DB_SECRET.test(source)
    ) {
      problems.push(
        `database contract: browser/client file exposes direct database credential material: ${path}`,
      );
    }
  }

  if (APPFORGE_DB_REFERENCE.test(allSource)) {
    problems.push(
      "database contract: generated product references AppForge production persistence",
    );
  }

  const nonDocsSource = combined(
    entries.filter(([path]) => !/\.md$/i.test(path)),
  );
  if (
    /(?:DATABASE_URL|POSTGRES_URL|MYSQL_URL|MONGODB_URI)\s*=\s*["'`]?(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\//i.test(
      nonDocsSource,
    )
  ) {
    problems.push("database contract: hard-coded database connection URI detected");
  }

  return [...new Set(problems)];
}

import type { Agent, AgentContext, AgentResult } from "./types.js";

type DatabaseRequirements = {
  dataModels?: unknown;
  secondaryCapabilities?: unknown;
  productType?: unknown;
  coreWorkflows?: unknown;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

export const DatabaseAgent: Agent = {
  role: "database",
  name: "Database Agent",
  description:
    "Designs contract-derived persistence, migrations, constraints, tenancy, and recovery.",
  async run(context: AgentContext): Promise<AgentResult> {
    const requirements = (context.requirements ?? {}) as DatabaseRequirements;
    const architecture = (context.architecture ?? {}) as {
      databaseModules?: unknown;
    };

    const dataModels = [
      ...stringArray(requirements.dataModels),
      ...stringArray(architecture.databaseModules),
    ].filter((value, index, values) => values.indexOf(value) === index);

    const capabilities = stringArray(requirements.secondaryCapabilities);
    const tenantScoped =
      requirements.productType === "saas_application" ||
      capabilities.includes("teams");
    const workflows = stringArray(requirements.coreWorkflows);
    const recoverableDelete = workflows.some((workflow) =>
      /delete|archive|restore|recover|trash/i.test(workflow),
    );

    const warnings =
      dataModels.length === 0
        ? [
            "No contract data models were supplied; schema generation must stop for clarification instead of inventing generic tables.",
          ]
        : undefined;

    const details = {
      source: "canonical product contract",
      dataModels,
      requiredArtifacts: [
        "schema/model definitions",
        "versioned migration",
        ...(dataModels.length > 0 ? ["development/test seed"] : []),
        "server-side persistence/repository implementation",
        "database recovery documentation",
      ],
      schemaRules: [
        "indexes for query/access paths",
        "explicit relationships and foreign keys",
        "not-null/unique/check constraints where domain invariants require them",
        "created/updated audit fields",
        ...(tenantScoped
          ? ["tenant/workspace/organization ownership keys"]
          : []),
        ...(recoverableDelete ? ["soft-delete/archive field"] : []),
      ],
      runtimeRules: [
        "validate user-controlled writes",
        "transaction-wrap atomic multi-record state changes",
        "handle connection and query failures explicitly",
        "load database credentials from server runtime configuration only",
        "never reuse AppForge production database credentials or internal tables",
      ],
      recoveryRules: [
        "forward-safe versioned migrations",
        "pre-migration backup",
        "rollback or forward-repair procedure",
        "restore rehearsal before promotion",
      ],
    };

    return {
      taskId: "database-task",
      role: "database",
      summary:
        dataModels.length > 0
          ? `Designed persistence requirements for: ${dataModels.join(", ")}.`
          : "Database design blocked until contract data models are available.",
      details,
      warnings,
    };
  },
};

export default DatabaseAgent;

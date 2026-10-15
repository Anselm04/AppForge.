import type { ProductType } from "../productContract.js";
import type { BuilderResourceRegistry } from "./resourceRegistry.js";
import { composeBuilderResources } from "./resourceComposition.js";

export type ReferenceArchitectureRecipe = {
  id: string;
  name: string;
  productType: ProductType;
  commonRequirements: string[];
  recommendedResourceIds: string[];
  alternativeStacks: string[];
  dataModel: string[];
  authModel: string;
  monetizationOptions: string[];
  externalIntegrations: string[];
  criticalTests: string[];
  securityConcerns: string[];
  deploymentCharacteristics: string[];
};

function recipe(
  id: string,
  name: string,
  productType: ProductType,
  resources: string[],
  overrides: Partial<
    Omit<
      ReferenceArchitectureRecipe,
      "id" | "name" | "productType" | "recommendedResourceIds"
    >
  > = {},
): ReferenceArchitectureRecipe {
  return {
    id,
    name,
    productType,
    commonRequirements: overrides.commonRequirements ?? [
      "secure authenticated access where user data exists",
      "persistent data ownership",
      "observable failures",
      "exportable source",
    ],
    recommendedResourceIds: resources,
    alternativeStacks: overrides.alternativeStacks ?? [
      "react-node",
      "next-node",
      "flutter-node",
    ],
    dataModel: overrides.dataModel ?? ["User", "DomainRecord", "AuditEvent"],
    authModel:
      overrides.authModel ??
      "Authenticated users with least-privilege ownership",
    monetizationOptions: overrides.monetizationOptions ?? [
      "subscription",
      "one-time purchase",
      "free",
    ],
    externalIntegrations: overrides.externalIntegrations ?? [],
    criticalTests: overrides.criticalTests ?? [
      "authorization boundaries",
      "persistence and recovery",
      "build/runtime behavior",
      "export independence",
    ],
    securityConcerns: overrides.securityConcerns ?? [
      "input validation",
      "authorization",
      "secret isolation",
      "dependency provenance",
    ],
    deploymentCharacteristics: overrides.deploymentCharacteristics ?? [
      "environment-specific configuration",
      "health checks",
      "rollback evidence",
    ],
  };
}

export const REFERENCE_ARCHITECTURES: ReferenceArchitectureRecipe[] = [
  recipe("saas", "SaaS product", "saas_application", [
    "core.authentication",
    "core.account",
    "core.database",
    "core.api",
    "core.billing",
    "core.webhooks",
    "core.analytics",
    "core.observability",
  ]),
  recipe(
    "ecommerce",
    "Ecommerce product",
    "ecommerce_product",
    [
      "core.authentication",
      "core.account",
      "core.database",
      "core.api",
      "core.billing",
      "core.webhooks",
      "core.notifications",
      "core.analytics",
    ],
    {
      dataModel: [
        "User",
        "Product",
        "Cart",
        "Order",
        "Inventory",
        "PaymentEvent",
      ],
    },
  ),
  recipe(
    "marketplace",
    "Marketplace",
    "saas_application",
    [
      "core.authentication",
      "core.account",
      "core.database",
      "core.api",
      "core.billing",
      "core.notifications",
      "capability.collab",
    ],
    { dataModel: ["User", "Listing", "Order", "Conversation", "Review"] },
  ),
  recipe(
    "crm",
    "CRM",
    "saas_application",
    [
      "core.authentication",
      "core.database",
      "core.api",
      "core.search",
      "core.analytics",
      "core.notifications",
      "capability.collab",
    ],
    { dataModel: ["Account", "Contact", "Opportunity", "Activity", "Task"] },
  ),
  recipe(
    "project-management",
    "Project management",
    "saas_application",
    [
      "core.authentication",
      "core.database",
      "core.api",
      "core.notifications",
      "capability.collab",
      "core.analytics",
    ],
    { dataModel: ["Workspace", "Project", "Task", "Comment", "Membership"] },
  ),
  recipe("analytics", "Analytics/data product", "data_product", [
    "core.authentication",
    "core.database",
    "core.api",
    "core.analytics",
    "capability.data",
    "core.observability",
  ]),
  recipe("social-community", "Social/community product", "saas_application", [
    "core.authentication",
    "core.account",
    "core.database",
    "core.storage",
    "core.notifications",
    "capability.collab",
    "core.search",
  ]),
  recipe(
    "education",
    "Educational platform",
    "saas_application",
    [
      "core.authentication",
      "core.account",
      "core.database",
      "core.notifications",
      "capability.education",
      "capability.video",
      "capability.ar",
      "capability.localization",
    ],
    {
      dataModel: [
        "Organization",
        "Course",
        "Module",
        "Lesson",
        "Enrollment",
        "Assessment",
        "Submission",
        "Progress",
      ],
    },
  ),
  recipe(
    "healthcare",
    "Healthcare application",
    "saas_application",
    [
      "core.authentication",
      "core.authorization",
      "core.database",
      "core.security",
      "core.observability",
      "capability.healthcare",
      "core.notifications",
    ],
    {
      securityConcerns: [
        "sensitive-data boundaries",
        "least privilege",
        "auditability",
        "retention",
        "notification privacy",
        "professional compliance review",
      ],
    },
  ),
  recipe(
    "fintech",
    "Fintech application",
    "saas_application",
    [
      "core.authentication",
      "core.authorization",
      "core.database",
      "core.security",
      "core.observability",
      "core.billing",
      "core.webhooks",
      "capability.fintech",
    ],
    {
      securityConcerns: [
        "ledger integrity",
        "idempotency",
        "reconciliation",
        "auditability",
        "regulatory review",
      ],
    },
  ),
  recipe(
    "booking",
    "Booking/reservations product",
    "saas_application",
    [
      "core.authentication",
      "core.database",
      "core.api",
      "core.notifications",
      "core.background-jobs",
      "core.billing",
      "capability.mobile",
      "capability.voice",
    ],
    {
      dataModel: [
        "User",
        "Resource",
        "Availability",
        "Booking",
        "NotificationPreference",
      ],
    },
  ),
  recipe("real-estate", "Real estate product", "saas_application", [
    "core.authentication",
    "core.database",
    "core.storage",
    "core.search",
    "core.notifications",
    "capability.graphics",
    "capability.data",
  ]),
  recipe("fitness", "Fitness product", "mobile_app", [
    "core.authentication",
    "core.account",
    "core.database",
    "core.notifications",
    "capability.mobile",
    "capability.data",
    "capability.localization",
  ]),
  recipe("travel", "Travel product", "mobile_app", [
    "core.authentication",
    "core.database",
    "core.search",
    "core.notifications",
    "capability.mobile",
    "capability.localization",
    "capability.web-search",
  ]),
  recipe("restaurant", "Restaurant product", "mobile_app", [
    "core.authentication",
    "core.database",
    "core.notifications",
    "core.background-jobs",
    "core.billing",
    "capability.mobile",
    "capability.voice",
    "capability.localization",
  ]),
  recipe(
    "portfolio",
    "Portfolio/content site",
    "website",
    [
      "capability.graphics",
      "capability.marketing",
      "capability.localization",
      "core.analytics",
    ],
    { monetizationOptions: ["free", "lead generation"] },
  ),
  recipe("content-news", "Content/news platform", "saas_application", [
    "core.authentication",
    "core.database",
    "core.storage",
    "core.search",
    "core.analytics",
    "capability.marketing",
    "capability.localization",
  ]),
  recipe(
    "ai-agent",
    "AI-agent product",
    "ai_agent",
    [
      "core.authentication",
      "core.database",
      "core.api",
      "core.security",
      "core.observability",
      "core.background-jobs",
      "capability.web-search",
    ],
    {
      securityConcerns: [
        "tool permissions",
        "prompt injection",
        "secret isolation",
        "audit logs",
        "cost limits",
        "model/provider boundaries",
      ],
    },
  ),
  recipe("automation", "Automation product", "automation_tool", [
    "core.authentication",
    "core.api",
    "core.webhooks",
    "core.background-jobs",
    "core.observability",
    "core.security",
  ]),
  recipe("api-service", "API service", "api", [
    "core.authentication",
    "core.authorization",
    "core.database",
    "core.api",
    "core.security",
    "core.observability",
  ]),
  recipe("mobile-consumer", "Mobile consumer application", "mobile_app", [
    "core.authentication",
    "core.account",
    "core.database",
    "core.notifications",
    "capability.mobile",
    "capability.localization",
    "core.analytics",
  ]),
  recipe(
    "desktop",
    "Desktop application",
    "desktop_app",
    [
      "core.authentication",
      "core.database",
      "core.storage",
      "core.observability",
      "capability.localization",
    ],
    { alternativeStacks: ["electron", "tauri", "flutter"] },
  ),
  recipe("browser-extension", "Browser extension", "browser_extension", [
    "core.authentication",
    "core.storage",
    "core.api",
    "core.security",
    "core.observability",
  ]),
  recipe(
    "game",
    "Game",
    "game",
    [
      "capability.game",
      "capability.graphics",
      "capability.music",
      "core.analytics",
      "capability.localization",
    ],
    { alternativeStacks: ["phaser-html5", "three-js-3d"] },
  ),
  recipe(
    "iot",
    "IoT application",
    "infrastructure",
    [
      "core.authentication",
      "core.authorization",
      "core.api",
      "core.database",
      "core.observability",
      "core.background-jobs",
      "core.security",
      "capability.data",
    ],
    {
      dataModel: [
        "Device",
        "DeviceIdentity",
        "Telemetry",
        "Command",
        "FirmwareVersion",
        "Alert",
      ],
    },
  ),
];

export type ReferenceArchitectureValidation = {
  recipeId: string;
  ok: boolean;
  missingResourceIds: string[];
  compositionConflictKinds: string[];
};

export function validateReferenceArchitecture(
  architecture: ReferenceArchitectureRecipe,
  registry: BuilderResourceRegistry,
): ReferenceArchitectureValidation {
  const all = registry.list();
  const byId = new Map(
    all.map((resource) => [resource.identity.resourceId, resource]),
  );
  const missingResourceIds = architecture.recommendedResourceIds.filter(
    (resourceId) => !byId.has(resourceId),
  );
  const resources = architecture.recommendedResourceIds
    .map((resourceId) => byId.get(resourceId))
    .filter((resource): resource is NonNullable<typeof resource> =>
      Boolean(resource),
    );
  const composition = composeBuilderResources(resources);

  return {
    recipeId: architecture.id,
    ok: missingResourceIds.length === 0 && composition.ok,
    missingResourceIds,
    compositionConflictKinds: [
      ...new Set(composition.conflicts.map((conflict) => conflict.kind)),
    ].sort(),
  };
}

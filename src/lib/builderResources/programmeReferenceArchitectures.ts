import type { ReferenceArchitectureRecipe } from "./referenceArchitectures.js";
import { REFERENCE_ARCHITECTURES } from "./referenceArchitectures.js";

const BOOKING_ARCHITECTURE_IDS = new Set([
  "booking",
  "restaurant",
  "travel",
  "fitness",
]);

const BASE_REFERENCE_ARCHITECTURES = REFERENCE_ARCHITECTURES.map(
  (architecture): ReferenceArchitectureRecipe =>
    BOOKING_ARCHITECTURE_IDS.has(architecture.id)
      ? {
          ...architecture,
          recommendedResourceIds: [
            ...new Set([
              ...architecture.recommendedResourceIds,
              "core.database",
              "core.api",
              "module.booking",
            ]),
          ],
        }
      : architecture,
);

const ADDITIONAL_REFERENCE_ARCHITECTURES: ReferenceArchitectureRecipe[] = [
  {
    id: "realtime-collaboration",
    name: "Realtime collaboration application",
    productType: "saas_application",
    commonRequirements: [
      "authenticated membership",
      "presence and reconnect",
      "conflict-safe shared state",
      "version history",
    ],
    recommendedResourceIds: [
      "core.authentication",
      "core.authorization",
      "core.database",
      "capability.collab",
      "core.observability",
    ],
    alternativeStacks: ["react-node", "next-node"],
    dataModel: ["Room", "Membership", "Presence", "Operation", "Version"],
    authModel: "Authenticated room membership with role permissions",
    monetizationOptions: ["subscription", "free"],
    externalIntegrations: ["WebSocket transport"],
    criticalTests: [
      "reconnect recovery",
      "event ordering",
      "concurrent edit conflict resolution",
      "permission isolation",
    ],
    securityConcerns: ["room isolation", "authorization", "audit history"],
    deploymentCharacteristics: [
      "long-lived realtime connections",
      "horizontal fanout strategy",
    ],
  },
  {
    id: "data-application",
    name: "Data application",
    productType: "data_product",
    commonRequirements: [
      "validated data ingestion",
      "role-aware querying",
      "accessible dashboards",
      "export controls",
    ],
    recommendedResourceIds: [
      "core.authentication",
      "core.authorization",
      "core.database",
      "core.analytics",
      "capability.data",
      "core.observability",
    ],
    alternativeStacks: ["next-node", "react-node", "python-fastapi"],
    dataModel: ["Dataset", "Metric", "Dimension", "Report", "AccessGrant"],
    authModel: "Role and row-owner scoped data access",
    monetizationOptions: ["subscription", "usage", "free"],
    externalIntegrations: ["data source connectors"],
    criticalTests: [
      "import validation",
      "row ownership",
      "aggregation correctness",
      "accessible chart summaries",
    ],
    securityConcerns: [
      "data isolation",
      "export authorization",
      "sensitive event classification",
    ],
    deploymentCharacteristics: [
      "scheduled aggregation",
      "query performance monitoring",
    ],
  },
  {
    id: "subscription-app",
    name: "Subscription application",
    productType: "saas_application",
    commonRequirements: [
      "secure account",
      "subscription lifecycle",
      "server-authoritative entitlement",
      "webhook idempotency",
    ],
    recommendedResourceIds: [
      "core.authentication",
      "core.account",
      "core.database",
      "core.billing",
      "core.webhooks",
      "core.observability",
    ],
    alternativeStacks: ["next-node", "react-node", "flutter-node"],
    dataModel: [
      "User",
      "Product",
      "Price",
      "Subscription",
      "Entitlement",
      "BillingEvent",
    ],
    authModel:
      "Authenticated customer with server-authoritative entitlement checks",
    monetizationOptions: ["subscription"],
    externalIntegrations: ["payment provider"],
    criticalTests: [
      "duplicate webhook",
      "delayed webhook",
      "failed payment",
      "cancel/downgrade",
      "entitlement persistence",
    ],
    securityConcerns: [
      "webhook signatures",
      "idempotency",
      "secret isolation",
      "client cannot grant entitlement",
    ],
    deploymentCharacteristics: [
      "public webhook endpoint",
      "durable billing event ledger",
    ],
  },
];

export const PROGRAMME_REFERENCE_ARCHITECTURES: ReferenceArchitectureRecipe[] =
  [...BASE_REFERENCE_ARCHITECTURES, ...ADDITIONAL_REFERENCE_ARCHITECTURES];

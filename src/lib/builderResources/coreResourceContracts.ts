import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const id = nonEmpty.regex(/^[A-Za-z0-9._:-]+$/);
const stringList = z.array(nonEmpty);

export const authenticationResourceSchema = z.object({
  signup: z.object({ enabled: z.boolean(), requiredFields: stringList }),
  login: z.object({
    password: z.boolean(),
    socialProviders: stringList,
    mfa: z.enum(["off", "optional", "required"]),
  }),
  logout: z.object({
    currentSession: z.boolean(),
    otherSessions: z.boolean(),
    allSessions: z.boolean(),
  }),
  password: z.object({
    reset: z.boolean(),
    change: z.boolean(),
    minimumLength: z.number().int().min(8),
  }),
  emailVerification: z.object({ required: z.boolean(), resend: z.boolean() }),
  session: z.object({
    persistence: z.boolean(),
    refresh: z.boolean(),
    revoke: z.boolean(),
    idleTimeoutMinutes: z.number().int().positive(),
  }),
  protectedRoutes: stringList,
  roles: stringList,
  ownershipEnforced: z.boolean(),
});

export const accountResourceSchema = z.object({
  profileFields: stringList,
  preferences: z.record(z.unknown()),
  passwordChange: z.boolean(),
  emailChange: z.object({ enabled: z.boolean(), reverify: z.boolean() }),
  deletion: z.object({
    enabled: z.boolean(),
    confirmationRequired: z.boolean(),
    cascadePolicy: nonEmpty,
  }),
  dataExport: z.object({
    enabled: z.boolean(),
    formats: z.array(z.enum(["json", "csv"])),
  }),
  subscriptionStatus: z.boolean(),
});

export const authorizationResourceSchema = z.object({
  roles: z.array(z.object({ id, permissions: stringList })),
  ownership: z.object({ enforced: z.boolean(), ownerField: nonEmpty }),
  tenancy: z.object({ enabled: z.boolean(), tenantField: nonEmpty.nullable() }),
  defaultDeny: z.boolean(),
  policyChecks: stringList,
  auditDeniedActions: z.boolean(),
});

export const databaseResourceSchema = z.object({
  tenancy: z.object({
    enabled: z.boolean(),
    tenantColumn: z.string().nullable(),
  }),
  ownership: z.object({
    enabled: z.boolean(),
    ownerColumn: z.string().nullable(),
  }),
  migrations: z.array(
    z.object({
      id,
      up: nonEmpty,
      down: z.string().nullable(),
      checksum: nonEmpty,
    }),
  ),
  seeds: z.array(
    z.object({
      id,
      environment: z.enum(["test", "development", "all"]),
      idempotent: z.boolean(),
    }),
  ),
  auditColumns: stringList,
  timestamps: z.boolean(),
  softDeletion: z.object({
    enabled: z.boolean(),
    column: z.string().nullable(),
  }),
  pagination: z.object({
    strategy: z.enum(["cursor", "offset"]),
    maxPageSize: z.number().int().positive(),
  }),
  rowPolicies: z.array(
    z.object({
      table: id,
      operation: z.enum(["select", "insert", "update", "delete"]),
      expression: nonEmpty,
    }),
  ),
});

export const apiResourceSchema = z.object({
  validation: z.object({ request: z.boolean(), response: z.boolean() }),
  errors: z.object({
    structured: z.boolean(),
    exposeInternalDetails: z.literal(false),
    correlationId: z.boolean(),
  }),
  logging: z.object({ structured: z.boolean(), redactSecrets: z.boolean() }),
  rateLimits: z.array(
    z.object({
      scope: nonEmpty,
      requests: z.number().int().positive(),
      windowSeconds: z.number().int().positive(),
    }),
  ),
  authMiddleware: z.boolean(),
  idempotency: z.object({ enabledForMutations: z.boolean(), header: nonEmpty }),
  health: z.object({
    path: nonEmpty,
    readiness: z.boolean(),
    liveness: z.boolean(),
  }),
});

export const storageResourceSchema = z.object({
  uploads: z.object({
    enabled: z.boolean(),
    maxBytes: z.number().int().positive(),
    allowedMimeTypes: stringList,
  }),
  signedAccess: z.object({
    enabled: z.boolean(),
    ttlSeconds: z.number().int().positive(),
  }),
  metadata: stringList,
  deletion: z.object({ enabled: z.boolean(), ownershipRequired: z.boolean() }),
  quotas: z.object({
    enabled: z.boolean(),
    bytesPerOwner: z.number().int().positive().nullable(),
  }),
  malwareScanHook: z.boolean(),
});

export const notificationResourceSchema = z.object({
  channels: z.array(z.enum(["email", "push", "sms", "in-app"])).min(1),
  preferences: z.boolean(),
  delivery: z.object({
    retries: z.number().int().nonnegative(),
    backoff: z.enum(["fixed", "exponential"]),
    stateTracked: z.boolean(),
  }),
  privacy: z.object({
    sensitivePayloadAllowed: z.boolean(),
    lockScreenRedaction: z.boolean(),
  }),
  templates: z.array(
    z.object({
      id,
      channel: z.enum(["email", "push", "sms", "in-app"]),
      localeKey: nonEmpty,
    }),
  ),
});

export const backgroundJobResourceSchema = z.object({
  queues: z.array(
    z.object({
      id,
      concurrency: z.number().int().positive(),
      maxAttempts: z.number().int().positive(),
    }),
  ),
  scheduling: z.array(
    z.object({
      id,
      expression: nonEmpty,
      timezone: nonEmpty,
      enabled: z.boolean(),
    }),
  ),
  deadLetter: z.object({
    enabled: z.boolean(),
    queueId: z.string().nullable(),
  }),
  idempotencyRequired: z.boolean(),
  progressReporting: z.boolean(),
  cancellation: z.boolean(),
});

export const webhookResourceSchema = z.object({
  endpoints: z.array(
    z.object({
      id,
      path: nonEmpty,
      signatureScheme: nonEmpty,
      allowedEvents: stringList,
    }),
  ),
  deduplication: z.object({
    enabled: z.boolean(),
    eventIdField: nonEmpty,
    ledgerRetentionDays: z.number().int().positive(),
  }),
  retry: z.object({
    safe: z.boolean(),
    maxAttempts: z.number().int().positive(),
  }),
  replayProtection: z.boolean(),
  eventLedger: z.boolean(),
});

export const searchResourceSchema = z.object({
  fields: stringList,
  fullText: z.boolean(),
  filters: z.array(z.object({ field: nonEmpty, operators: stringList })),
  indexingHooks: stringList,
  pagination: z.enum(["cursor", "offset"]),
  authorizationFilterRequired: z.boolean(),
});

export const analyticsResourceSchema = z.object({
  events: z.array(
    z.object({
      name: id,
      properties: z.record(nonEmpty),
      privacyClass: z.enum([
        "anonymous",
        "pseudonymous",
        "personal",
        "sensitive",
      ]),
    }),
  ),
  funnels: z.array(z.object({ id, steps: z.array(id).min(2) })),
  consentRequired: z.boolean(),
  optOutSupported: z.boolean(),
  retentionDays: z.number().int().positive(),
});

export const securityResourceSchema = z.object({
  secretBoundaries: z.boolean(),
  authorization: z.boolean(),
  inputValidation: z.boolean(),
  csrf: z.enum(["required", "not-applicable"]),
  xssDefense: z.boolean(),
  sqlInjectionDefense: z.boolean(),
  ssrfDefense: z.boolean(),
  rateLimiting: z.boolean(),
  dependencyScanning: z.boolean(),
  uploadValidation: z.boolean(),
  auditSecurityEvents: z.boolean(),
});

export const observabilityResourceSchema = z.object({
  logs: z.object({
    structured: z.boolean(),
    secretRedaction: z.boolean(),
    correlationIds: z.boolean(),
  }),
  metrics: z.array(
    z.object({
      name: id,
      kind: z.enum(["counter", "gauge", "histogram"]),
      unit: nonEmpty,
    }),
  ),
  traces: z.object({ enabled: z.boolean(), propagation: z.boolean() }),
  alerts: z.array(
    z.object({
      id,
      condition: nonEmpty,
      severity: z.enum(["info", "warning", "critical"]),
      destination: nonEmpty,
    }),
  ),
  healthChecks: z.object({ liveness: z.boolean(), readiness: z.boolean() }),
  errorReporting: z.boolean(),
});

export const monetizationResourceSchema = z.object({
  products: z.array(
    z.object({
      id,
      model: z.enum(["subscription", "credits", "one-time", "usage"]),
      currency: nonEmpty,
    }),
  ),
  entitlements: z.array(
    z.object({
      id,
      productId: id,
      capability: nonEmpty,
      serverAuthoritative: z.boolean(),
    }),
  ),
  subscriptions: z.object({
    enabled: z.boolean(),
    trials: z.boolean(),
    cancellation: z.boolean(),
    planChanges: z.boolean(),
  }),
  credits: z.object({ enabled: z.boolean(), ledgerRequired: z.boolean() }),
  purchases: z.object({ oneTime: z.boolean(), refunds: z.boolean() }),
  idempotency: z.boolean(),
});

export const CORE_RESOURCE_CONTRACTS = {
  authentication: authenticationResourceSchema,
  account: accountResourceSchema,
  authorization: authorizationResourceSchema,
  database: databaseResourceSchema,
  api: apiResourceSchema,
  storage: storageResourceSchema,
  notifications: notificationResourceSchema,
  billing: monetizationResourceSchema,
  webhooks: webhookResourceSchema,
  background_jobs: backgroundJobResourceSchema,
  search: searchResourceSchema,
  analytics: analyticsResourceSchema,
  security: securityResourceSchema,
  observability: observabilityResourceSchema,
  monetization: monetizationResourceSchema,
} as const;

export type CoreResourceContractId = keyof typeof CORE_RESOURCE_CONTRACTS;

export function validateCoreResourceContract(
  capability: CoreResourceContractId,
  input: unknown,
): unknown {
  return CORE_RESOURCE_CONTRACTS[capability].parse(input);
}

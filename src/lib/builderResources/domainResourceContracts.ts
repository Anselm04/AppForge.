import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const nonEmptyList = z.array(nonEmpty);
const id = nonEmpty.regex(/^[A-Za-z0-9._:-]+$/);

export const researchResourceSchema = z.object({
  query: nonEmpty,
  purpose: nonEmpty,
  sources: z.array(
    z.object({
      url: nonEmpty,
      title: nonEmpty,
      authority: z.enum(["official", "primary", "secondary", "community"]),
      retrievedAt: z.string().datetime(),
      publishedAt: z.string().datetime().nullable(),
      claims: nonEmptyList,
      provenanceHash: nonEmpty,
    }),
  ),
  conflicts: z.array(
    z.object({
      claim: nonEmpty,
      sourceUrls: nonEmptyList,
      resolution: nonEmpty.nullable(),
    }),
  ),
  cacheKey: nonEmpty,
  expiresAt: z.string().datetime(),
});

export const graphicsResourceSchema = z.object({
  familyId: id,
  tokens: z.object({
    spacing: z.record(z.number().nonnegative()),
    radius: z.record(z.number().nonnegative()),
    typography: z.record(nonEmpty),
    semanticColors: z.record(nonEmpty),
  }),
  layouts: z.array(
    z.object({
      id,
      minWidth: z.number().nonnegative(),
      maxWidth: z.number().positive().nullable(),
      columns: z.number().int().positive(),
    }),
  ),
  components: nonEmptyList,
  themeModes: z.array(z.enum(["light", "dark", "system"])).min(1),
  accessibility: z.object({
    minimumContrastRatio: z.number().min(1),
    keyboardRequired: z.boolean(),
    reducedMotion: z.boolean(),
  }),
  brandingHooks: nonEmptyList,
});

export const videoResourceSchema = z.object({
  storyboardId: id,
  scenes: z
    .array(
      z.object({
        id,
        title: nonEmpty,
        durationMs: z.number().int().positive(),
        assetIds: z.array(id),
        narration: z.string(),
        captionIds: z.array(id),
      }),
    )
    .min(1),
  captions: z.array(
    z.object({
      id,
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().positive(),
      text: nonEmpty,
    }),
  ),
  overlays: z.array(
    z.object({
      id,
      sceneId: id,
      kind: z.enum(["title", "image", "shape", "cta"]),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().positive(),
    }),
  ),
  audioTracks: z.array(
    z.object({
      assetId: id,
      role: z.enum(["narration", "music", "sfx"]),
      gain: z.number().min(0).max(2),
    }),
  ),
  export: z.object({
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    captionsRequired: z.boolean(),
  }),
});

export const audioResourceSchema = z.object({
  tracks: z.array(
    z.object({
      id,
      title: nonEmpty,
      bpm: z.number().positive().nullable(),
      key: z.string().nullable(),
      durationMs: z.number().int().positive(),
      transcript: z.string().nullable(),
      rights: nonEmpty,
    }),
  ),
  playlists: z.array(z.object({ id, name: nonEmpty, trackIds: z.array(id) })),
  sequence: z.array(
    z.object({
      trackId: id,
      startMs: z.number().int().nonnegative(),
      trimStartMs: z.number().int().nonnegative(),
      gain: z.number().min(0).max(2),
    }),
  ),
  narration: z.object({
    enabled: z.boolean(),
    voiceId: z.string().nullable(),
    transcriptRequired: z.boolean(),
  }),
});

export const marketingResourceSchema = z.object({
  funnel: z
    .array(z.object({ id, purpose: nonEmpty, cta: nonEmpty, eventName: id }))
    .min(1),
  seo: z.object({
    title: nonEmpty,
    description: nonEmpty,
    canonicalPath: nonEmpty,
    structuredDataType: nonEmpty,
    sitemap: z.boolean(),
  }),
  openGraph: z.object({
    title: nonEmpty,
    description: nonEmpty,
    imageAssetId: z.string().nullable(),
  }),
  attribution: z.object({
    firstTouch: z.boolean(),
    lastTouch: z.boolean(),
    campaignParameters: nonEmptyList,
  }),
  consent: z.object({
    required: z.boolean(),
    categories: z.array(
      z.enum(["necessary", "analytics", "marketing", "preferences"]),
    ),
  }),
  experiments: z.array(
    z.object({ id, variants: z.array(nonEmpty).min(2), metric: nonEmpty }),
  ),
});

export const arResourceSchema = z.object({
  sceneId: id,
  permissionFlow: z.object({ camera: z.boolean(), rationale: nonEmpty }),
  placement: z.object({
    hitTesting: z.boolean(),
    anchors: z.boolean(),
    manipulation: z.array(z.enum(["translate", "rotate", "scale"])),
  }),
  models: z.array(
    z.object({
      assetId: id,
      format: z.enum(["gltf", "glb"]),
      fallbackAssetId: z.string().nullable(),
    }),
  ),
  deviceChecks: nonEmptyList,
  fallback: z.object({
    threeDimensionalViewer: z.boolean(),
    orbitControls: z.boolean(),
    message: nonEmpty,
  }),
});

export const educationResourceSchema = z.object({
  organizations: z.boolean(),
  roles: z
    .array(z.enum(["student", "instructor", "guardian", "administrator"]))
    .min(1),
  course: z.object({
    id,
    title: nonEmpty,
    curriculumTags: nonEmptyList,
    moduleIds: z.array(id),
  }),
  modules: z.array(z.object({ id, title: nonEmpty, lessonIds: z.array(id) })),
  lessons: z.array(
    z.object({
      id,
      title: nonEmpty,
      mediaAssetIds: z.array(id),
      accessibleTranscriptRequired: z.boolean(),
    }),
  ),
  enrollment: z.object({
    enrollmentId: id,
    learnerId: id,
    courseId: id,
    status: z.enum(["active", "completed", "withdrawn"]),
  }),
  assessment: z.object({
    questionBankId: id,
    gradingMode: z.enum(["automatic", "manual", "mixed"]),
    attemptsAllowed: z.number().int().positive(),
  }),
  progress: z.object({
    completionPercent: z.number().min(0).max(100),
    completedLessonIds: z.array(id),
  }),
  schedule: z.array(
    z.object({
      id,
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      instructorId: id,
    }),
  ),
});

export const patentResourceSchema = z.object({
  invention: z.object({
    title: nonEmpty,
    problem: nonEmpty,
    components: z.array(z.object({ id, name: nonEmpty, function: nonEmpty })),
    relationships: z.array(z.object({ from: id, to: id, function: nonEmpty })),
  }),
  priorArt: z.array(
    z.object({
      reference: nonEmpty,
      sourceUrl: nonEmpty,
      relevantFeatures: nonEmptyList,
      reviewedAt: z.string().datetime(),
    }),
  ),
  specification: z.object({
    field: nonEmpty,
    background: nonEmpty,
    summary: nonEmpty,
    detailedDescription: nonEmpty,
    abstract: nonEmpty,
  }),
  claims: z.array(
    z.object({
      id,
      text: nonEmpty,
      kind: z.enum(["independent", "dependent"]),
      dependsOn: z.string().nullable(),
    }),
  ),
  figures: z.array(
    z.object({ id, file: nonEmpty, referenceNumerals: z.record(nonEmpty) }),
  ),
  jurisdiction: nonEmpty,
  revision: z.number().int().positive(),
  attorneyReviewRequired: z.literal(true),
});

export const architectureResourceSchema = z.object({
  brief: z.object({
    clientGoals: nonEmptyList,
    budget: z.number().nonnegative().nullable(),
    jurisdiction: nonEmpty,
    units: z.enum(["metric", "imperial"]),
  }),
  site: z.object({
    address: z.string(),
    zoningSources: nonEmptyList,
    constraints: nonEmptyList,
  }),
  spaces: z.array(
    z.object({
      id,
      name: nonEmpty,
      area: z.number().positive(),
      occupancy: nonEmpty,
    }),
  ),
  bimEntities: z.array(
    z.object({
      id,
      kind: nonEmpty,
      level: nonEmpty,
      materialId: z.string().nullable(),
    }),
  ),
  materials: z.array(z.object({ id, name: nonEmpty, specification: nonEmpty })),
  coordination: z.object({
    structural: z.boolean(),
    mep: z.boolean(),
    clashes: z.array(
      z.object({
        id,
        entityIds: z.array(id).min(2),
        severity: z.enum(["low", "medium", "high"]),
        resolved: z.boolean(),
      }),
    ),
  }),
  lifeSafety: z.object({
    egressChecked: z.boolean(),
    accessibilityChecked: z.boolean(),
    fireStrategyReviewRequired: z.boolean(),
  }),
  approvals: z.array(
    z.object({
      id,
      role: nonEmpty,
      status: z.enum(["pending", "approved", "rejected"]),
      at: z.string().datetime().nullable(),
    }),
  ),
  professionalReviewRequired: z.literal(true),
});

export const gameResourceSchema = z.object({
  loop: z.object({
    fixedStepMs: z.number().positive(),
    deterministic: z.boolean(),
  }),
  scenes: z
    .array(z.object({ id, name: nonEmpty, entityIds: z.array(id) }))
    .min(1),
  entities: z.array(
    z.object({
      id,
      kind: z.enum(["player", "npc", "item", "environment"]),
      components: nonEmptyList,
    }),
  ),
  input: z.object({
    keyboard: z.boolean(),
    touch: z.boolean(),
    controllers: z.boolean(),
    bindings: z.record(nonEmpty),
  }),
  progression: z.object({
    score: z.boolean(),
    levels: z.boolean(),
    achievements: z.boolean(),
    inventory: z.boolean(),
  }),
  save: z.object({
    version: z.number().int().positive(),
    slots: z.number().int().positive(),
    checksum: z.boolean(),
  }),
  assets: z.array(
    z.object({
      id,
      type: z.enum(["sprite", "model", "audio", "level", "font"]),
      path: nonEmpty,
      rights: nonEmpty,
    }),
  ),
});

export const cadResourceSchema = z.object({
  units: z.enum(["mm", "cm", "m", "in"]),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
  }),
  tolerances: z.record(z.number().nonnegative()),
  materials: z.array(
    z.object({
      id,
      name: nonEmpty,
      grade: z.string(),
      properties: z.record(z.union([z.string(), z.number()])),
    }),
  ),
  components: z.array(
    z.object({
      id,
      name: nonEmpty,
      quantity: z.number().int().positive(),
      materialId: z.string().nullable(),
    }),
  ),
  assemblies: z.array(
    z.object({ id, componentIds: z.array(id).min(1), notes: z.string() }),
  ),
  manufacturingNotes: nonEmptyList,
  exports: z.array(z.enum(["gltf", "glb", "obj"])).min(1),
  revision: z.number().int().positive(),
});

export const legalResourceSchema = z.object({
  jurisdiction: nonEmpty,
  documentType: z.enum([
    "privacy",
    "terms",
    "nda",
    "service-agreement",
    "contractor-agreement",
    "consent",
    "dpa",
    "acceptable-use",
    "cookie",
    "disclaimer",
  ]),
  parties: z.array(nonEmpty),
  sections: z
    .array(
      z.object({
        id,
        heading: nonEmpty,
        body: nonEmpty,
        editable: z.boolean(),
      }),
    )
    .min(1),
  consentRequirements: nonEmptyList,
  variables: z.record(z.string()),
  qualifiedReviewRequired: z.literal(true),
});

export const fintechResourceSchema = z.object({
  products: z.array(
    z.object({
      id,
      name: nonEmpty,
      priceModel: z.enum(["one-time", "subscription", "usage", "credit"]),
      currency: nonEmpty,
    }),
  ),
  ledgerAccounts: z.array(
    z.object({
      id,
      code: nonEmpty,
      name: nonEmpty,
      type: z.enum(["asset", "liability", "equity", "income", "expense"]),
    }),
  ),
  ledgerEntries: z.array(
    z.object({
      id,
      debitAccountId: id,
      creditAccountId: id,
      amountMinor: z.number().int().nonnegative(),
      currency: nonEmpty,
      idempotencyKey: nonEmpty,
    }),
  ),
  entitlements: z.array(
    z.object({ id, userId: id, productId: id, active: z.boolean() }),
  ),
  webhookLedger: z.array(
    z.object({
      providerEventId: id,
      receivedAt: z.string().datetime(),
      processedAt: z.string().datetime().nullable(),
    }),
  ),
  reconciliation: z.object({ required: z.boolean(), cadence: nonEmpty }),
  kycFields: nonEmptyList,
  regulatoryReviewRequired: z.literal(true),
});

export const healthcareResourceSchema = z.object({
  roles: z
    .array(z.enum(["patient", "provider", "administrator", "caregiver"]))
    .min(1),
  sensitiveDataClasses: nonEmptyList,
  consent: z.array(
    z.object({
      id,
      subjectId: id,
      purpose: nonEmpty,
      granted: z.boolean(),
      at: z.string().datetime(),
    }),
  ),
  appointments: z.array(
    z.object({
      id,
      patientId: id,
      providerId: id,
      startsAt: z.string().datetime(),
      status: z.enum(["scheduled", "completed", "cancelled"]),
    }),
  ),
  audit: z.array(
    z.object({
      id,
      actorId: id,
      action: nonEmpty,
      resourceId: id,
      at: z.string().datetime(),
    }),
  ),
  retention: z.object({
    days: z.number().int().positive(),
    deletionReviewRequired: z.boolean(),
  }),
  notificationPrivacy: z.object({ sensitiveContentAllowed: z.boolean() }),
  tenantBoundary: z.object({ tenantId: id, enforced: z.boolean() }),
  complianceReviewRequired: z.literal(true),
});

export const mobileResourceSchema = z.object({
  framework: z.enum(["flutter", "android", "ios", "react-native-expo"]),
  navigation: z.array(z.object({ route: nonEmpty, protected: z.boolean() })),
  permissions: z.array(
    z.object({
      capability: nonEmpty,
      rationale: nonEmpty,
      required: z.boolean(),
    }),
  ),
  secureStorage: z.boolean(),
  offlineCache: z.object({ enabled: z.boolean(), conflictPolicy: nonEmpty }),
  deepLinks: z.array(z.object({ pattern: nonEmpty, route: nonEmpty })),
  notifications: z.object({
    push: z.boolean(),
    local: z.boolean(),
    preferences: z.boolean(),
  }),
  lifecycleHooks: nonEmptyList,
  accessibility: z.object({
    screenReaderLabels: z.boolean(),
    textScaling: z.boolean(),
    reducedMotion: z.boolean(),
  }),
  localization: z.boolean(),
  store: z.object({
    bundleId: nonEmpty,
    displayName: nonEmpty,
    iconAssetId: z.string().nullable(),
    splashAssetId: z.string().nullable(),
  }),
});

export const voiceResourceSchema = z.object({
  speechInput: z.object({
    enabled: z.boolean(),
    locales: nonEmptyList,
    confidenceThreshold: z.number().min(0).max(1),
  }),
  tts: z.object({
    enabled: z.boolean(),
    voiceId: z.string().nullable(),
    interruptible: z.boolean(),
  }),
  confirmation: z.object({
    requiredForActions: nonEmptyList,
    cancelIntents: nonEmptyList,
  }),
  activation: z.object({
    mode: z.enum(["user-initiated", "platform-intent", "foreground-session"]),
    alwaysListening: z.literal(false),
  }),
  transcript: z.object({
    persist: z.boolean(),
    retentionDays: z.number().int().nonnegative(),
    sensitive: z.boolean(),
  }),
  siriAppIntents: z.boolean(),
  androidVoiceActions: z.boolean(),
});

export const dataResourceSchema = z.object({
  tables: z.array(
    z.object({
      name: id,
      columns: z.array(
        z.object({ name: id, type: nonEmpty, nullable: z.boolean() }),
      ),
    }),
  ),
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
  kpis: z.array(
    z.object({ id, label: nonEmpty, expression: nonEmpty, unit: nonEmpty }),
  ),
  charts: z.array(
    z.object({
      id,
      type: nonEmpty,
      metricIds: z.array(id),
      accessibleSummary: z.boolean(),
    }),
  ),
  filters: z.array(z.object({ field: nonEmpty, operators: nonEmptyList })),
  exports: z.array(z.enum(["csv", "json"])),
  imports: z.array(
    z.object({
      format: z.enum(["csv", "json"]),
      validationRequired: z.boolean(),
    }),
  ),
  access: z.object({
    rowOwnership: z.boolean(),
    roles: z.record(z.array(nonEmpty)),
  }),
});

export const localizationResourceSchema = z.object({
  defaultLocale: nonEmpty,
  supportedLocales: nonEmptyList,
  fallbackLocale: nonEmpty,
  rtlLocales: z.array(nonEmpty),
  namespaces: nonEmptyList,
  keys: z.record(z.record(z.string())),
  formatting: z.object({
    dates: z.boolean(),
    times: z.boolean(),
    numbers: z.boolean(),
    currencies: z.boolean(),
    pluralization: z.boolean(),
  }),
  lazyLoading: z.boolean(),
  persistedSelection: z.boolean(),
  accessibleSelector: z.boolean(),
});

export const collaborationResourceSchema = z.object({
  room: z.object({ id, tenantId: id, documentId: id }),
  memberships: z.array(
    z.object({ userId: id, role: nonEmpty, permissions: nonEmptyList }),
  ),
  presence: z.array(
    z.object({
      userId: id,
      cursor: z.object({ x: z.number(), y: z.number() }).nullable(),
      lastSeenAt: z.string().datetime(),
    }),
  ),
  operations: z.array(
    z.object({
      id,
      actorId: id,
      sequence: z.number().int().nonnegative(),
      baseVersion: z.number().int().nonnegative(),
      kind: nonEmpty,
      payload: z.record(z.unknown()),
    }),
  ),
  conflictStrategy: z.enum(["optimistic-version", "crdt", "ot"]),
  reconnect: z.object({ retry: z.boolean(), offlineQueue: z.boolean() }),
  history: z.object({
    enabled: z.boolean(),
    approvals: z.boolean(),
    comments: z.boolean(),
  }),
});

export const CAPABILITY_DOMAIN_CONTRACTS = {
  web_search: researchResourceSchema,
  graphics: graphicsResourceSchema,
  video: videoResourceSchema,
  music: audioResourceSchema,
  marketing: marketingResourceSchema,
  ar: arResourceSchema,
  education: educationResourceSchema,
  patent: patentResourceSchema,
  architecture: architectureResourceSchema,
  game: gameResourceSchema,
  cad: cadResourceSchema,
  legal: legalResourceSchema,
  fintech: fintechResourceSchema,
  healthcare: healthcareResourceSchema,
  mobile: mobileResourceSchema,
  voice: voiceResourceSchema,
  data: dataResourceSchema,
  localization: localizationResourceSchema,
  collab: collaborationResourceSchema,
} as const;

export type CapabilityDomainId = keyof typeof CAPABILITY_DOMAIN_CONTRACTS;

export function validateCapabilityDomainResource(
  capability: CapabilityDomainId,
  input: unknown,
): unknown {
  return CAPABILITY_DOMAIN_CONTRACTS[capability].parse(input);
}

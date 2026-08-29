/** World-leader extension studios — metadata, disclaimers, attach paths. */

export const EXTENSION_CAPABILITY_IDS = [
  "game",
  "cad",
  "legal",
  "fintech",
  "healthcare",
  "mobile",
  "voice",
  "data",
  "localization",
  "collab",
] as const;

export type ExtensionCapabilityId = (typeof EXTENSION_CAPABILITY_IDS)[number];

export type ExtensionAttachKind =
  | "game"
  | "cad"
  | "legal"
  | "fintech"
  | "healthcare"
  | "mobile"
  | "voice"
  | "data"
  | "localization"
  | "collab";

export type ExtensionStudioMeta = {
  id: ExtensionCapabilityId;
  attachKind: ExtensionAttachKind;
  attachFilename: string;
  attachPrefix: string;
  preview: "game" | "cad" | "none";
  disclaimer?: string;
  generateSystemPrompt: string;
};

export const LEGAL_STUDIO_DISCLAIMER =
  "Generated documents are templates only — not legal advice. Have a qualified attorney review before signing or filing.";

export const HEALTHCARE_STUDIO_DISCLAIMER =
  "HIPAA-safe build guidance only — not a compliance certification. Engage a qualified compliance officer before handling PHI in production.";

export const FINTECH_STUDIO_DISCLAIMER =
  "Financial schemas and checklists are engineering aids — not licensed financial, tax, or investment advice.";

export const EXTENSION_STUDIOS: Record<
  ExtensionCapabilityId,
  ExtensionStudioMeta
> = {
  game: {
    id: "game",
    attachKind: "game",
    attachFilename: "game-project.json",
    attachPrefix: "game/",
    preview: "game",
    generateSystemPrompt: `You are a game design engineer. Plan a playable web game project.
Output JSON: { title, engine: "phaser"|"godot-web"|"canvas", genre, mechanics: [string], scenes: [{ id, name, entities }], assets: [{ id, type, description }], webglPreview: { playerControls, winCondition }, buildSteps: [string] }`,
  },
  cad: {
    id: "cad",
    attachKind: "cad",
    attachFilename: "product-design.json",
    attachPrefix: "cad/",
    preview: "cad",
    generateSystemPrompt: `You are an industrial/product designer. Plan a 3D product for Three.js export.
Output JSON: { productName, materials: [string], dimensions: { unit, width, height, depth }, meshHints: { primitive, color, bevel }, features: [{ label, x, y, z }], exportFormats: ["glb","obj"], manufacturingNotes: [string] }`,
  },
  legal: {
    id: "legal",
    attachKind: "legal",
    attachFilename: "legal-bundle.json",
    attachPrefix: "legal/",
    preview: "none",
    disclaimer: LEGAL_STUDIO_DISCLAIMER,
    generateSystemPrompt: `You draft business legal document OUTLINES (not binding advice). ${LEGAL_STUDIO_DISCLAIMER}
Output JSON: { jurisdiction, documentType: "nda"|"terms"|"privacy"|"contract", parties: [string], sections: [{ heading, body }], keyClauses: [string], reviewChecklist: [string] }`,
  },
  fintech: {
    id: "fintech",
    attachKind: "fintech",
    attachFilename: "fintech-schema.json",
    attachPrefix: "fintech/",
    preview: "none",
    disclaimer: FINTECH_STUDIO_DISCLAIMER,
    generateSystemPrompt: `You design Stripe-ready fintech app schemas. ${FINTECH_STUDIO_DISCLAIMER}
Output JSON: { productType, stripeProducts: [{ name, priceIdHint }], ledgerAccounts: [{ code, name, type }], complianceChecklist: [string], kycFields: [string], webhookEvents: [string], apiRoutes: [{ method, path, purpose }] }`,
  },
  healthcare: {
    id: "healthcare",
    attachKind: "healthcare",
    attachFilename: "hipaa-build-config.json",
    attachPrefix: "healthcare/",
    preview: "none",
    disclaimer: HEALTHCARE_STUDIO_DISCLAIMER,
    generateSystemPrompt: `You configure PHI-safe healthcare app builds. ${HEALTHCARE_STUDIO_DISCLAIMER}
Output JSON: { phiDataTypes: [string], encryptionAtRest: boolean, auditLogFields: [string], accessControls: [{ role, permissions }], baRequirements: [string], retentionPolicyDays: number, buildBoundaries: [string], monitoringAlerts: [string] }`,
  },
  mobile: {
    id: "mobile",
    attachKind: "mobile",
    attachFilename: "mobile-packaging.json",
    attachPrefix: "mobile/",
    preview: "none",
    generateSystemPrompt: `You plan native mobile packaging for Expo or Capacitor.
Output JSON: { framework: "expo"|"capacitor", appName, bundleId, platforms: ["ios","android"], storeListing: { title, subtitle, description, keywords: [string] }, icons: [{ size, purpose }], permissions: [string], buildCommands: [string] }`,
  },
  voice: {
    id: "voice",
    attachKind: "voice",
    attachFilename: "podcast-manifest.json",
    attachPrefix: "voice/",
    preview: "none",
    generateSystemPrompt: `You plan podcast/voice content extending video and music capabilities.
Output JSON: { showTitle, episodeTitle, durationMin, script: { intro, segments: [{ title, narration, sfx }], outro }, ttsVoice: string, chapters: [{ timeSec, title }], rssFeedHints: { category, explicit } }`,
  },
  data: {
    id: "data",
    attachKind: "data",
    attachFilename: "bi-dashboard.json",
    attachPrefix: "data/",
    preview: "none",
    generateSystemPrompt: `You design BI dashboards and data layers.
Output JSON: { dashboardTitle, sqlSchema: { tables: [{ name, columns: [{ name, type }] }] }, charts: [{ type, title, queryHint, metrics: [string] }], kpis: [{ label, formula }], refreshStrategy: string }`,
  },
  localization: {
    id: "localization",
    attachKind: "localization",
    attachFilename: "i18n-bundle.json",
    attachPrefix: "localization/",
    preview: "none",
    generateSystemPrompt: `You plan app internationalization.
Output JSON: { defaultLocale, supportedLocales: [string], namespaces: [string], sampleKeys: [{ key, en, notes }], rtlLocales: [string], dateNumberFormats: { locale, pattern }, extractionPaths: [string] }`,
  },
  collab: {
    id: "collab",
    attachKind: "collab",
    attachFilename: "collab-room.json",
    attachPrefix: "collab/",
    preview: "none",
    generateSystemPrompt: `You design realtime multi-user studio collaboration (Figma-style).
Output JSON: { roomId, transport: "websocket"|"webrtc", roles: [{ id, permissions }], syncedArtifacts: [string], presenceEvents: [string], conflictStrategy: string, cursors: boolean, versionHistory: boolean }`,
  },
};

export function isExtensionCapabilityId(v: string): v is ExtensionCapabilityId {
  return (EXTENSION_CAPABILITY_IDS as readonly string[]).includes(v);
}

export function attachPrefixForKind(kind: ExtensionAttachKind): string {
  return EXTENSION_STUDIOS[kind].attachPrefix;
}

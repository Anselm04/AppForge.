import { z } from "zod";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

const nonEmpty = z.string().trim().min(1);

export const designFamilySchema = z.object({
  id: nonEmpty,
  name: nonEmpty,
  intent: nonEmpty,
  density: z.enum(["comfortable", "compact", "spacious"]),
  navigation: z.array(z.enum(["top", "side", "bottom", "drawer", "contextual"])).min(1),
  layout: z.object({
    maxContentWidth: z.number().int().positive(),
    minTouchTarget: z.number().int().min(44),
    responsiveBreakpoints: z.record(z.number().int().positive()),
    supportsDenseTables: z.boolean(),
  }),
  typography: z.object({
    headingScale: z.array(z.number().positive()).min(3),
    bodyLineHeight: z.number().min(1.2),
    userFontHook: z.boolean(),
  }),
  themes: z.object({
    light: z.boolean(),
    dark: z.boolean(),
    system: z.boolean(),
    brandingHooks: z.array(nonEmpty).min(1),
  }),
  states: z.array(z.enum(["loading", "empty", "error", "success", "disabled"])).min(4),
  accessibility: z.object({
    minimumContrastRatio: z.number().min(4.5),
    keyboardNavigation: z.boolean(),
    screenReaderSemantics: z.boolean(),
    reducedMotion: z.boolean(),
    textScaling: z.boolean(),
  }),
  localization: z.object({ rtl: z.boolean(), expansionSafe: z.boolean(), localeHooks: z.array(nonEmpty) }),
});

export type DesignFamily = z.infer<typeof designFamilySchema>;

export const DESIGN_FAMILIES: DesignFamily[] = [
  {
    id: "product-neutral",
    name: "Product Neutral",
    intent: "Balanced application UI for general SaaS, account and workflow products.",
    density: "comfortable",
    navigation: ["top", "side", "drawer"],
    layout: { maxContentWidth: 1280, minTouchTarget: 44, responsiveBreakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 }, supportsDenseTables: true },
    typography: { headingScale: [2, 1.5, 1.25], bodyLineHeight: 1.5, userFontHook: true },
    themes: { light: true, dark: true, system: true, brandingHooks: ["brand.primary", "brand.surface", "brand.logo"] },
    states: ["loading", "empty", "error", "success", "disabled"],
    accessibility: { minimumContrastRatio: 4.5, keyboardNavigation: true, screenReaderSemantics: true, reducedMotion: true, textScaling: true },
    localization: { rtl: true, expansionSafe: true, localeHooks: ["direction", "copy", "formatting"] },
  },
  {
    id: "dense-dashboard",
    name: "Dense Dashboard",
    intent: "Information-dense operational dashboards, admin consoles and data products.",
    density: "compact",
    navigation: ["side", "top", "contextual"],
    layout: { maxContentWidth: 1600, minTouchTarget: 44, responsiveBreakpoints: { sm: 640, md: 900, lg: 1200, xl: 1536 }, supportsDenseTables: true },
    typography: { headingScale: [1.75, 1.35, 1.15], bodyLineHeight: 1.4, userFontHook: true },
    themes: { light: true, dark: true, system: true, brandingHooks: ["brand.accent", "data.series", "status.palette"] },
    states: ["loading", "empty", "error", "success", "disabled"],
    accessibility: { minimumContrastRatio: 4.5, keyboardNavigation: true, screenReaderSemantics: true, reducedMotion: true, textScaling: true },
    localization: { rtl: true, expansionSafe: true, localeHooks: ["direction", "numbers", "dates"] },
  },
  {
    id: "editorial-content",
    name: "Editorial Content",
    intent: "Readable content, learning, publishing and documentation experiences.",
    density: "spacious",
    navigation: ["top", "drawer", "contextual"],
    layout: { maxContentWidth: 960, minTouchTarget: 44, responsiveBreakpoints: { sm: 600, md: 800, lg: 1024, xl: 1280 }, supportsDenseTables: false },
    typography: { headingScale: [2.4, 1.8, 1.4], bodyLineHeight: 1.7, userFontHook: true },
    themes: { light: true, dark: true, system: true, brandingHooks: ["brand.editorialAccent", "brand.type", "brand.imagery"] },
    states: ["loading", "empty", "error", "success", "disabled"],
    accessibility: { minimumContrastRatio: 4.5, keyboardNavigation: true, screenReaderSemantics: true, reducedMotion: true, textScaling: true },
    localization: { rtl: true, expansionSafe: true, localeHooks: ["direction", "copy", "readingOrder"] },
  },
  {
    id: "immersive-media",
    name: "Immersive Media",
    intent: "Media-rich, creative, game, AR and showcase experiences without sacrificing controls accessibility.",
    density: "spacious",
    navigation: ["top", "bottom", "contextual"],
    layout: { maxContentWidth: 1440, minTouchTarget: 48, responsiveBreakpoints: { sm: 640, md: 840, lg: 1100, xl: 1440 }, supportsDenseTables: false },
    typography: { headingScale: [2.5, 1.85, 1.35], bodyLineHeight: 1.55, userFontHook: true },
    themes: { light: true, dark: true, system: true, brandingHooks: ["brand.hero", "brand.mediaSurface", "brand.motion"] },
    states: ["loading", "empty", "error", "success", "disabled"],
    accessibility: { minimumContrastRatio: 4.5, keyboardNavigation: true, screenReaderSemantics: true, reducedMotion: true, textScaling: true },
    localization: { rtl: true, expansionSafe: true, localeHooks: ["direction", "captions", "copy"] },
  },
].map((family) => designFamilySchema.parse(family));

export function selectDesignFamilies(input: {
  prefersDenseInformation?: boolean;
  contentHeavy?: boolean;
  immersive?: boolean;
}): DesignFamily[] {
  const preferred = input.prefersDenseInformation
    ? "dense-dashboard"
    : input.contentHeavy
      ? "editorial-content"
      : input.immersive
        ? "immersive-media"
        : "product-neutral";
  return DESIGN_FAMILIES.filter((family) => family.id === preferred);
}

export const DESIGN_FAMILY_RESOURCES: BuilderResourceManifest[] =
  DESIGN_FAMILIES.map((family) =>
    parseBuilderResourceManifest({
      identity: {
        resourceId: `design.family.${family.id}`,
        name: family.name,
        category: "graphics",
        resourceType: "domain_pack",
        version: "1.0.0",
      },
      compatibility: {
        supportedProductTypes: ["*"],
        supportedTechnologyStacks: ["*"],
        supportedRuntimes: ["browser", "react", "flutter", "native"],
        supportedPlatforms: ["web", "android", "ios", "desktop", "*"],
        incompatibleCombinations: [],
        minimumRuntimeToolVersions: {},
      },
      capabilities: {
        capabilitiesProvided: ["graphics"],
        optionalCapabilities: ["localization"],
        dependencies: [],
        integrationPoints: ["design-system"],
      },
      contracts: {
        inputContract: { designIntent: family.intent },
        outputContract: { designFamilyId: family.id },
        apiContract: null,
        dataContract: { family },
        eventsEmitted: [],
        eventsConsumed: [],
        requiredEnvironmentVariables: [],
        secretRequirements: [],
      },
      adaptation: {
        configurableFields: ["design.density", "design.navigation", "design.breakpoints"],
        replacementPoints: ["design.layout"],
        brandingHooks: family.themes.brandingHooks,
        localizationHooks: family.localization.localeHooks,
        authorizationHooks: [],
        databaseHooks: [],
        extensionPoints: ["design.components", "design.motion"],
      },
      evidence: {
        unitTests: ["src/lib/builderResources/__tests__/designFamilies.test.ts"],
        integrationTests: [],
        behavioralTests: [],
        buildEvidence: [],
        runtimeEvidence: [],
        securityEvidence: [],
        accessibilityEvidence: ["design-family-contract"],
        performanceEvidence: [],
        reproducibilityEvidence: [],
        lastVerifiedAt: null,
        evidenceLedgerIds: [],
        adapterEvidence: { discovered: true, installVerified: true },
      },
      governance: {
        provenance: "AppForge-owned configurable design family",
        license: "UNLICENSED-INTERNAL",
        allowedUse: ["internal-generation"],
        securityNotes: [],
        deprecationStatus: "active",
        replacementResourceId: null,
        maintainerInternalOwner: "appforge",
        maturityState: "structural",
        quarantine: null,
      },
      implementation: {
        sourcePaths: [
          "src/lib/builderResources/designFamilies.ts",
          "src/design-system/Button.tsx",
          "src/design-system/Input.tsx",
          "src/design-system/Section.tsx",
          "src/design-system/GlassCard.tsx",
        ],
        testPaths: ["src/lib/builderResources/__tests__/designFamilies.test.ts"],
        exportPolicy: "copy-adapt",
        requiresLiveLibraryAtRuntime: false,
      },
    }),
  );

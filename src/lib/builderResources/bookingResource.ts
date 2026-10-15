import { z } from "zod";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

export const BOOKING_DOMAINS = [
  "restaurant",
  "medical",
  "fitness",
  "accommodation",
  "vehicle-rental",
  "event-ticket",
  "generic",
] as const;

export const bookingResourceSchema = z.object({
  domain: z.enum(BOOKING_DOMAINS),
  vocabulary: z.object({
    resourceSingular: z.string().min(1),
    resourcePlural: z.string().min(1),
    reservationVerb: z.string().min(1),
    quantityLabel: z.string().min(1),
  }),
  availability: z.object({
    resourceId: z.string().min(1),
    timezone: z.string().min(1),
    dates: z.array(z.string().min(1)).min(1),
    timeRanges: z.array(
      z.object({ start: z.string().min(1), end: z.string().min(1) }),
    ),
    minQuantity: z.number().int().positive(),
    maxQuantity: z.number().int().positive(),
  }),
  booking: z.object({
    confirmationRequired: z.boolean(),
    cancellationSupported: z.boolean(),
    modificationSupported: z.boolean(),
    idempotencyRequired: z.boolean(),
  }),
  authorization: z.object({ ownerScoped: z.boolean(), providerActionServerSide: z.boolean() }),
  provider: z.object({
    kind: z.enum(["authorized-api", "partner", "sandbox", "internal"]),
    scrapingAllowed: z.literal(false),
    timeoutMs: z.number().int().positive(),
  }),
});

export type BookingResourceContract = z.infer<typeof bookingResourceSchema>;

export function adaptBookingVocabulary(
  domain: (typeof BOOKING_DOMAINS)[number],
): BookingResourceContract["vocabulary"] {
  switch (domain) {
    case "restaurant":
      return {
        resourceSingular: "restaurant",
        resourcePlural: "restaurants",
        reservationVerb: "book table",
        quantityLabel: "party size",
      };
    case "medical":
      return {
        resourceSingular: "provider",
        resourcePlural: "providers",
        reservationVerb: "book appointment",
        quantityLabel: "patients",
      };
    case "fitness":
      return {
        resourceSingular: "class",
        resourcePlural: "classes",
        reservationVerb: "reserve place",
        quantityLabel: "places",
      };
    case "accommodation":
      return {
        resourceSingular: "property",
        resourcePlural: "properties",
        reservationVerb: "book stay",
        quantityLabel: "guests",
      };
    case "vehicle-rental":
      return {
        resourceSingular: "vehicle",
        resourcePlural: "vehicles",
        reservationVerb: "reserve vehicle",
        quantityLabel: "drivers",
      };
    case "event-ticket":
      return {
        resourceSingular: "event",
        resourcePlural: "events",
        reservationVerb: "reserve tickets",
        quantityLabel: "tickets",
      };
    default:
      return {
        resourceSingular: "resource",
        resourcePlural: "resources",
        reservationVerb: "book",
        quantityLabel: "quantity",
      };
  }
}

export const BOOKING_RESOURCE: BuilderResourceManifest =
  parseBuilderResourceManifest({
    identity: {
      resourceId: "module.booking",
      name: "Adaptable Booking Module",
      category: "core",
      resourceType: "module",
      version: "1.0.0",
    },
    compatibility: {
      supportedProductTypes: ["mobile_app", "saas_application", "website"],
      supportedTechnologyStacks: ["*"],
      supportedRuntimes: ["*"],
      supportedPlatforms: ["*"],
      incompatibleCombinations: [],
      minimumRuntimeToolVersions: {},
    },
    capabilities: {
      capabilitiesProvided: ["database", "api"],
      optionalCapabilities: ["notifications", "background_jobs", "billing"],
      dependencies: ["core.database", "core.api"],
      integrationPoints: ["booking", "availability", "authorized-provider"],
    },
    contracts: {
      inputContract: { schema: "bookingResourceSchema" },
      outputContract: { kind: "booking-workflow" },
      apiContract: {
        operations: ["searchAvailability", "createBooking", "cancelBooking"],
      },
      dataContract: {
        entities: ["BookingPreference", "Availability", "Booking"],
      },
      eventsEmitted: ["booking.requested", "booking.confirmed", "booking.cancelled"],
      eventsConsumed: ["availability.updated"],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: [
        "booking.domain",
        "booking.vocabulary",
        "booking.constraints",
        "booking.confirmation",
      ],
      replacementPoints: ["booking.provider"],
      brandingHooks: [],
      localizationHooks: ["booking.labels", "booking.timezone"],
      authorizationHooks: ["booking.ownerPolicy"],
      databaseHooks: ["booking.schema"],
      extensionPoints: ["booking.pricing", "booking.notifications"],
    },
    composition: {
      eventsProduced: ["booking.confirmed"],
      eventsConsumed: ["availability.updated"],
      apiContracts: { booking: "v1" },
    },
    implementation: {
      sourcePaths: [
        "src/lib/builderResources/bookingResource.ts",
        "src/services/reservationProviderSupport.ts",
      ],
      testPaths: [
        "src/lib/builderResources/__tests__/bookingResource.test.ts",
      ],
      exportPolicy: "compose",
      requiresLiveLibraryAtRuntime: false,
    },
    evidence: {
      unitTests: [
        "src/lib/builderResources/__tests__/bookingResource.test.ts",
      ],
      integrationTests: [
        "src/lib/__tests__/reservationProviderSupport.test.ts",
      ],
      behavioralTests: [],
      buildEvidence: [],
      runtimeEvidence: [],
      securityEvidence: [],
      accessibilityEvidence: [],
      performanceEvidence: [],
      reproducibilityEvidence: [],
      lastVerifiedAt: null,
      evidenceLedgerIds: [],
      adapterEvidence: { discovered: true, installVerified: true },
    },
    governance: {
      provenance: "AppForge-owned generalized booking workflow",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: [
        "External booking actions require an authorized provider boundary; scraping is not part of this resource.",
      ],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: "structural",
      quarantine: null,
    },
  });

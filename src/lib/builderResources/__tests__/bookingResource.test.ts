import { describe, expect, it } from "vitest";
import {
  BOOKING_RESOURCE,
  adaptBookingVocabulary,
  bookingResourceSchema,
} from "../bookingResource.js";

describe("adaptable booking Builder Resource", () => {
  it("uses one generalized module for materially similar booking domains", () => {
    expect(adaptBookingVocabulary("restaurant")).toMatchObject({
      reservationVerb: "book table",
      quantityLabel: "party size",
    });
    expect(adaptBookingVocabulary("medical")).toMatchObject({
      reservationVerb: "book appointment",
      quantityLabel: "patients",
    });
    expect(adaptBookingVocabulary("vehicle-rental")).toMatchObject({
      reservationVerb: "reserve vehicle",
    });
    expect(BOOKING_RESOURCE.adaptation.configurableFields).toContain(
      "booking.domain",
    );
  });

  it("requires explicit booking confirmation and an authorized non-scraping provider contract when configured that way", () => {
    const parsed = bookingResourceSchema.parse({
      domain: "restaurant",
      vocabulary: adaptBookingVocabulary("restaurant"),
      availability: {
        resourceId: "restaurant-1",
        timezone: "Pacific/Auckland",
        dates: ["2026-10-20"],
        timeRanges: [{ start: "18:00", end: "20:00" }],
        minQuantity: 1,
        maxQuantity: 12,
      },
      booking: {
        confirmationRequired: true,
        cancellationSupported: true,
        modificationSupported: true,
        idempotencyRequired: true,
      },
      authorization: {
        ownerScoped: true,
        providerActionServerSide: true,
      },
      provider: {
        kind: "authorized-api",
        scrapingAllowed: false,
        timeoutMs: 5000,
      },
    });

    expect(parsed.booking.confirmationRequired).toBe(true);
    expect(parsed.provider.scrapingAllowed).toBe(false);
    expect(parsed.authorization.providerActionServerSide).toBe(true);
  });
});

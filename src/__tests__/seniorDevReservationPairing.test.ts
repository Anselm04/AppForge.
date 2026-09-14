import { describe, expect, it } from "vitest";
import { findOutstandingSeniorDevReservationChargeId } from "../services/senior-dev-reservation.js";

describe("Senior Dev reservation ledger pairing", () => {
  it("returns null when there is no paid reservation", () => {
    expect(findOutstandingSeniorDevReservationChargeId([])).toBeNull();
    expect(
      findOutstandingSeniorDevReservationChargeId([
        { id: 1, amount: 20 },
      ]),
    ).toBeNull();
  });

  it("returns the oldest outstanding reservation", () => {
    expect(
      findOutstandingSeniorDevReservationChargeId([
        { id: 10, amount: -20 },
        { id: 11, amount: -20 },
      ]),
    ).toBe(10);
  });

  it("pairs a refund with the oldest outstanding charge", () => {
    expect(
      findOutstandingSeniorDevReservationChargeId([
        { id: 10, amount: -20 },
        { id: 11, amount: -20 },
        { id: 12, amount: 20 },
      ]),
    ).toBe(11);
  });

  it("does not let an orphan or duplicate refund consume a future retry", () => {
    expect(
      findOutstandingSeniorDevReservationChargeId([
        { id: 1, amount: 20 },
        { id: 2, amount: 20 },
        { id: 3, amount: -20 },
      ]),
    ).toBe(3);
  });

  it("keeps completed retry cycles fully settled", () => {
    expect(
      findOutstandingSeniorDevReservationChargeId([
        { id: 1, amount: -20 },
        { id: 2, amount: 20 },
        { id: 3, amount: -20 },
        { id: 4, amount: 20 },
      ]),
    ).toBeNull();
  });

  it("identifies a later failed retry after earlier attempts were refunded", () => {
    expect(
      findOutstandingSeniorDevReservationChargeId([
        { id: 1, amount: -20 },
        { id: 2, amount: 20 },
        { id: 3, amount: -20 },
        { id: 4, amount: 20 },
        { id: 5, amount: -20 },
      ]),
    ).toBe(5);
  });
});

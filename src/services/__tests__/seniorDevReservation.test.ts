import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, addCreditsMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  addCreditsMock: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  db: {
    select: selectMock,
  },
  addCredits: addCreditsMock,
}));

vi.mock("../../db/schema.js", () => ({
  creditTransactions: {
    id: "id",
    userId: "user_id",
    projectId: "project_id",
    type: "type",
    amount: "amount",
    description: "description",
  },
}));

import {
  getOutstandingSeniorDevReservationChargeId,
  refundOutstandingSeniorDevReservation,
  wasSeniorDevReservationCharged,
} from "../senior-dev-reservation.js";

function mockRows(rows: Array<{ id: number; amount: number }>) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValueOnce({ from });
  return { from, where, orderBy };
}

describe("Senior Dev reservation ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addCreditsMock.mockResolvedValue({ balance: 10, skipped: false });
  });

  it("returns true when a paid reservation is still outstanding", async () => {
    mockRows([{ id: 77, amount: -5 }]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(true);
  });

  it("returns false for an unlimited reservation with no charge", async () => {
    mockRows([]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(false);
  });

  it("returns false after a paid reservation has already been refunded", async () => {
    mockRows([
      { id: 77, amount: -5 },
      { id: 78, amount: 5 },
    ]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(false);
  });

  it("detects the later paid retry after an earlier refund", async () => {
    mockRows([
      { id: 77, amount: -5 },
      { id: 78, amount: 5 },
      { id: 91, amount: -5 },
    ]);

    await expect(
      getOutstandingSeniorDevReservationChargeId(1, 2, 3),
    ).resolves.toBe(91);
  });

  it("uses the outstanding charge id as the refund idempotency key", async () => {
    mockRows([{ id: 91, amount: -5 }]);

    await expect(
      refundOutstandingSeniorDevReservation(
        1,
        2,
        3,
        "Senior Dev Agent failed reservation refund for task 3",
      ),
    ).resolves.toBe(true);

    expect(addCreditsMock).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      "senior_dev_refund",
      "Senior Dev Agent failed reservation refund for task 3",
      "senior-dev-ledger-refund-3-91",
    );
  });

  it("does not create a refund when no paid reservation is outstanding", async () => {
    mockRows([]);

    await expect(
      refundOutstandingSeniorDevReservation(
        1,
        2,
        3,
        "Senior Dev Agent failed reservation refund for task 3",
      ),
    ).resolves.toBe(false);

    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  db: {
    select: selectMock,
  },
}));

vi.mock("../../db/schema.js", () => ({
  creditTransactions: {
    userId: "user_id",
    projectId: "project_id",
    type: "type",
    amount: "amount",
    description: "description",
  },
}));

import { wasSeniorDevReservationCharged } from "../senior-dev-reservation.js";

function mockRows(rows: Array<{ amount: number }>) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValueOnce({ from });
  return { from, where };
}

describe("Senior Dev reservation ledger", () => {
  it("returns true when a paid reservation is still outstanding", async () => {
    mockRows([{ amount: -5 }]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(true);
  });

  it("returns false for an unlimited reservation with no charge", async () => {
    mockRows([]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(false);
  });

  it("returns false after a paid reservation has already been refunded", async () => {
    mockRows([{ amount: -5 }, { amount: 5 }]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(false);
  });

  it("detects a later paid retry after an earlier refund", async () => {
    mockRows([{ amount: -5 }, { amount: 5 }, { amount: -5 }]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(true);
  });
});

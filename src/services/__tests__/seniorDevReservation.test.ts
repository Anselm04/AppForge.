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
    id: "id",
    userId: "user_id",
    projectId: "project_id",
    type: "type",
    amount: "amount",
    description: "description",
  },
}));

import { wasSeniorDevReservationCharged } from "../senior-dev-reservation.js";

function mockRows(rows: Array<{ id: number }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValueOnce({ from });
  return { from, where, limit };
}

describe("Senior Dev reservation ledger", () => {
  it("returns true when a paid reservation exists", async () => {
    mockRows([{ id: 77 }]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(true);
  });

  it("returns false when no negative reservation exists", async () => {
    mockRows([]);

    await expect(wasSeniorDevReservationCharged(1, 2, 3)).resolves.toBe(false);
  });
});

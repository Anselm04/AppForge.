import { managerRepairCycle } from "../services/managerRepairWorker.js";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import postgres from "postgres";
import { MANAGER_COMMANDS_SQL } from "../db/managerCommandSchema.js";
import {
  postgresManagerLedger,
  commandHash,
} from "../services/managerCommands.js";
const repairMocks = vi.hoisted(() => ({
  start: vi.fn(),
  resume: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("../db.js", () => ({
  getUserById: async () => ({
    id: 1,
    email: "owner@fixture.invalid",
    isBanned: false,
  }),
  getSeniorDevTaskById: async () => ({ id: 73, userId: 1, status: "failed" }),
}));
vi.mock("../lib/owner.js", () => ({ isOwnerEmail: () => true }));
vi.mock("../services/accountLifecycleService.js", () => ({
  getAccountLifecycleState: async () => "active",
}));
vi.mock("../middleware/accountLifecycleAccess.js", () => ({
  accountLifecycleAllowsAccess: () => true,
}));
vi.mock("../services/seniorDevExecution.js", async (original) => ({
  ...(await original<typeof import("../services/seniorDevExecution.js")>()),
  startSeniorDevExecution: repairMocks.start,
  resumeSeniorDevExecution: repairMocks.resume,
  settleSeniorDevExecution: repairMocks.settle,
}));
const testUrl = process.env.APPFORGE_MANAGER_TEST_DATABASE_URL;
// This suite mutates only its explicitly named, local disposable test database.
if (testUrl) {
  const u = new URL(testUrl);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
    u.pathname !== "/appforge_manager_test"
  )
    throw Error(
      "Manager ledger integration requires a local appforge_manager_test database",
    );
}
const sql = testUrl
  ? postgres(testUrl, { max: 4, prepare: false, connect_timeout: 5 })
  : undefined;
const input = {
  requestId: "fixture-command",
  action: "build",
  input: { title: "Fixture app" },
  inputHash: commandHash("build", { title: "Fixture app" }),
};
describe.runIf(Boolean(sql))(
  "durable Manager command ledger on PostgreSQL",
  () => {
    beforeAll(async () => {
      await sql!.unsafe(
        "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY); CREATE TABLE IF NOT EXISTS senior_dev_tasks(id INTEGER PRIMARY KEY); INSERT INTO users(id) VALUES(1),(2) ON CONFLICT DO NOTHING;",
      );
      await sql!.unsafe(MANAGER_COMMANDS_SQL);
      await sql!.unsafe(MANAGER_COMMANDS_SQL);
    });
    beforeEach(async () => {
      await sql!.unsafe("DELETE FROM appforge_manager_commands");
    });
    afterAll(async () => {
      await sql?.end({ timeout: 5 });
    });
    it("concurrent identical commands reserve exactly one execution and survive another client", async () => {
      const ledger = postgresManagerLedger(sql!);
      const reservations = await Promise.all(
        Array.from({ length: 8 }, () => ledger.reserve(1, input, 10)),
      );
      expect(reservations.filter((r) => r.fresh)).toHaveLength(1);
      await ledger.complete(1, input.requestId, { id: 20 });
      const connection = postgres(testUrl!, { max: 1, prepare: false });
      try {
        expect(
          await postgresManagerLedger(connection).get(1, input.requestId),
        ).toMatchObject({ status: "completed", result: { id: 20 } });
        expect(
          await postgresManagerLedger(connection).get(2, input.requestId),
        ).toBeNull();
      } finally {
        await connection.end({ timeout: 5 });
      }
    });
    it("rejects mismatched idempotency input and enforces the daily bound under contention", async () => {
      const ledger = postgresManagerLedger(sql!);
      await ledger.reserve(1, input, 1);
      await expect(
        ledger.reserve(
          1,
          { ...input, inputHash: commandHash("build", { title: "Different" }) },
          1,
        ),
      ).rejects.toThrow("manager_idempotency_conflict");
      await expect(
        ledger.reserve(1, { ...input, requestId: "second" }, 1),
      ).rejects.toThrow("manager_daily_limit_reached");
      expect((await ledger.reserve(1, input, 1)).fresh).toBe(false);
    });
    it("preserves uncertain outcomes for reconciliation instead of authorizing duplicate effects", async () => {
      const ledger = postgresManagerLedger(sql!);
      await ledger.reserve(1, input, 10);
      await ledger.fail(1, input.requestId, "provider_response_lost", true);
      expect(await ledger.get(1, input.requestId)).toMatchObject({
        status: "executing",
        error: "provider_response_lost",
      });
      expect((await ledger.reserve(1, input, 10)).fresh).toBe(false);
      await ledger.complete(1, input.requestId, { id: 42, reconciled: true });
      expect(await ledger.get(1, input.requestId)).toMatchObject({
        status: "completed",
        result: { id: 42 },
      });
    });
    it("RLS hides company commands from an unrelated database role even with a SELECT grant", async () => {
      const ledger = postgresManagerLedger(sql!);
      await ledger.reserve(1, input, 10);
      const connection = await sql!.reserve();
      try {
        await connection.unsafe(
          "CREATE ROLE manager_fixture_reader; GRANT SELECT ON appforge_manager_commands TO manager_fixture_reader; SET ROLE manager_fixture_reader;",
        );
        expect(
          await connection.unsafe("SELECT * FROM appforge_manager_commands"),
        ).toHaveLength(0);
      } finally {
        await connection.unsafe(
          "RESET ROLE; REVOKE SELECT ON appforge_manager_commands FROM manager_fixture_reader; DROP ROLE manager_fixture_reader;",
        );
        connection.release();
      }
    });
    it("a repair admission and its durable execution queue commit together and survive worker restart", async () => {
      await sql!`INSERT INTO senior_dev_tasks(id) VALUES(71) ON CONFLICT DO NOTHING`;
      const ledger = postgresManagerLedger(sql!);
      const repair = {
        requestId: "repair-71",
        action: "repair",
        input: { projectId: 8, request: "Fix the save button" },
        inputHash: commandHash("repair", {
          projectId: 8,
          request: "Fix the save button",
        }),
      };
      await ledger.reserve(1, repair, 10);
      await ledger.complete(1, repair.requestId, {
        taskId: 71,
        status: "planning",
      });
      expect(
        (
          await sql!`SELECT status FROM appforge_manager_repair_queue WHERE task_id=71`
        )[0].status,
      ).toBe("queued");
      const connection = postgres(testUrl!, { max: 2, prepare: false });
      let executions = 0;
      try {
        const run = async () => {
          executions++;
          return {
            status: "completed" as const,
            summary: "Fixed",
            creditsSpent: 0,
          };
        };
        await Promise.all([
          managerRepairCycle(connection, 1, run),
          managerRepairCycle(connection, 1, run),
        ]);
        expect(executions).toBe(1);
        expect(
          (
            await sql!`SELECT status FROM appforge_manager_repair_queue WHERE task_id=71`
          )[0].status,
        ).toBe("completed");
        expect(await managerRepairCycle(connection, 1, run)).toBe(false);
      } finally {
        await connection.end({ timeout: 5 });
      }
    });
    it("repair approval queues resume without consuming the Senior Dev state transition in the API", async () => {
      await sql!`INSERT INTO senior_dev_tasks(id) VALUES(72) ON CONFLICT DO NOTHING`;
      const ledger = postgresManagerLedger(sql!);
      const approval = {
        requestId: "approve-72",
        action: "approve_repair",
        input: { taskId: 72 },
        inputHash: commandHash("approve_repair", { taskId: 72 }),
      };
      await ledger.reserve(1, approval, 10);
      await ledger.complete(1, approval.requestId, {
        taskId: 72,
        status: "queued_for_resume",
      });
      let resumed = false;
      await managerRepairCycle(sql!, 1, async (input, resume) => {
        expect(input.taskId).toBe(72);
        resumed = resume;
        return { status: "completed", summary: "Resumed", creditsSpent: 0 };
      });
      expect(resumed).toBe(true);
    });
    it("reclaims interrupted failed repairs by settlement alone despite missing queue error", async () => {
      await sql!`INSERT INTO senior_dev_tasks(id) VALUES(73) ON CONFLICT DO NOTHING`;
      for (const action of ["repair", "approve_repair"]) {
        const ledger = postgresManagerLedger(sql!);
        const command = {
          ...input,
          requestId: `crashed-${action}`,
          action,
          input: { taskId: 73 },
        };
        await ledger.reserve(1, command, 10);
        await ledger.complete(1, command.requestId, { taskId: 73 });
        await sql!`UPDATE appforge_manager_repair_queue SET status='running', lease_until=now()-interval '1 minute', error_code=NULL WHERE request_id=${command.requestId}`;
        repairMocks.settle.mockResolvedValue({
          status: "failed",
          summary: "Settled",
          creditsSpent: 0,
        });
        expect(await managerRepairCycle(sql!, 1)).toBe(true);
      }
      expect(repairMocks.settle).toHaveBeenCalledTimes(2);
      expect(repairMocks.start).not.toHaveBeenCalled();
      expect(repairMocks.resume).not.toHaveBeenCalled();
    });
  },
);

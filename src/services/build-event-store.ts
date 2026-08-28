import { db } from "../db.js";
import { sql } from "drizzle-orm";

export async function appendBuildEvent(
  projectId: number,
  event: string,
  payload: unknown,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO build_events (project_id, event, payload)
    VALUES (${projectId}, ${event}, ${JSON.stringify(payload)}::jsonb)
  `);
}

export async function getBuildEventsSince(
  projectId: number,
  afterId = 0,
): Promise<Array<{ id: number; event: string; payload: unknown }>> {
  const rows = await db.execute<{
    id: number;
    event: string;
    payload: unknown;
  }>(sql`
    SELECT id, event, payload
    FROM build_events
    WHERE project_id = ${projectId} AND id > ${afterId}
    ORDER BY id ASC
  `);
  return rows as unknown as Array<{
    id: number;
    event: string;
    payload: unknown;
  }>;
}

export async function clearBuildEvents(projectId: number): Promise<void> {
  await db.execute(
    sql`DELETE FROM build_events WHERE project_id = ${projectId}`,
  );
}

import { db } from "../db.js";
import { sql } from "drizzle-orm";

export type StoredBuildEvent = {
  id: number;
  event: string;
  payload: unknown;
};

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
): Promise<StoredBuildEvent[]> {
  const rows = await db.execute<StoredBuildEvent>(sql`
    SELECT id, event, payload
    FROM build_events
    WHERE project_id = ${projectId} AND id > ${afterId}
    ORDER BY id ASC
  `);
  return rows as unknown as StoredBuildEvent[];
}

/**
 * Returns the newest persisted terminal event for a build, if one exists.
 * Build events are persisted before either runtime or Redis publication, so
 * this query safely closes the tiny replay-to-subscribe race window.
 */
export async function getLatestTerminalBuildEvent(
  projectId: number,
): Promise<StoredBuildEvent | null> {
  const rows = await db.execute<StoredBuildEvent>(sql`
    SELECT id, event, payload
    FROM build_events
    WHERE project_id = ${projectId}
      AND event IN ('done', 'error')
    ORDER BY id DESC
    LIMIT 1
  `);
  const result = rows as unknown as StoredBuildEvent[];
  return result[0] ?? null;
}

export async function clearBuildEvents(projectId: number): Promise<void> {
  await db.execute(
    sql`DELETE FROM build_events WHERE project_id = ${projectId}`,
  );
}

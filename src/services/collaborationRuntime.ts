import { sql } from "drizzle-orm";
import { db } from "../db.js";

export type CollaborationRole = "viewer" | "editor";

export type CollaborationCursor = {
  x: number;
  y: number;
  artifactId?: string;
};

export type CollaborationPresence = {
  projectId: number;
  userId: number;
  sessionId: string;
  displayName: string | null;
  cursor: CollaborationCursor | null;
  joinedAt: Date;
  lastSeenAt: Date;
};

export type CollaborationVersion = {
  id: number;
  projectId: number;
  userId: number;
  label: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

const PRESENCE_TTL_SECONDS = 90;
const MAX_ROOM_VERSIONS = 50;
let schemaReady = false;

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function isWritableCollaborationRole(
  role: CollaborationRole | "owner" | null,
): boolean {
  return role === "owner" || role === "editor";
}

export function isPresenceFresh(lastSeenAt: Date, now = new Date()): boolean {
  return now.getTime() - lastSeenAt.getTime() <= PRESENCE_TTL_SECONDS * 1000;
}

export function validateVersionMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const bytes = Buffer.byteLength(JSON.stringify(metadata), "utf8");
  if (bytes > 20_000) {
    throw new Error("Version metadata is too large");
  }
  return metadata;
}

async function ensureCollaborationSchema() {
  if (schemaReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS collaboration_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'viewer',
      invited_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS collaboration_members_user_idx
      ON collaboration_members(user_id);

    CREATE TABLE IF NOT EXISTS collaboration_presence (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id VARCHAR(96) NOT NULL,
      display_name VARCHAR(160),
      cursor JSONB,
      joined_at TIMESTAMP DEFAULT NOW(),
      last_seen_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id, session_id)
    );
    CREATE INDEX IF NOT EXISTS collaboration_presence_project_idx
      ON collaboration_presence(project_id, last_seen_at DESC);

    CREATE TABLE IF NOT EXISTS collaboration_versions (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label VARCHAR(160),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS collaboration_versions_project_idx
      ON collaboration_versions(project_id, created_at DESC);
  `);
  schemaReady = true;
}

export async function getCollaboratorRole(
  projectId: number,
  userId: number,
): Promise<CollaborationRole | null> {
  await ensureCollaborationSchema();
  const result = await db.execute(sql`
    SELECT role
    FROM collaboration_members
    WHERE project_id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `);
  const first = rows<{ role: CollaborationRole }>(result)[0];
  return first?.role === "editor" || first?.role === "viewer"
    ? first.role
    : null;
}

export async function upsertCollaborator(input: {
  projectId: number;
  userId: number;
  invitedByUserId: number;
  role: CollaborationRole;
}) {
  await ensureCollaborationSchema();
  await db.execute(sql`
    INSERT INTO collaboration_members (
      project_id,
      user_id,
      role,
      invited_by_user_id
    ) VALUES (
      ${input.projectId},
      ${input.userId},
      ${input.role},
      ${input.invitedByUserId}
    )
    ON CONFLICT (project_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, invited_by_user_id = EXCLUDED.invited_by_user_id
  `);
}

export async function removeCollaborator(projectId: number, userId: number) {
  await ensureCollaborationSchema();
  await db.execute(sql`
    DELETE FROM collaboration_members
    WHERE project_id = ${projectId} AND user_id = ${userId}
  `);
  await db.execute(sql`
    DELETE FROM collaboration_presence
    WHERE project_id = ${projectId} AND user_id = ${userId}
  `);
}

export async function listCollaborators(projectId: number) {
  await ensureCollaborationSchema();
  const result = await db.execute(sql`
    SELECT
      cm.user_id AS "userId",
      cm.role,
      cm.created_at AS "createdAt",
      u.name,
      u.email
    FROM collaboration_members cm
    INNER JOIN users u ON u.id = cm.user_id
    WHERE cm.project_id = ${projectId}
    ORDER BY cm.created_at ASC
  `);
  return rows<{
    userId: number;
    role: CollaborationRole;
    createdAt: Date;
    name: string | null;
    email: string | null;
  }>(result);
}

export async function joinCollaborationRoom(input: {
  projectId: number;
  userId: number;
  sessionId: string;
  displayName?: string | null;
  cursor?: CollaborationCursor | null;
}) {
  await ensureCollaborationSchema();
  await db.execute(sql`
    INSERT INTO collaboration_presence (
      project_id,
      user_id,
      session_id,
      display_name,
      cursor,
      joined_at,
      last_seen_at
    ) VALUES (
      ${input.projectId},
      ${input.userId},
      ${input.sessionId},
      ${input.displayName ?? null},
      ${JSON.stringify(input.cursor ?? null)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (project_id, user_id, session_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      cursor = EXCLUDED.cursor,
      last_seen_at = NOW()
  `);
}

export async function heartbeatCollaborationRoom(input: {
  projectId: number;
  userId: number;
  sessionId: string;
  cursor?: CollaborationCursor | null;
}) {
  await ensureCollaborationSchema();
  await db.execute(sql`
    UPDATE collaboration_presence
    SET cursor = ${JSON.stringify(input.cursor ?? null)}::jsonb,
        last_seen_at = NOW()
    WHERE project_id = ${input.projectId}
      AND user_id = ${input.userId}
      AND session_id = ${input.sessionId}
  `);
}

export async function leaveCollaborationRoom(input: {
  projectId: number;
  userId: number;
  sessionId: string;
}) {
  await ensureCollaborationSchema();
  await db.execute(sql`
    DELETE FROM collaboration_presence
    WHERE project_id = ${input.projectId}
      AND user_id = ${input.userId}
      AND session_id = ${input.sessionId}
  `);
}

export async function getCollaborationRoom(projectId: number) {
  await ensureCollaborationSchema();
  await db.execute(sql`
    DELETE FROM collaboration_presence
    WHERE project_id = ${projectId}
      AND last_seen_at < NOW() - INTERVAL '${sql.raw(String(PRESENCE_TTL_SECONDS))} seconds'
  `);

  const presenceResult = await db.execute(sql`
    SELECT
      project_id AS "projectId",
      user_id AS "userId",
      session_id AS "sessionId",
      display_name AS "displayName",
      cursor,
      joined_at AS "joinedAt",
      last_seen_at AS "lastSeenAt"
    FROM collaboration_presence
    WHERE project_id = ${projectId}
    ORDER BY joined_at ASC
  `);

  const versionResult = await db.execute(sql`
    SELECT
      id,
      project_id AS "projectId",
      user_id AS "userId",
      label,
      metadata,
      created_at AS "createdAt"
    FROM collaboration_versions
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${MAX_ROOM_VERSIONS}
  `);

  return {
    projectId,
    presence: rows<CollaborationPresence>(presenceResult),
    versions: rows<CollaborationVersion>(versionResult),
  };
}

export async function createCollaborationVersion(input: {
  projectId: number;
  userId: number;
  label?: string | null;
  metadata: Record<string, unknown>;
}) {
  await ensureCollaborationSchema();
  const metadata = validateVersionMetadata(input.metadata);
  const inserted = await db.execute(sql`
    INSERT INTO collaboration_versions (project_id, user_id, label, metadata)
    VALUES (
      ${input.projectId},
      ${input.userId},
      ${input.label ?? null},
      ${JSON.stringify(metadata)}::jsonb
    )
    RETURNING
      id,
      project_id AS "projectId",
      user_id AS "userId",
      label,
      metadata,
      created_at AS "createdAt"
  `);

  await db.execute(sql`
    DELETE FROM collaboration_versions
    WHERE project_id = ${input.projectId}
      AND id NOT IN (
        SELECT id
        FROM collaboration_versions
        WHERE project_id = ${input.projectId}
        ORDER BY created_at DESC
        LIMIT ${MAX_ROOM_VERSIONS}
      )
  `);

  return rows<CollaborationVersion>(inserted)[0] ?? null;
}

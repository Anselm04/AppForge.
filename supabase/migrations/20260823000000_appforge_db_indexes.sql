CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" ("user_id");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects" ("created_at");
CREATE INDEX IF NOT EXISTS "projects_user_created_idx" ON "projects" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "agent_logs_project_idx" ON "agent_logs" ("project_id");
CREATE INDEX IF NOT EXISTS "agent_logs_agent_idx" ON "agent_logs" ("agent");
CREATE INDEX IF NOT EXISTS "agent_logs_project_created_idx" ON "agent_logs" ("project_id", "created_at");

CREATE INDEX IF NOT EXISTS "cosine_improvements_project_idx" ON "cosine_improvements" ("project_id");
CREATE INDEX IF NOT EXISTS "cosine_improvements_user_idx" ON "cosine_improvements" ("user_id");

-- Also add missing indexes on lookup tables
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "github_connections_user_id_idx" ON "github_connections" ("user_id");
CREATE INDEX IF NOT EXISTS "cosine_connections_user_id_idx" ON "cosine_connections" ("user_id");
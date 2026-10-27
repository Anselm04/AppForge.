/** Append-only migration; no change to an applied migration checksum. */
export const MANAGER_COMMANDS_SQL = `
CREATE TABLE IF NOT EXISTS appforge_manager_commands (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id VARCHAR(100) NOT NULL,
 action VARCHAR(40) NOT NULL,
 input_hash VARCHAR(64) NOT NULL,
 input JSONB NOT NULL,
 status VARCHAR(20) NOT NULL CHECK (status IN ('executing','completed','failed')),
 result JSONB,
 error_code VARCHAR(100),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, request_id)
);
CREATE INDEX IF NOT EXISTS appforge_manager_commands_daily_idx ON appforge_manager_commands(user_id, created_at);
ALTER TABLE appforge_manager_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON appforge_manager_commands FROM PUBLIC;
CREATE TABLE IF NOT EXISTS appforge_manager_repair_queue (
 user_id INTEGER NOT NULL,
 request_id VARCHAR(100) NOT NULL,
 task_id INTEGER NOT NULL REFERENCES senior_dev_tasks(id) ON DELETE CASCADE,
 kind VARCHAR(10) NOT NULL CHECK (kind IN ('start','resume')),
 status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
 claim_id VARCHAR(64),
 lease_until TIMESTAMPTZ,
 due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 error_code VARCHAR(100),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_id),
 FOREIGN KEY(user_id,request_id) REFERENCES appforge_manager_commands(user_id,request_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS appforge_manager_repair_due_idx ON appforge_manager_repair_queue(status,due_at);
ALTER TABLE appforge_manager_repair_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON appforge_manager_repair_queue FROM PUBLIC;
`;

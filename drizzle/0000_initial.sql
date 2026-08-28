-- AppForge initial Drizzle migration (mirrors ensureAppSchema core tables)
-- Run: npm run db:migrate

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "name" varchar(255),
  "is_banned" boolean DEFAULT false,
  "banned_at" timestamp,
  "ban_reason" text,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" varchar(255) NOT NULL,
  "description" text,
  "tech_stack" varchar(100),
  "status" varchar(50) DEFAULT 'pending',
  "locale" varchar(10) DEFAULT 'en',
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "moderation_flags" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "project_id" integer REFERENCES "projects"("id") ON DELETE cascade,
  "flagged_text" text NOT NULL,
  "category" varchar(50) NOT NULL,
  "auto_flagged" boolean DEFAULT true,
  "admin_reviewed" boolean DEFAULT false,
  "admin_action" varchar(50),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "moderation_flags_user_idx" ON "moderation_flags" ("user_id");
CREATE INDEX IF NOT EXISTS "moderation_flags_reviewed_idx" ON "moderation_flags" ("admin_reviewed");

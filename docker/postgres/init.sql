-- ============================================================
-- AppForge PostgreSQL Initialization Script
-- ============================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create appforge user if not exists (for local dev)
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'appforge') THEN
      CREATE ROLE appforge WITH LOGIN PASSWORD 'appforge_dev_password';
   END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE appforge TO appforge;

-- Create appforge schema
CREATE SCHEMA IF NOT EXISTS appforge;
GRANT ALL PRIVILEGES ON SCHEMA appforge TO appforge;

-- Sample tables structure (for local development)
-- This mirrors your Supabase schema

-- Users table
CREATE TABLE IF NOT EXISTS appforge.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS appforge.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES appforge.users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Builds table
CREATE TABLE IF NOT EXISTS appforge.builds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES appforge.projects(id),
    status VARCHAR(50) DEFAULT 'pending',
    output_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON appforge.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_builds_project_id ON appforge.builds(project_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON appforge.users(email);

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA appforge TO appforge;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA appforge TO appforge;

-- Insert sample data (optional)
-- INSERT INTO appforge.users (email) VALUES ('test@example.com');

-- Comment
COMMENT ON TABLE appforge.users IS 'User accounts';
COMMENT ON TABLE appforge.projects IS 'User projects';
COMMENT ON TABLE appforge.builds IS 'App build history';

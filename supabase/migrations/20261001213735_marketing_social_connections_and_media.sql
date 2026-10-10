-- Durable social/OAuth connection metadata + media collections used by Marketing routes
CREATE TABLE IF NOT EXISTS marketing.social_connections (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  platform text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_social_connections_owner_platform_uq UNIQUE (owner_id, platform)
);
CREATE INDEX IF NOT EXISTS marketing_social_connections_owner_idx ON marketing.social_connections (owner_id);

CREATE TABLE IF NOT EXISTS marketing.social_posts (
  id text PRIMARY KEY,
  owner_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_social_posts_owner_idx ON marketing.social_posts (owner_id);

CREATE TABLE IF NOT EXISTS marketing.videos (
  id text PRIMARY KEY,
  owner_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_videos_owner_idx ON marketing.videos (owner_id);

CREATE TABLE IF NOT EXISTS marketing.avatars (
  id text PRIMARY KEY,
  owner_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_avatars_owner_idx ON marketing.avatars (owner_id);

CREATE TABLE IF NOT EXISTS marketing.ad_packs (
  id text PRIMARY KEY,
  owner_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_ad_packs_owner_idx ON marketing.ad_packs (owner_id);

CREATE TABLE IF NOT EXISTS marketing.ad_spend (
  id text PRIMARY KEY,
  owner_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_ad_spend_owner_idx ON marketing.ad_spend (owner_id);

ALTER TABLE marketing.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.ad_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.ad_spend ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='marketing' AND tablename='social_connections' AND policyname='service_role_only') THEN
    CREATE POLICY service_role_only ON marketing.social_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='marketing' AND tablename='social_posts' AND policyname='service_role_only') THEN
    CREATE POLICY service_role_only ON marketing.social_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='marketing' AND tablename='videos' AND policyname='service_role_only') THEN
    CREATE POLICY service_role_only ON marketing.videos FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='marketing' AND tablename='avatars' AND policyname='service_role_only') THEN
    CREATE POLICY service_role_only ON marketing.avatars FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='marketing' AND tablename='ad_packs' AND policyname='service_role_only') THEN
    CREATE POLICY service_role_only ON marketing.ad_packs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='marketing' AND tablename='ad_spend' AND policyname='service_role_only') THEN
    CREATE POLICY service_role_only ON marketing.ad_spend FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

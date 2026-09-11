create schema if not exists marketing;

revoke all on schema marketing from public, anon, authenticated;
grant usage on schema marketing to service_role;

create table if not exists marketing.users (
  id text primary key,
  email text not null,
  password_hash text not null,
  role text not null default 'user',
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketing_users_email_lower_uidx on marketing.users (lower(email));

create table if not exists marketing.organizations (
  id text primary key,
  name text not null,
  owner_id text not null,
  members jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_organizations_owner_idx on marketing.organizations(owner_id);

create table if not exists marketing.invites (
  id text primary key,
  org_id text not null,
  email text not null,
  role text not null default 'member',
  token text not null unique,
  expires_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_invites_org_idx on marketing.invites(org_id);
create index if not exists marketing_invites_email_idx on marketing.invites(lower(email));

create table if not exists marketing.agents (
  id text primary key,
  agent_id text unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing.campaigns (
  id text primary key,
  owner_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_owner_idx on marketing.campaigns(owner_id);

create table if not exists marketing.content_items (
  id text primary key,
  owner_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_content_owner_idx on marketing.content_items(owner_id);

create table if not exists marketing.leads (
  id text primary key,
  owner_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_leads_owner_idx on marketing.leads(owner_id);

create table if not exists marketing.legal_docs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing.tasks (
  id text primary key,
  owner_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_tasks_owner_idx on marketing.tasks(owner_id);

create table if not exists marketing.subscriptions (
  id text primary key,
  user_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_subscriptions_user_idx on marketing.subscriptions(user_id);

create table if not exists marketing.analytics (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists marketing.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists marketing.god_codes (
  id text primary key,
  hash text not null unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table marketing.users enable row level security;
alter table marketing.organizations enable row level security;
alter table marketing.invites enable row level security;
alter table marketing.agents enable row level security;
alter table marketing.campaigns enable row level security;
alter table marketing.content_items enable row level security;
alter table marketing.leads enable row level security;
alter table marketing.legal_docs enable row level security;
alter table marketing.tasks enable row level security;
alter table marketing.subscriptions enable row level security;
alter table marketing.analytics enable row level security;
alter table marketing.settings enable row level security;
alter table marketing.god_codes enable row level security;

grant all privileges on all tables in schema marketing to service_role;
alter default privileges in schema marketing grant all privileges on tables to service_role;

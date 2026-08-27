-- Supabase-native senior dev task tracking (UUID schema)
create table if not exists public.senior_dev_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request text not null check (char_length(request) between 1 and 20000),
  mode text not null default 'collaborative' check (mode in ('collaborative', 'autonomous')),
  plan jsonb,
  plan_approved boolean not null default false,
  status text not null default 'planning' check (status in ('planning', 'executing', 'completed', 'failed', 'cancelled')),
  changes jsonb,
  validation_result jsonb,
  summary text,
  credits_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.build_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null,
  label text,
  files jsonb not null,
  file_count integer not null,
  tech_stack text,
  validation_result jsonb,
  audit_scores jsonb,
  cost_estimate jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists senior_dev_tasks_project_idx on public.senior_dev_tasks (project_id);
create index if not exists senior_dev_tasks_user_idx on public.senior_dev_tasks (user_id);
create index if not exists senior_dev_tasks_status_idx on public.senior_dev_tasks (status);
create index if not exists snapshots_project_version_idx on public.build_snapshots (project_id, version);
create index if not exists snapshots_current_idx on public.build_snapshots (is_current);
create index if not exists snapshots_project_idx on public.build_snapshots (project_id);

alter table public.senior_dev_tasks enable row level security;
alter table public.build_snapshots enable row level security;

create policy "senior_dev_tasks_owner_all" on public.senior_dev_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "build_snapshots_owner_all" on public.build_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

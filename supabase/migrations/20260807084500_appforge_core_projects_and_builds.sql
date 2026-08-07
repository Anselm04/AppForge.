create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  idea text not null check (char_length(idea) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'planning', 'completed', 'failed', 'archived')),
  current_spec jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.build_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  prompt text not null check (char_length(prompt) between 1 and 20000),
  provider text,
  model text,
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  build_run_id uuid not null references public.build_runs(id) on delete cascade,
  role text not null check (role in ('architect', 'backend', 'frontend', 'database', 'devops', 'security', 'testing')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'skipped')),
  output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  unique (build_run_id, role)
);

create index projects_owner_updated_idx on public.projects(owner_id, updated_at desc);
create index build_runs_project_created_idx on public.build_runs(project_id, created_at desc);
create index agent_runs_build_role_idx on public.agent_runs(build_run_id, role);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.build_runs enable row level security;
alter table public.agent_runs enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "projects_owner_all" on public.projects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "build_runs_owner_all" on public.build_runs for all using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()) and requested_by = auth.uid());
create policy "agent_runs_owner_select" on public.agent_runs for select using (exists (select 1 from public.build_runs b join public.projects p on p.id = b.project_id where b.id = build_run_id and p.owner_id = auth.uid()));

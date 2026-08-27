-- Additional indexes for Supabase-native schema (UUID tables from core migration)
create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_created_at_idx on public.projects (created_at);
create index if not exists build_runs_status_idx on public.build_runs (status);
create index if not exists agent_runs_status_idx on public.agent_runs (status);

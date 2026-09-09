-- Applied to the production Supabase project on 2026-09-09.
-- Optimize ownership policies so auth.uid() is initialized once per statement,
-- and cover foreign keys identified by Supabase's performance advisor.

create index if not exists build_runs_requested_by_idx on public.build_runs (requested_by);
create index if not exists build_snapshots_user_id_idx on public.build_snapshots (user_id);

alter policy build_runs_owner_all on public.build_runs
  using (requested_by = (select auth.uid()))
  with check (requested_by = (select auth.uid()));

alter policy agent_runs_owner_select on public.agent_runs
  using (exists (
    select 1
    from public.build_runs br
    join public.projects p on p.id = br.project_id
    where br.id = agent_runs.build_run_id
      and p.owner_id = (select auth.uid())
  ));

alter policy entitlements_select_own on public.appforge_entitlements
  using (user_id = (select auth.uid()));

alter policy build_snapshots_owner_all on public.build_snapshots
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy profiles_select_own on public.profiles
  using (id = (select auth.uid()));

alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy projects_delete_own on public.projects
  using (owner_id = (select auth.uid()));

alter policy projects_insert_entitled on public.projects
  with check (owner_id = (select auth.uid()) and public.appforge_can_create_project());

alter policy projects_select_own on public.projects
  using (owner_id = (select auth.uid()));

alter policy projects_update_own on public.projects
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy senior_dev_tasks_owner_all on public.senior_dev_tasks
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

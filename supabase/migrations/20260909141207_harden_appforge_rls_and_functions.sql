-- Applied to the production Supabase project on 2026-09-09.
-- Keep source control aligned with the production migration history.

alter function public.appforge_can_create_project() security invoker;
revoke all on function public.appforge_can_create_project() from public, anon;
grant execute on function public.appforge_can_create_project() to authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

alter policy agent_runs_owner_select on public.agent_runs to authenticated;
alter policy entitlements_select_own on public.appforge_entitlements to authenticated;
alter policy build_runs_owner_all on public.build_runs to authenticated;
alter policy build_snapshots_owner_all on public.build_snapshots to authenticated;
alter policy profiles_select_own on public.profiles to authenticated;
alter policy profiles_update_own on public.profiles to authenticated;
alter policy projects_delete_own on public.projects to authenticated;
alter policy projects_insert_entitled on public.projects to authenticated;
alter policy projects_select_own on public.projects to authenticated;
alter policy projects_update_own on public.projects to authenticated;
alter policy senior_dev_tasks_owner_all on public.senior_dev_tasks to authenticated;

-- stripe_webhook_events is intentionally server-only. RLS remains enabled and
-- browser roles receive no table privileges or policies.
revoke all on table public.stripe_webhook_events from anon, authenticated;

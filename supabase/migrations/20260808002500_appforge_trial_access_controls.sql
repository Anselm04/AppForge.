create or replace function public.appforge_can_create_project()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.appforge_entitlements e where e.user_id = auth.uid() and (e.subscription_status = 'active' or (e.subscription_status = 'trialing' and e.current_period_end > now() and (select count(*) from public.projects p where p.owner_id = auth.uid()) < 1)));
$$;
revoke all on function public.appforge_can_create_project() from public;
grant execute on function public.appforge_can_create_project() to authenticated;
drop policy if exists "projects_owner_all" on public.projects;
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_entitled" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_select_own" on public.projects for select using (auth.uid() = owner_id);
create policy "projects_insert_entitled" on public.projects for insert with check (auth.uid() = owner_id and public.appforge_can_create_project());
create policy "projects_update_own" on public.projects for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = owner_id);
drop policy if exists "entitlements_select_own" on public.appforge_entitlements;
create policy "entitlements_select_own" on public.appforge_entitlements for select using (auth.uid() = user_id);

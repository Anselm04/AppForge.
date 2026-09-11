-- Explicitly document and enforce service-role-only access for private/server tables.
-- These policies do not grant anon/authenticated access; table/schema grants remain revoked.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('marketing','agents'),
      ('marketing','analytics'),
      ('marketing','campaigns'),
      ('marketing','content_items'),
      ('marketing','god_codes'),
      ('marketing','invites'),
      ('marketing','leads'),
      ('marketing','legal_docs'),
      ('marketing','organizations'),
      ('marketing','settings'),
      ('marketing','subscriptions'),
      ('marketing','tasks'),
      ('marketing','users'),
      ('public','stripe_webhook_events')
    ) as t(schema_name, table_name)
  loop
    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = r.schema_name
        and p.tablename = r.table_name
        and p.policyname = 'service_role_only'
    ) then
      execute format(
        'create policy service_role_only on %I.%I for all to service_role using (true) with check (true)',
        r.schema_name,
        r.table_name
      );
    end if;
  end loop;
end $$;

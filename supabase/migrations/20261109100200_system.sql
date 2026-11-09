-- System: audit log, platform settings and the generic audit trigger.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

comment on table public.audit_logs is 'Append-only record of privileged actions. Written by triggers and SECURITY DEFINER functions.';

-- Generic row-change auditor for admin-managed tables.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_id text;
begin
  row_id := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end,
    case when tg_op = 'DELETE' then to_jsonb(old) ->> 'key' else to_jsonb(new) ->> 'key' end
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

-- Explicit audit entry from application code or other functions.
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke execute on function public.write_audit_log(text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit_log(text, text, text, jsonb, jsonb, jsonb) to service_role;

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

create trigger platform_settings_audit
  after insert or update or delete on public.platform_settings
  for each row execute function public.audit_row_change();

alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

create policy "audit_logs: admins read"
  on public.audit_logs for select to authenticated
  using (public.is_platform_admin());

revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke all on public.audit_logs from anon;

create policy "platform_settings: admins manage"
  on public.platform_settings for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

revoke all on public.platform_settings from anon;

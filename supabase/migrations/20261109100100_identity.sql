-- Identity: profiles, platform roles and role helper functions.

-- profiles --------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  avatar_url text,
  locale text not null default 'bg' check (locale in ('bg', 'en')),
  is_suspended boolean not null default false,
  suspended_reason text,
  marketing_consent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-schema mirror of auth.users with app profile fields. 1:1 with auth.users.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- platform roles ----------------------------------------------------------------

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.platform_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

comment on table public.user_roles is
  'Privileged platform roles. Every user is implicitly a customer. Only super_admins can write here.';

-- Role helpers. SECURITY DEFINER so they can read user_roles regardless of the
-- caller''s RLS; search_path pinned to prevent hijacking.

create or replace function public.has_platform_role(required public.platform_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and p.is_suspended = false
      and (ur.role = required or ur.role = 'super_admin')
  )
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_platform_role('super_admin')
$$;

-- Moderators and super admins.
create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_platform_role('moderator')
$$;

-- New auth user → profile row. Never derives privileges from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    left(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), 32)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: staff read all"
  on public.profiles for select to authenticated
  using (public.is_platform_staff());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users may only change their own descriptive fields; suspension and deletion
-- flags are changed by audited admin functions.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, locale, marketing_consent_at)
  on public.profiles to authenticated;

create policy "user_roles: read own"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy "user_roles: admins read all"
  on public.user_roles for select to authenticated
  using (public.is_platform_admin());

create policy "user_roles: admins insert"
  on public.user_roles for insert to authenticated
  with check (public.is_platform_admin() and user_id <> auth.uid());

create policy "user_roles: admins delete"
  on public.user_roles for delete to authenticated
  using (public.is_platform_admin() and user_id <> auth.uid());

revoke all on public.user_roles from anon;
revoke update on public.user_roles from authenticated;

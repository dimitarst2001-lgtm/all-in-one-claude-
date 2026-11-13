-- Businesses (tenants), memberships, locations, hours, offered services and media.
--
-- Tenant isolation: every tenant-owned row carries business_id (directly or via
-- its location) and policies call has_business_role(). Public read access is
-- added in the subscriptions migration, where is_publicly_visible() is defined.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  city_id uuid not null references public.cities (id),
  primary_category_id uuid not null references public.categories (id),
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 5000),
  phone text check (char_length(phone) <= 32),
  email extensions.citext check (char_length(email) <= 254),
  website text check (website ~* '^https?://' and char_length(website) <= 300),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),

  status public.business_status not null default 'draft',
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  suspended_at timestamptz,
  is_verified boolean not null default false,
  is_demo boolean not null default false,

  booking_enabled boolean not null default false,
  booking_auto_confirm boolean not null default false,
  booking_slot_minutes integer not null default 30 check (booking_slot_minutes between 5 and 480),
  booking_buffer_minutes integer not null default 0 check (booking_buffer_minutes between 0 and 240),
  booking_lead_hours integer not null default 2 check (booking_lead_hours between 0 and 168),
  booking_horizon_days integer not null default 30 check (booking_horizon_days between 1 and 180),

  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (city_id, slug)
);

create index businesses_status_idx on public.businesses (status) where deleted_at is null;
create index businesses_city_category_idx on public.businesses (city_id, primary_category_id) where deleted_at is null;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.business_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index business_members_user_idx on public.business_members (user_id);

create trigger business_members_set_updated_at
  before update on public.business_members
  for each row execute function public.set_updated_at();
create trigger business_members_audit
  after insert or update or delete on public.business_members
  for each row execute function public.audit_row_change();

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email extensions.citext not null,
  role public.business_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index business_invitations_open_uidx
  on public.business_invitations (business_id, email)
  where accepted_at is null and revoked_at is null;

-- Membership helper ----------------------------------------------------------

create or replace function public.has_business_role(
  p_business_id uuid,
  p_min_role public.business_role default 'staff'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    join public.profiles p on p.id = m.user_id
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and m.accepted_at is not null
      and m.role >= p_min_role
      and p.is_suspended = false
  )
$$;

-- The creator of a business becomes its owner.
create or replace function public.add_business_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.business_members (business_id, user_id, role, accepted_at)
    values (new.id, new.created_by, 'owner', now())
    on conflict (business_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger businesses_add_owner
  after insert on public.businesses
  for each row execute function public.add_business_owner();

-- Owner/manager submits a draft or rejected business for review.
create or replace function public.submit_business_for_review(p_business_id uuid)
returns public.business_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.business_status;
begin
  if not public.has_business_role(p_business_id, 'manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select status into current_status
  from public.businesses
  where id = p_business_id and deleted_at is null
  for update;

  if current_status not in ('draft', 'rejected') then
    raise exception 'business cannot be submitted from status %', current_status using errcode = '22023';
  end if;

  update public.businesses
  set status = 'pending_review', submitted_at = now(), rejection_reason = null
  where id = p_business_id;

  perform public.write_audit_log('business.submitted', 'businesses', p_business_id::text, null, null);
  return 'pending_review';
end;
$$;

-- Moderators/admins change moderation state. Audited.
create or replace function public.admin_set_business_status(
  p_business_id uuid,
  p_status public.business_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
begin
  if not public.is_platform_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_status = 'rejected' and coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required when rejecting' using errcode = '22023';
  end if;

  select to_jsonb(b) into before_row from public.businesses b where id = p_business_id for update;
  if before_row is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  update public.businesses
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then p_reason else null end,
      approved_at = case when p_status = 'approved' then now() else approved_at end,
      approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
      suspended_at = case when p_status = 'suspended' then now() else null end
  where id = p_business_id;

  perform public.write_audit_log(
    'business.status_changed', 'businesses', p_business_id::text,
    jsonb_build_object('status', before_row ->> 'status'),
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );
end;
$$;

create or replace function public.admin_set_business_verified(p_business_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.businesses set is_verified = p_verified where id = p_business_id;

  perform public.write_audit_log(
    'business.verified_changed', 'businesses', p_business_id::text,
    null, jsonb_build_object('is_verified', p_verified)
  );
end;
$$;

-- Locations -------------------------------------------------------------------

create table public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  city_id uuid not null references public.cities (id),
  name text check (char_length(name) <= 120),
  address_line text not null check (char_length(address_line) between 3 and 200),
  postal_code text check (char_length(postal_code) <= 12),
  location extensions.geography(Point, 4326) not null,
  is_primary boolean not null default false,
  capacity smallint not null default 1 check (capacity between 1 and 50),
  is_24_7 boolean not null default false,
  hours_verified_at timestamptz,
  coverage_radius_km numeric(5, 1) check (coverage_radius_km > 0 and coverage_radius_km <= 500),
  vehicle_restrictions text check (char_length(vehicle_restrictions) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_locations_location_gix on public.business_locations using gist (location);
create index business_locations_business_idx on public.business_locations (business_id);
create index business_locations_city_idx on public.business_locations (city_id);
create unique index business_locations_one_primary_uidx
  on public.business_locations (business_id) where is_primary;

create trigger business_locations_set_updated_at
  before update on public.business_locations
  for each row execute function public.set_updated_at();

-- Roadside coverage: a whole city or a custom polygon.
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  business_location_id uuid not null references public.business_locations (id) on delete cascade,
  city_id uuid references public.cities (id) on delete cascade,
  area extensions.geography(MultiPolygon, 4326),
  label text check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  check ((city_id is not null) <> (area is not null))
);

create index service_areas_location_idx on public.service_areas (business_location_id);
create index service_areas_city_idx on public.service_areas (city_id) where city_id is not null;
create index service_areas_area_gix on public.service_areas using gist (area) where area is not null;

-- Opening hours: ISO weekday (1 = Monday … 7 = Sunday). Several intervals per
-- day are allowed (e.g. lunch break). Overnight opening is stored as two rows.
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_location_id uuid not null references public.business_locations (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  check (opens_at < closes_at),
  exclude using gist (
    business_location_id with =,
    weekday with =,
    tsrange('2000-01-01'::date + opens_at, '2000-01-01'::date + closes_at, '[)') with &&
  )
);

create index business_hours_location_idx on public.business_hours (business_location_id, weekday);

-- Additional categories beyond the primary one.
create table public.business_categories (
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (business_id, category_id)
);

-- What a business offers (optionally linked to a catalog service type).
create table public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 1000),
  price_from_cents integer check (price_from_cents >= 0),
  price_to_cents integer check (price_to_cents >= 0),
  currency char(3) not null default 'EUR',
  duration_minutes integer check (duration_minutes between 5 and 1440),
  is_bookable boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_to_cents is null or price_from_cents is null or price_to_cents >= price_from_cents),
  check (not is_bookable or duration_minutes is not null)
);

create index business_services_business_idx on public.business_services (business_id, sort_order)
  where deleted_at is null;
create index business_services_service_idx on public.business_services (service_id)
  where deleted_at is null and is_active;

create trigger business_services_set_updated_at
  before update on public.business_services
  for each row execute function public.set_updated_at();

create table public.business_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.media_kind not null default 'gallery',
  storage_path text not null unique,
  alt_text text check (char_length(alt_text) <= 200),
  width integer check (width > 0),
  height integer check (height > 0),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index business_media_business_idx on public.business_media (business_id, kind, sort_order)
  where deleted_at is null;
create unique index business_media_one_logo_uidx on public.business_media (business_id)
  where kind = 'logo' and deleted_at is null;

-- RLS: members --------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;
alter table public.business_locations enable row level security;
alter table public.service_areas enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_categories enable row level security;
alter table public.business_services enable row level security;
alter table public.business_media enable row level security;

-- businesses
create policy "businesses: members read" on public.businesses
  for select to authenticated using (public.has_business_role(id, 'staff'));
create policy "businesses: staff read all" on public.businesses
  for select to authenticated using (public.is_platform_staff());
-- RETURNING after insert needs the creator to see the row before the owner
-- membership trigger has run.
create policy "businesses: creator reads own" on public.businesses
  for select to authenticated using (created_by = auth.uid() and status = 'draft');
create policy "businesses: authenticated create draft" on public.businesses
  for insert to authenticated with check (created_by = auth.uid());
create policy "businesses: managers update" on public.businesses
  for update to authenticated
  using (public.has_business_role(id, 'manager') and deleted_at is null)
  with check (public.has_business_role(id, 'manager'));

-- Column privileges: moderation, verification, demo and ownership fields can
-- never be written directly by end users.
revoke insert, update, delete on public.businesses from anon, authenticated;
grant insert (slug, city_id, primary_category_id, name, description, phone, email, website, social_links)
  on public.businesses to authenticated;
grant update (
  primary_category_id, name, description, phone, email, website, social_links,
  booking_enabled, booking_auto_confirm, booking_slot_minutes, booking_buffer_minutes,
  booking_lead_hours, booking_horizon_days
) on public.businesses to authenticated;

-- business_members
create policy "members: read own business team" on public.business_members
  for select to authenticated
  using (user_id = auth.uid() or public.has_business_role(business_id, 'staff') or public.is_platform_staff());
create policy "members: owners add" on public.business_members
  for insert to authenticated
  with check (
    public.has_business_role(business_id, 'owner')
    or (public.has_business_role(business_id, 'manager') and role = 'staff')
  );
create policy "members: owners change others" on public.business_members
  for update to authenticated
  using (public.has_business_role(business_id, 'owner') and user_id <> auth.uid())
  with check (public.has_business_role(business_id, 'owner') and user_id <> auth.uid());
create policy "members: owners remove others, members leave" on public.business_members
  for delete to authenticated
  using (
    (public.has_business_role(business_id, 'owner') and user_id <> auth.uid())
    or (user_id = auth.uid() and role <> 'owner')
  );
revoke all on public.business_members from anon;
revoke update on public.business_members from authenticated;
grant update (role) on public.business_members to authenticated;

-- business_invitations
create policy "invitations: managers manage" on public.business_invitations
  for all to authenticated
  using (public.has_business_role(business_id, 'manager'))
  with check (
    public.has_business_role(business_id, 'owner')
    or (public.has_business_role(business_id, 'manager') and role = 'staff')
  );
revoke all on public.business_invitations from anon;

-- Location-scoped tables share one helper.
create or replace function public.location_business_id(p_location_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select business_id from public.business_locations where id = p_location_id
$$;

create policy "locations: members read" on public.business_locations
  for select to authenticated using (public.has_business_role(business_id, 'staff') or public.is_platform_staff());
create policy "locations: managers write" on public.business_locations
  for all to authenticated
  using (public.has_business_role(business_id, 'manager'))
  with check (public.has_business_role(business_id, 'manager'));

create policy "service_areas: members read" on public.service_areas
  for select to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'staff') or public.is_platform_staff());
create policy "service_areas: managers write" on public.service_areas
  for all to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'manager'))
  with check (public.has_business_role(public.location_business_id(business_location_id), 'manager'));

create policy "hours: members read" on public.business_hours
  for select to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'staff') or public.is_platform_staff());
create policy "hours: managers write" on public.business_hours
  for all to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'manager'))
  with check (public.has_business_role(public.location_business_id(business_location_id), 'manager'));

create policy "business_categories: members read" on public.business_categories
  for select to authenticated using (public.has_business_role(business_id, 'staff') or public.is_platform_staff());
create policy "business_categories: managers write" on public.business_categories
  for all to authenticated
  using (public.has_business_role(business_id, 'manager'))
  with check (public.has_business_role(business_id, 'manager'));

create policy "business_services: members read" on public.business_services
  for select to authenticated using (public.has_business_role(business_id, 'staff') or public.is_platform_staff());
create policy "business_services: managers write" on public.business_services
  for all to authenticated
  using (public.has_business_role(business_id, 'manager'))
  with check (public.has_business_role(business_id, 'manager'));

create policy "business_media: members read" on public.business_media
  for select to authenticated using (public.has_business_role(business_id, 'staff') or public.is_platform_staff());
create policy "business_media: managers write" on public.business_media
  for all to authenticated
  using (public.has_business_role(business_id, 'manager'))
  with check (public.has_business_role(business_id, 'manager'));

revoke insert, update, delete on
  public.business_locations, public.service_areas, public.business_hours,
  public.business_categories, public.business_services, public.business_media
from anon;

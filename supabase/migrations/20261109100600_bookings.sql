-- Bookings. Double bookings are impossible at the database level:
-- every active booking occupies one "bay" of a location for a time range, and
-- an exclusion constraint forbids overlapping ranges on the same bay.
-- Booking creation and status transitions go through SECURITY DEFINER
-- functions (added with the booking engine in Phase 5); there is no direct
-- insert path for end users.

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_location_id uuid not null references public.business_locations (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_minutes integer check (slot_minutes between 5 and 480),
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  exclude using gist (
    business_location_id with =,
    weekday with =,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time, '[)') with &&
  )
);

create index availability_rules_location_idx on public.availability_rules (business_location_id, weekday);

create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  business_location_id uuid not null references public.business_locations (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index blocked_periods_range_gix on public.blocked_periods
  using gist (business_location_id, tstzrange(starts_at, ends_at, '[)'));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  business_location_id uuid not null references public.business_locations (id) on delete restrict,
  bay_number smallint not null default 1 check (bay_number between 1 and 50),
  customer_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email extensions.citext not null check (char_length(customer_email) <= 254),
  customer_phone text not null check (char_length(customer_phone) between 5 and 32),
  vehicle jsonb check (vehicle is null or jsonb_typeof(vehicle) = 'object'),
  notes text check (char_length(notes) <= 1000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- starts_at .. occupied_until (ends_at + business buffer) is the blocked range.
  occupied_until timestamptz not null,
  status public.booking_status not null default 'pending',
  status_reason text check (char_length(status_reason) <= 500),
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at and ends_at <= occupied_until),
  constraint bookings_no_overlap exclude using gist (
    business_location_id with =,
    bay_number with =,
    tstzrange(starts_at, occupied_until, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index bookings_business_starts_idx on public.bookings (business_id, starts_at);
create index bookings_customer_idx on public.bookings (customer_id, starts_at desc) where customer_id is not null;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.booking_services (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  business_service_id uuid references public.business_services (id) on delete set null,
  name_snapshot text not null,
  price_from_cents_snapshot integer,
  duration_minutes_snapshot integer,
  primary key (booking_id, name_snapshot)
);

-- RLS --------------------------------------------------------------------------

alter table public.availability_rules enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_services enable row level security;

create policy "availability_rules: public read visible" on public.availability_rules
  for select to anon, authenticated
  using (public.is_publicly_visible(public.location_business_id(business_location_id)));
create policy "availability_rules: members read" on public.availability_rules
  for select to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'staff'));
create policy "availability_rules: managers write" on public.availability_rules
  for all to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'manager'))
  with check (public.has_business_role(public.location_business_id(business_location_id), 'manager'));

-- Blocked periods are private (they may reveal staff absences).
create policy "blocked_periods: members read" on public.blocked_periods
  for select to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'staff'));
create policy "blocked_periods: managers write" on public.blocked_periods
  for all to authenticated
  using (public.has_business_role(public.location_business_id(business_location_id), 'manager'))
  with check (public.has_business_role(public.location_business_id(business_location_id), 'manager'));

create policy "bookings: customer reads own" on public.bookings
  for select to authenticated using (customer_id = auth.uid());
create policy "bookings: members read" on public.bookings
  for select to authenticated using (public.has_business_role(business_id, 'staff'));
create policy "bookings: platform staff read" on public.bookings
  for select to authenticated using (public.is_platform_staff());

create policy "booking_services: visible with booking" on public.booking_services
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.customer_id = auth.uid() or public.has_business_role(b.business_id, 'staff'))
  ));

revoke all on public.bookings, public.booking_services, public.blocked_periods from anon;
revoke insert, update, delete on public.bookings, public.booking_services from authenticated;
revoke insert, update, delete on public.availability_rules from anon;

-- Geography (countries, cities) and the service catalog (categories, service types).
-- Cities and categories are data: admins add them without code changes.

create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  name_en text not null,
  default_timezone text not null,
  created_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries (code),
  name text not null check (char_length(name) between 2 and 80),
  name_en text not null check (char_length(name_en) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  center extensions.geography(Point, 4326) not null,
  default_radius_km integer not null default 25 check (default_radius_km between 1 and 300),
  timezone text not null default 'Europe/Sofia',
  is_active boolean not null default false,
  launch_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cities_center_gix on public.cities using gist (center);
create index cities_active_idx on public.cities (is_active, launch_order);

create trigger cities_set_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();
create trigger cities_audit
  after insert or update or delete on public.cities
  for each row execute function public.audit_row_change();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind public.category_kind not null default 'business',
  name text not null,
  name_en text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();
create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();

-- Service *types* (catalog). What a business actually offers is business_services.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  name_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create index services_category_idx on public.services (category_id, sort_order);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();
create trigger services_audit
  after insert or update or delete on public.services
  for each row execute function public.audit_row_change();

-- RLS ---------------------------------------------------------------------------

alter table public.countries enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;

create policy "countries: public read" on public.countries
  for select to anon, authenticated using (true);
create policy "countries: admins manage" on public.countries
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "cities: public read active" on public.cities
  for select to anon, authenticated using (is_active or public.is_platform_staff());
create policy "cities: admins manage" on public.cities
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active or public.is_platform_staff());
create policy "categories: admins manage" on public.categories
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "services: public read active" on public.services
  for select to anon, authenticated using (is_active or public.is_platform_staff());
create policy "services: admins manage" on public.services
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

revoke insert, update, delete on public.countries, public.cities, public.categories, public.services from anon;

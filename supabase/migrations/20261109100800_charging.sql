-- EV charging stations imported from external providers (initially Open
-- Charge Map). Rows are written only by the service-role import job. The
-- provider is identified per row so more Bulgarian operators can be added.

create table public.charging_data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  website text,
  license text not null,
  attribution text not null,
  is_active boolean not null default true,
  last_import_at timestamptz,
  last_import_status text check (last_import_status in ('success', 'partial', 'failed')),
  last_import_message text,
  last_import_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger charging_data_sources_set_updated_at
  before update on public.charging_data_sources
  for each row execute function public.set_updated_at();

create table public.charging_stations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.charging_data_sources (id) on delete restrict,
  external_id text not null,
  name text not null,
  operator text,
  address text,
  town text,
  city_id uuid references public.cities (id) on delete set null,
  location extensions.geography(Point, 4326) not null,
  usage_type text,
  is_public boolean,
  opening_hours text,
  pricing_text text,
  num_points integer check (num_points >= 0),
  max_power_kw numeric(6, 1) check (max_power_kw >= 0),
  has_ac boolean not null default false,
  has_dc boolean not null default false,
  status_text text,
  source_url text,
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  raw jsonb,
  duplicate_of uuid references public.charging_stations (id) on delete set null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index charging_stations_location_gix on public.charging_stations using gist (location);
create index charging_stations_city_idx on public.charging_stations (city_id) where not is_hidden;
create index charging_stations_power_idx on public.charging_stations (max_power_kw) where not is_hidden;

create trigger charging_stations_set_updated_at
  before update on public.charging_stations
  for each row execute function public.set_updated_at();

create table public.charging_connectors (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.charging_stations (id) on delete cascade,
  connector_type text not null check (connector_type in (
    'ccs2', 'ccs1', 'type2', 'type1', 'chademo', 'tesla', 'schuko', 'other'
  )),
  connector_label text,
  current_type public.current_type,
  power_kw numeric(6, 1) check (power_kw >= 0),
  quantity integer not null default 1 check (quantity >= 0)
);

create index charging_connectors_station_idx on public.charging_connectors (station_id);
create index charging_connectors_type_idx on public.charging_connectors (connector_type);

alter table public.charging_data_sources enable row level security;
alter table public.charging_stations enable row level security;
alter table public.charging_connectors enable row level security;

create policy "charging_sources: public read" on public.charging_data_sources
  for select to anon, authenticated using (true);

create policy "charging_stations: public read" on public.charging_stations
  for select to anon, authenticated using (not is_hidden and duplicate_of is null);
create policy "charging_stations: staff read all" on public.charging_stations
  for select to authenticated using (public.is_platform_staff());
create policy "charging_stations: staff moderate" on public.charging_stations
  for update to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "charging_connectors: public read" on public.charging_connectors
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.charging_data_sources, public.charging_stations, public.charging_connectors
  from anon, authenticated;
grant update (is_hidden, duplicate_of) on public.charging_stations to authenticated;

create trigger charging_stations_audit
  after update of is_hidden, duplicate_of on public.charging_stations
  for each row execute function public.audit_row_change();

-- Phase 5: EV charging import and public lookup.
--
-- The import job (/api/cron/charging-import) normalises provider data in the
-- app and hands one batch per source to charging_import(), which only the
-- service role may call. Pages read through charging_stations_search(), which
-- runs as the caller so the public-read RLS policies apply.

create or replace function public.charging_import(
  p_source_code text,
  p_stations jsonb,
  p_complete boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_source public.charging_data_sources%rowtype;
  v_seen text[];
  v_existing integer;
  v_upserted integer := 0;
  v_removed integer := 0;
  v_item jsonb;
  v_station_id uuid;
  v_point extensions.geography;
begin
  select * into v_source from public.charging_data_sources where code = p_source_code and is_active;
  if not found then
    raise exception 'unknown or inactive source %', p_source_code using errcode = '22023';
  end if;
  if jsonb_typeof(p_stations) <> 'array' then
    raise exception 'stations must be an array' using errcode = '22023';
  end if;

  select count(*) into v_existing from public.charging_stations where source_id = v_source.id;

  for v_item in select value from jsonb_array_elements(p_stations) loop
    -- Skip rows without an id or with impossible coordinates.
    if coalesce(v_item ->> 'external_id', '') = ''
       or (v_item ->> 'lat') is null or (v_item ->> 'lng') is null
       or (v_item ->> 'lat')::double precision not between -90 and 90
       or (v_item ->> 'lng')::double precision not between -180 and 180 then
      continue;
    end if;

    v_point := extensions.st_setsrid(extensions.st_makepoint(
      (v_item ->> 'lng')::double precision, (v_item ->> 'lat')::double precision), 4326)::extensions.geography;

    insert into public.charging_stations as s (
      source_id, external_id, name, operator, address, town, city_id, location,
      usage_type, is_public, opening_hours, pricing_text, num_points,
      max_power_kw, has_ac, has_dc, status_text, source_url, source_updated_at, imported_at
    )
    select
      v_source.id,
      v_item ->> 'external_id',
      left(coalesce(nullif(trim(v_item ->> 'name'), ''), 'Зарядна станция'), 200),
      left(nullif(trim(v_item ->> 'operator'), ''), 200),
      left(nullif(trim(v_item ->> 'address'), ''), 300),
      left(nullif(trim(v_item ->> 'town'), ''), 120),
      (select c.id from public.cities c
       where extensions.st_dwithin(c.center, v_point, c.default_radius_km * 1000)
       order by extensions.st_distance(c.center, v_point) limit 1),
      v_point,
      left(nullif(trim(v_item ->> 'usage_type'), ''), 120),
      (v_item ->> 'is_public')::boolean,
      left(nullif(trim(v_item ->> 'opening_hours'), ''), 300),
      left(nullif(trim(v_item ->> 'pricing_text'), ''), 300),
      greatest((v_item ->> 'num_points')::integer, 0),
      (select max((c ->> 'power_kw')::numeric) from jsonb_array_elements(v_item -> 'connectors') c
       where (c ->> 'power_kw')::numeric between 0 and 9999),
      coalesce((select bool_or(c ->> 'current' = 'AC') from jsonb_array_elements(v_item -> 'connectors') c), false),
      coalesce((select bool_or(c ->> 'current' = 'DC') from jsonb_array_elements(v_item -> 'connectors') c), false),
      left(nullif(trim(v_item ->> 'status_text'), ''), 120),
      left(nullif(trim(v_item ->> 'source_url'), ''), 300),
      (v_item ->> 'source_updated_at')::timestamptz,
      now()
    on conflict (source_id, external_id) do update
    set name = excluded.name,
        operator = excluded.operator,
        address = excluded.address,
        town = excluded.town,
        city_id = excluded.city_id,
        location = excluded.location,
        usage_type = excluded.usage_type,
        is_public = excluded.is_public,
        opening_hours = excluded.opening_hours,
        pricing_text = excluded.pricing_text,
        num_points = excluded.num_points,
        max_power_kw = excluded.max_power_kw,
        has_ac = excluded.has_ac,
        has_dc = excluded.has_dc,
        status_text = excluded.status_text,
        source_url = excluded.source_url,
        source_updated_at = excluded.source_updated_at,
        imported_at = excluded.imported_at
    returning s.id into v_station_id;

    delete from public.charging_connectors where station_id = v_station_id;
    insert into public.charging_connectors (station_id, connector_type, connector_label, current_type, power_kw, quantity)
    select
      v_station_id,
      case when c ->> 'type' in ('ccs2', 'ccs1', 'type2', 'type1', 'chademo', 'tesla', 'schuko')
           then c ->> 'type' else 'other' end,
      left(nullif(trim(c ->> 'label'), ''), 120),
      case when c ->> 'current' in ('AC', 'DC') then (c ->> 'current')::public.current_type end,
      case when (c ->> 'power_kw')::numeric between 0 and 9999 then (c ->> 'power_kw')::numeric end,
      greatest(coalesce((c ->> 'quantity')::integer, 1), 0)
    from jsonb_array_elements(coalesce(v_item -> 'connectors', '[]'::jsonb)) c;

    v_seen := array_append(v_seen, v_item ->> 'external_id');
    v_upserted := v_upserted + 1;
  end loop;

  -- A complete batch replaces the source: stations the provider no longer
  -- lists are removed. Guard against truncated provider responses.
  if p_complete and v_upserted > 0 and v_upserted * 2 >= v_existing then
    delete from public.charging_stations
    where source_id = v_source.id and not (external_id = any (v_seen));
    get diagnostics v_removed = row_count;
  end if;

  update public.charging_data_sources
  set last_import_at = now(),
      last_import_status = case when p_complete and v_upserted * 2 < v_existing then 'partial' else 'success' end,
      last_import_message = format('%s imported, %s removed', v_upserted, v_removed),
      last_import_count = v_upserted
  where id = v_source.id;

  return jsonb_build_object('imported', v_upserted, 'removed', v_removed);
end;
$$;

-- Records a failed run so the page and admins can see stale data.
create or replace function public.charging_import_failed(p_source_code text, p_message text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.charging_data_sources
  set last_import_status = 'failed',
      last_import_message = left(p_message, 500)
  where code = p_source_code
$$;

create or replace function public.charging_stations_search(
  p_lat double precision default null,
  p_lng double precision default null,
  p_city_slug text default null,
  p_radius_km integer default 25,
  p_connector text default null,
  p_min_power_kw numeric default null,
  p_dc_only boolean default false,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_origin extensions.geography;
  v_radius integer := least(greatest(coalesce(p_radius_km, 25), 1), 300);
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 300);
  v_result jsonb;
begin
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;
  if p_connector is not null
     and p_connector not in ('ccs2', 'ccs1', 'type2', 'type1', 'chademo', 'tesla', 'schuko', 'other') then
    raise exception 'unknown connector' using errcode = '22023';
  end if;

  if p_lat is not null then
    v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  elsif p_city_slug is not null then
    select c.center, coalesce(p_radius_km, c.default_radius_km) into v_origin, v_radius
    from public.cities c where c.slug = p_city_slug;
    if v_origin is null then
      raise exception 'unknown city' using errcode = '22023';
    end if;
  end if;

  with matches as (
    select
      s.*,
      case when v_origin is null then null
           else extensions.st_distance(s.location, v_origin) / 1000.0 end as distance_km
    from public.charging_stations s
    where (v_origin is null or extensions.st_dwithin(s.location, v_origin, v_radius * 1000))
      and (p_min_power_kw is null or s.max_power_kw >= p_min_power_kw)
      and (not coalesce(p_dc_only, false) or s.has_dc)
      and (p_connector is null or exists (
        select 1 from public.charging_connectors c
        where c.station_id = s.id and c.connector_type = p_connector))
  ),
  ordered as (
    select m.*,
      count(*) over () as total_count,
      row_number() over (order by m.distance_km asc nulls last, m.max_power_kw desc nulls last, m.name) as position
    from matches m
  )
  select jsonb_build_object(
    'total', coalesce(max(total_count), 0),
    'radius_km', case when v_origin is null then null else v_radius end,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'operator', o.operator,
      'address', o.address,
      'town', o.town,
      'lat', extensions.st_y(o.location::extensions.geometry),
      'lng', extensions.st_x(o.location::extensions.geometry),
      'distance_km', round(o.distance_km::numeric, 1),
      'usage_type', o.usage_type,
      'opening_hours', o.opening_hours,
      'pricing_text', o.pricing_text,
      'num_points', o.num_points,
      'max_power_kw', o.max_power_kw,
      'has_ac', o.has_ac,
      'has_dc', o.has_dc,
      'status_text', o.status_text,
      'source_url', o.source_url,
      'source_updated_at', o.source_updated_at,
      'connectors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'type', c.connector_type, 'label', c.connector_label,
          'current', c.current_type, 'power_kw', c.power_kw, 'quantity', c.quantity
        ) order by c.power_kw desc nulls last)
        from public.charging_connectors c where c.station_id = o.id
      ), '[]'::jsonb)
    ) order by o.position) filter (where o.position <= v_limit), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', d.name, 'website', d.website, 'attribution', d.attribution,
        'license', d.license, 'last_import_at', d.last_import_at,
        'last_import_status', d.last_import_status
      ) order by d.name)
      from public.charging_data_sources d where d.is_active
    ), '[]'::jsonb)
  )
  into v_result
  from ordered o;

  return v_result;
end;
$$;

revoke execute on function
  public.charging_import(text, jsonb, boolean),
  public.charging_import_failed(text, text),
  public.charging_stations_search(double precision, double precision, text, integer, text, numeric, boolean, integer)
from public, anon, authenticated;

grant execute on function
  public.charging_import(text, jsonb, boolean),
  public.charging_import_failed(text, text)
to service_role;

grant execute on function
  public.charging_stations_search(double precision, double precision, text, integer, text, numeric, boolean, integer)
to anon, authenticated;

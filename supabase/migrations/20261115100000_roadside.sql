-- Phase 5: roadside assistance lookup and coverage management.
--
-- A roadside provider covers a point when any of its locations
--   * has a coverage radius that reaches the point, or
--   * lists a whole city (service_areas.city_id) whose default radius around
--     the city centre reaches the point, or
--   * lists a custom polygon (service_areas.area) that contains the point.
-- The customer's coordinates are only used for this query: nothing is stored.

create or replace function public.roadside_providers_for_point(
  p_lat double precision,
  p_lng double precision,
  p_service_slug text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_point extensions.geography;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_result jsonb;
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;
  if p_service_slug is not null and not exists (
    select 1 from public.services s
    join public.categories c on c.id = s.category_id
    where s.slug = p_service_slug and c.kind = 'roadside' and s.is_active
  ) then
    raise exception 'unknown roadside service' using errcode = '22023';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  -- RLS on businesses / locations / service_areas limits rows to publicly
  -- visible businesses for anonymous visitors.
  with providers as (
    select b.*
    from public.businesses b
    where b.deleted_at is null
      and b.status = 'approved'
      and (
        exists (select 1 from public.categories c
                where c.id = b.primary_category_id and c.kind = 'roadside')
        or exists (select 1 from public.business_categories bc
                   join public.categories c on c.id = bc.category_id
                   where bc.business_id = b.id and c.kind = 'roadside')
      )
      and (p_service_slug is null or exists (
        select 1 from public.business_services bs
        join public.services s on s.id = bs.service_id
        where bs.business_id = b.id and bs.is_active and bs.deleted_at is null
          and s.slug = p_service_slug))
  ),
  covering as (
    select
      p.id as business_id,
      l.id as location_id,
      l.is_24_7,
      l.coverage_radius_km,
      extensions.st_distance(l.location, v_point) / 1000.0 as distance_km,
      case
        when exists (select 1 from public.service_areas a
                     where a.business_location_id = l.id and a.area is not null
                       and extensions.st_covers(a.area, v_point)) then 'area'
        when l.coverage_radius_km is not null
             and extensions.st_dwithin(l.location, v_point, l.coverage_radius_km * 1000) then 'radius'
        when exists (select 1 from public.service_areas a
                     join public.cities c on c.id = a.city_id
                     where a.business_location_id = l.id
                       and extensions.st_dwithin(c.center, v_point, c.default_radius_km * 1000)) then 'city'
      end as coverage
    from providers p
    join public.business_locations l on l.business_id = p.id
  ),
  best as (
    select distinct on (business_id) *
    from covering
    where coverage is not null
    order by business_id, distance_km
  ),
  enriched as (
    select
      b.*,
      cat.slug as category_slug,
      cty.slug as city_slug,
      cty.name as city_name,
      x.location_id,
      x.is_24_7,
      x.coverage,
      x.coverage_radius_km,
      x.distance_km,
      public.location_open_now(x.location_id) as open_now
    from best x
    join providers b on b.id = x.business_id
    join public.categories cat on cat.id = b.primary_category_id
    join public.cities cty on cty.id = b.city_id
  ),
  ordered as (
    select e.*,
      count(*) over () as total_count,
      row_number() over (
        order by (e.is_24_7 or coalesce(e.open_now, false)) desc,
                 e.distance_km asc,
                 e.name asc
      ) as position
    from enriched e
  )
  select jsonb_build_object(
    'total', coalesce(max(total_count), 0),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'slug', o.slug,
      'city_slug', o.city_slug,
      'city_name', o.city_name,
      'name', o.name,
      'phone', o.phone,
      'is_24_7', o.is_24_7,
      'open_now', o.open_now,
      'distance_km', round(o.distance_km::numeric, 1),
      'coverage', o.coverage,
      'coverage_radius_km', o.coverage_radius_km,
      'is_verified', o.is_verified,
      'is_demo', o.is_demo,
      'services', coalesce((
        select jsonb_agg(s.name order by s.sort_order)
        from public.business_services bs
        join public.services s on s.id = bs.service_id
        join public.categories c on c.id = s.category_id and c.kind = 'roadside'
        where bs.business_id = o.id and bs.is_active and bs.deleted_at is null
      ), '[]'::jsonb),
      'logo_path', (select m.storage_path from public.business_media m
                    where m.business_id = o.id and m.kind = 'logo' and m.deleted_at is null limit 1)
    ) order by o.position) filter (where o.position <= v_limit), '[]'::jsonb)
  )
  into v_result
  from ordered o;

  return v_result;
end;
$$;

comment on function public.roadside_providers_for_point(double precision, double precision, text, integer) is
  'Roadside providers whose radius, city or polygon coverage contains the point. Coordinates are not stored.';

-- Cities a location covers as whole-city service areas (dashboard).
create or replace function public.location_coverage_cities(p_location_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(c.slug order by c.name), '[]'::jsonb)
  from public.service_areas a
  join public.cities c on c.id = a.city_id
  where a.business_location_id = p_location_id
$$;

-- Replaces the whole-city coverage of a location. Custom polygons are kept.
-- SECURITY INVOKER: the "service_areas: managers write" policy applies.
create or replace function public.set_location_coverage_cities(p_location_id uuid, p_city_slugs text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if not public.has_business_role(public.location_business_id(p_location_id), 'manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_city_slugs), 0) > 20 then
    raise exception 'too many coverage cities' using errcode = '22023', hint = 'too_many_coverage_cities';
  end if;

  select coalesce(array_agg(c.id), '{}') into v_ids
  from public.cities c
  where c.is_active and c.slug = any (coalesce(p_city_slugs, '{}'));
  if cardinality(v_ids) <> cardinality(array(select distinct unnest(coalesce(p_city_slugs, '{}')))) then
    raise exception 'unknown city' using errcode = '22023', hint = 'invalid_coverage_city';
  end if;

  delete from public.service_areas a
  where a.business_location_id = p_location_id
    and a.city_id is not null
    and not (a.city_id = any (v_ids));

  insert into public.service_areas (business_location_id, city_id, label)
  select p_location_id, c.id, c.name
  from public.cities c
  where c.id = any (v_ids)
    and not exists (select 1 from public.service_areas a
                    where a.business_location_id = p_location_id and a.city_id = c.id);
end;
$$;

revoke execute on function
  public.roadside_providers_for_point(double precision, double precision, text, integer),
  public.location_coverage_cities(uuid),
  public.set_location_coverage_cities(uuid, text[])
from public, anon, authenticated;

grant execute on function
  public.roadside_providers_for_point(double precision, double precision, text, integer)
to anon, authenticated;

grant execute on function
  public.location_coverage_cities(uuid),
  public.set_location_coverage_cities(uuid, text[])
to authenticated;

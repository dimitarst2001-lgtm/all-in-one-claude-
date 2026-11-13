-- Public marketplace read API (Phase 3).
--
-- The public site reads through a small set of SQL functions called via RPC.
-- They run as the caller (SECURITY INVOKER), so Row Level Security still
-- decides which businesses are visible; the functions only shape the data
-- and do geography/filtering in one round trip.

create extension if not exists pg_trgm with schema extensions;

create index businesses_name_trgm_idx on public.businesses
  using gin (name extensions.gin_trgm_ops) where deleted_at is null;

-- "Open now" is only answered when it is reliable: 24/7 locations, or
-- locations whose hours were confirmed by the business (hours_verified_at).
-- Returns NULL when unknown so the UI can stay silent instead of guessing.
create or replace function public.location_open_now(p_location_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = public, extensions
as $$
  select case
    when l.is_24_7 then true
    when l.hours_verified_at is null then null
    when not exists (select 1 from public.business_hours h where h.business_location_id = l.id) then null
    else exists (
      select 1
      from public.business_hours h
      where h.business_location_id = l.id
        and h.weekday = extract(isodow from (p_at at time zone c.timezone))::smallint
        and (p_at at time zone c.timezone)::time >= h.opens_at
        and (p_at at time zone c.timezone)::time < h.closes_at
    )
  end
  from public.business_locations l
  join public.cities c on c.id = l.city_id
  where l.id = p_location_id
$$;

-- Active cities with the number of visible businesses per category. Used for
-- city selectors and to avoid publishing empty SEO landing pages.
create or replace function public.public_cities()
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x.launch_order nulls last, x.name), '[]'::jsonb)
  from (
    select
      c.slug,
      c.name,
      c.name_en,
      c.launch_order,
      c.default_radius_km,
      extensions.st_y(c.center::extensions.geometry) as lat,
      extensions.st_x(c.center::extensions.geometry) as lng,
      coalesce((
        select jsonb_object_agg(cat_slug, n)
        from (
          select cat.slug as cat_slug, count(distinct b.id) as n
          from public.businesses b
          join public.categories cat on cat.id = b.primary_category_id
          where b.city_id = c.id
          group by cat.slug
        ) counts
      ), '{}'::jsonb) as category_counts
    from public.cities c
    where c.is_active
  ) x
$$;

create or replace function public.public_categories()
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x.sort_order), '[]'::jsonb)
  from (
    select
      cat.slug, cat.kind, cat.name, cat.name_en, cat.description, cat.icon, cat.sort_order,
      coalesce((
        select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name, 'name_en', s.name_en) order by s.sort_order)
        from public.services s
        where s.category_id = cat.id and s.is_active
      ), '[]'::jsonb) as services
    from public.categories cat
    where cat.is_active
  ) x
$$;

-- Escapes LIKE wildcards in user input.
create or replace function public.escape_like(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(value, '\', '\\'), '%', '\%'), '_', '\_')
$$;

create or replace function public.search_businesses(
  p_city_slug text default null,
  p_category_slug text default null,
  p_service_slug text default null,
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default null,
  p_open_now boolean default false,
  p_booking_only boolean default false,
  p_sort text default 'recommended',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_city public.cities%rowtype;
  v_origin extensions.geography;
  v_origin_kind text;
  v_query text := nullif(trim(left(coalesce(p_query, ''), 80)), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 5000);
  v_sort text := case when p_sort in ('recommended', 'distance', 'rating') then p_sort else 'recommended' end;
  v_result jsonb;
begin
  if p_radius_km is not null and p_radius_km not in (5, 10, 25, 50, 100) then
    raise exception 'unsupported radius' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;

  if p_city_slug is not null then
    select * into v_city from public.cities where slug = p_city_slug and is_active;
    if not found then
      return jsonb_build_object('total', 0, 'items', '[]'::jsonb, 'origin', null);
    end if;
  end if;

  if p_lat is not null then
    v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
    v_origin_kind := 'user';
  elsif v_city.id is not null then
    v_origin := v_city.center;
    v_origin_kind := 'city_center';
  end if;

  with candidates as (
    select
      b.*,
      cat.slug as category_slug,
      cat.name as category_name,
      cty.slug as city_slug,
      cty.name as city_name,
      loc.id as location_id,
      loc.address_line,
      loc.location,
      loc.is_24_7,
      case when v_origin is null then null
           else extensions.st_distance(loc.location, v_origin) / 1000.0 end as distance_km,
      public.business_has_feature(b.id, 'priority_placement') as has_priority
    from public.businesses b
    join public.categories cat on cat.id = b.primary_category_id
    join public.cities cty on cty.id = b.city_id
    -- For multi-location businesses use the location closest to the origin.
    join lateral (
      select l.*
      from public.business_locations l
      where l.business_id = b.id
      order by
        case when v_origin is null then 0 else extensions.st_distance(l.location, v_origin) end,
        l.is_primary desc
      limit 1
    ) loc on true
    where b.deleted_at is null
      and b.status = 'approved'
      and (p_category_slug is null
           or cat.slug = p_category_slug
           or exists (
             select 1 from public.business_categories bc
             join public.categories c2 on c2.id = bc.category_id
             where bc.business_id = b.id and c2.slug = p_category_slug))
      and (p_service_slug is null or exists (
             select 1 from public.business_services bs
             join public.services s on s.id = bs.service_id
             where bs.business_id = b.id and bs.is_active and bs.deleted_at is null and s.slug = p_service_slug))
      and (v_query is null
           or b.name ilike '%' || public.escape_like(v_query) || '%'
           or b.description ilike '%' || public.escape_like(v_query) || '%'
           or extensions.word_similarity(v_query, b.name) > 0.45)
      and (not p_booking_only or b.booking_enabled)
      and (
        -- With a radius, distance decides (neighbouring towns included).
        (p_radius_km is not null and v_origin is not null
           and extensions.st_dwithin(loc.location, v_origin, p_radius_km * 1000))
        -- Without a radius, the city decides.
        or (p_radius_km is null and (v_city.id is null or b.city_id = v_city.id
             or exists (select 1 from public.business_locations l2 where l2.business_id = b.id and l2.city_id = v_city.id)))
      )
  ),
  enriched as (
    select
      c.*,
      public.location_open_now(c.location_id) as open_now,
      r.rating_avg,
      coalesce(r.rating_count, 0) as rating_count
    from candidates c
    left join lateral (
      select round(avg(rv.rating)::numeric, 1) as rating_avg, count(*) as rating_count
      from public.reviews rv
      where rv.business_id = c.id and rv.status = 'published' and rv.deleted_at is null
    ) r on true
  ),
  filtered as (
    select * from enriched where not p_open_now or open_now is true
  ),
  ordered as (
    select
      f.*,
      count(*) over () as total_count,
      row_number() over (
        order by
          case when v_sort = 'rating' then f.rating_avg end desc nulls last,
          case when v_sort = 'recommended' then f.has_priority end desc,
          case when v_sort = 'recommended' then f.is_verified end desc,
          f.distance_km asc nulls last,
          f.name asc
      ) as position
    from filtered f
  )
  select jsonb_build_object(
    'total', coalesce(max(total_count), 0),
    'origin', v_origin_kind,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'slug', o.slug,
      'city_slug', o.city_slug,
      'city_name', o.city_name,
      'name', o.name,
      'description', left(o.description, 220),
      'category_slug', o.category_slug,
      'category_name', o.category_name,
      'phone', o.phone,
      'address', o.address_line,
      'lat', extensions.st_y(o.location::extensions.geometry),
      'lng', extensions.st_x(o.location::extensions.geometry),
      'distance_km', round(o.distance_km::numeric, 1),
      'open_now', o.open_now,
      'is_24_7', o.is_24_7,
      'booking_enabled', o.booking_enabled,
      'is_verified', o.is_verified,
      'is_demo', o.is_demo,
      'is_featured', o.has_priority,
      'rating_avg', o.rating_avg,
      'rating_count', o.rating_count,
      'logo_path', (select m.storage_path from public.business_media m
                    where m.business_id = o.id and m.kind = 'logo' and m.deleted_at is null limit 1)
    ) order by o.position) filter (where o.position > v_offset and o.position <= v_offset + v_limit), '[]'::jsonb)
  )
  into v_result
  from ordered o;

  return v_result;
end;
$$;

create or replace function public.get_business_profile(p_city_slug text, p_slug text)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', b.id,
    'slug', b.slug,
    'name', b.name,
    'description', b.description,
    'phone', b.phone,
    'email', b.email,
    'website', b.website,
    'social_links', b.social_links,
    'is_verified', b.is_verified,
    'is_demo', b.is_demo,
    'booking_enabled', b.booking_enabled,
    'enhanced_profile', public.business_has_feature(b.id, 'enhanced_profile'),
    'updated_at', b.updated_at,
    'city', jsonb_build_object('slug', cty.slug, 'name', cty.name),
    'category', jsonb_build_object('slug', cat.slug, 'name', cat.name, 'kind', cat.kind),
    'rating', (
      select jsonb_build_object('avg', round(avg(rv.rating)::numeric, 1), 'count', count(*))
      from public.reviews rv
      where rv.business_id = b.id and rv.status = 'published' and rv.deleted_at is null
      having count(*) > 0
    ),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'address', l.address_line,
        'postal_code', l.postal_code,
        'city_name', lc.name,
        'lat', extensions.st_y(l.location::extensions.geometry),
        'lng', extensions.st_x(l.location::extensions.geometry),
        'is_primary', l.is_primary,
        'is_24_7', l.is_24_7,
        'hours_verified', l.hours_verified_at is not null,
        'open_now', public.location_open_now(l.id),
        'coverage_radius_km', l.coverage_radius_km,
        'vehicle_restrictions', l.vehicle_restrictions,
        'service_areas', coalesce((
          select jsonb_agg(coalesce(sa.label, sac.name) order by coalesce(sa.label, sac.name))
          from public.service_areas sa
          left join public.cities sac on sac.id = sa.city_id
          where sa.business_location_id = l.id
        ), '[]'::jsonb),
        'hours', coalesce((
          select jsonb_agg(jsonb_build_object(
            'weekday', h.weekday,
            'opens_at', to_char(h.opens_at, 'HH24:MI'),
            'closes_at', to_char(h.closes_at, 'HH24:MI')
          ) order by h.weekday, h.opens_at)
          from public.business_hours h
          where h.business_location_id = l.id
        ), '[]'::jsonb)
      ) order by l.is_primary desc, l.created_at)
      from public.business_locations l
      join public.cities lc on lc.id = l.city_id
      where l.business_id = b.id
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bs.id,
        'name', bs.name,
        'description', bs.description,
        'price_from_cents', bs.price_from_cents,
        'price_to_cents', bs.price_to_cents,
        'currency', bs.currency,
        'duration_minutes', bs.duration_minutes,
        'is_bookable', bs.is_bookable
      ) order by bs.sort_order, bs.name)
      from public.business_services bs
      where bs.business_id = b.id and bs.is_active and bs.deleted_at is null
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', m.kind, 'path', m.storage_path, 'alt', m.alt_text, 'width', m.width, 'height', m.height
      ) order by m.kind, m.sort_order)
      from public.business_media m
      where m.business_id = b.id and m.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.businesses b
  join public.cities cty on cty.id = b.city_id
  join public.categories cat on cat.id = b.primary_category_id
  where cty.slug = p_city_slug and b.slug = p_slug and b.deleted_at is null
$$;

-- Lightweight list for sitemaps and static params.
create or replace function public.public_business_paths(p_limit integer default 5000)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object('city', c.slug, 'slug', b.slug, 'updated_at', b.updated_at, 'is_demo', b.is_demo)), '[]'::jsonb)
  from (
    select b.* from public.businesses b
    where b.deleted_at is null and b.status = 'approved'
    order by b.updated_at desc
    limit least(greatest(p_limit, 1), 50000)
  ) b
  join public.cities c on c.id = b.city_id
$$;

grant execute on function
  public.public_cities(),
  public.public_categories(),
  public.search_businesses(text, text, text, text, double precision, double precision, integer, boolean, boolean, text, integer, integer),
  public.get_business_profile(text, text),
  public.public_business_paths(integer),
  public.location_open_now(uuid, timestamptz)
to anon, authenticated;

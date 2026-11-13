-- Business dashboard: onboarding, location and hours editing, draft-period
-- limits and the remaining plan limits (locations, team members).
--
-- Dashboard functions are SECURITY INVOKER: they run as the signed-in user, so
-- every read and write still goes through Row Level Security. They exist to
-- make multi-row changes atomic and to return geography as plain lat/lng.

-- Draft-period limits ------------------------------------------------------------
-- Before a business has a subscription it may prepare its profile within the
-- limits of the entry plan (lowest sort order). This does not make it public:
-- is_publicly_visible() still requires a live subscription, and on/off
-- features such as online_booking still require a real plan.
create or replace function public.business_feature_limit(p_business_id uuid, p_feature text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with plan as (
    select coalesce(
      public.business_active_plan_id(p_business_id),
      (select sp.id from public.subscription_plans sp
       where sp.is_active order by sp.sort_order, sp.price_cents limit 1)
    ) as id
  )
  select case
    when pf.id is null or not pf.enabled then 0
    else pf.limit_value
  end
  from plan
  left join public.plan_features pf
    on pf.plan_id = plan.id
   and pf.feature_key = p_feature
$$;

-- Abuse guard: one account may create at most 5 businesses.
create or replace function public.enforce_business_creation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and (
    select count(*) from public.businesses
    where created_by = auth.uid() and deleted_at is null
  ) >= 5 then
    raise exception 'business creation limit reached' using errcode = 'P0001', hint = 'too_many_businesses';
  end if;
  return new;
end;
$$;

create trigger businesses_enforce_creation_limit
  before insert on public.businesses
  for each row execute function public.enforce_business_creation_limit();

create or replace function public.enforce_business_location_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_allowed integer;
begin
  -- Unauthorised inserts are left to RLS so they fail with a permission error.
  if auth.uid() is null or not public.has_business_role(new.business_id, 'manager') then
    return new;
  end if;
  max_allowed := public.business_feature_limit(new.business_id, 'max_locations');
  if max_allowed is not null and (
    select count(*) from public.business_locations where business_id = new.business_id
  ) >= max_allowed then
    raise exception 'plan limit reached: max_locations = %', max_allowed using errcode = 'P0001', hint = 'upgrade_required';
  end if;
  return new;
end;
$$;

create trigger business_locations_enforce_limit
  before insert on public.business_locations
  for each row execute function public.enforce_business_location_limit();

-- Team size counts accepted members plus open invitations.
create or replace function public.enforce_team_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_allowed integer;
  current_count integer;
begin
  -- Unauthorised inserts are left to RLS so they fail with a permission error.
  if auth.uid() is null or not public.has_business_role(new.business_id, 'manager') then
    return new;
  end if;
  -- Accepting an invitation turns an invitation into a member; it is not growth.
  if tg_table_name = 'business_members' and exists (
    select 1 from public.business_invitations i
    join auth.users u on u.email = i.email
    where i.business_id = new.business_id and u.id = new.user_id
      and i.accepted_at is null and i.revoked_at is null
  ) then
    return new;
  end if;

  max_allowed := public.business_feature_limit(new.business_id, 'max_team_members');
  if max_allowed is null then
    return new;
  end if;

  select
    (select count(*) from public.business_members where business_id = new.business_id)
    + (select count(*) from public.business_invitations
       where business_id = new.business_id and accepted_at is null and revoked_at is null
         and expires_at > now())
  into current_count;

  if current_count >= max_allowed then
    raise exception 'plan limit reached: max_team_members = %', max_allowed using errcode = 'P0001', hint = 'upgrade_required';
  end if;
  return new;
end;
$$;

create trigger business_members_enforce_limit
  before insert on public.business_members
  for each row execute function public.enforce_team_member_limit();
create trigger business_invitations_enforce_limit
  before insert on public.business_invitations
  for each row execute function public.enforce_team_member_limit();

-- Slugs ---------------------------------------------------------------------------

-- Returns a free slug for the city. Definer so that collisions with drafts the
-- caller cannot see are detected; it only reveals that a slug is taken.
create or replace function public.next_business_slug(p_city_id uuid, p_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base text := trim(both '-' from left(coalesce(public.slugify(p_name), ''), 70));
  candidate text;
  n integer := 1;
begin
  if base = '' then
    base := 'biznes';
  end if;
  candidate := base;
  while exists (select 1 from public.businesses where city_id = p_city_id and slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- Helpers ---------------------------------------------------------------------------

create or replace function public.make_point(p_lat double precision, p_lng double precision)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
$$;

-- A location must be close to the city it is listed in. 60 km covers the
-- surrounding area without allowing points in another region.
create or replace function public.assert_point_near_city(
  p_city_id uuid, p_lat double precision, p_lng double precision
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid coordinates' using errcode = '22023', hint = 'invalid_location';
  end if;
  if not exists (
    select 1 from public.cities c
    where c.id = p_city_id
      and extensions.st_dwithin(c.center, public.make_point(p_lat, p_lng), 60000)
  ) then
    raise exception 'location is too far from the city' using errcode = '22023', hint = 'location_far_from_city';
  end if;
end;
$$;

-- Onboarding --------------------------------------------------------------------------

create or replace function public.create_business(
  p_name text,
  p_city_slug text,
  p_category_slug text,
  p_address_line text,
  p_lat double precision,
  p_lng double precision,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_description text default null,
  p_postal_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p_city_id uuid;
  p_category_id uuid;
  new_id uuid;
  new_slug text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select id into p_city_id from public.cities where slug = p_city_slug and is_active;
  if p_city_id is null then
    raise exception 'city is not available' using errcode = '22023', hint = 'invalid_city';
  end if;
  select id into p_category_id from public.categories where slug = p_category_slug and is_active;
  if p_category_id is null then
    raise exception 'category is not available' using errcode = '22023', hint = 'invalid_category';
  end if;
  perform public.assert_point_near_city(p_city_id, p_lat, p_lng);

  new_slug := public.next_business_slug(p_city_id, p_name);

  insert into public.businesses (slug, city_id, primary_category_id, name, description, phone, email, website)
  values (new_slug, p_city_id, p_category_id, trim(p_name), nullif(trim(p_description), ''),
          nullif(trim(p_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_website), ''))
  returning id into new_id;

  insert into public.business_locations (business_id, city_id, address_line, postal_code, location, is_primary)
  values (new_id, p_city_id, trim(p_address_line), nullif(trim(p_postal_code), ''),
          public.make_point(p_lat, p_lng), true);

  return jsonb_build_object('id', new_id, 'slug', new_slug);
end;
$$;

-- Location ------------------------------------------------------------------------------

create or replace function public.update_business_location(
  p_location_id uuid,
  p_address_line text,
  p_lat double precision,
  p_lng double precision,
  p_postal_code text default null,
  p_is_24_7 boolean default false,
  p_coverage_radius_km numeric default null,
  p_capacity smallint default 1,
  p_vehicle_restrictions text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  loc_city uuid;
begin
  select city_id into loc_city from public.business_locations where id = p_location_id;
  if loc_city is null or not public.has_business_role(public.location_business_id(p_location_id), 'manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform public.assert_point_near_city(loc_city, p_lat, p_lng);

  update public.business_locations
  set address_line = trim(p_address_line),
      postal_code = nullif(trim(p_postal_code), ''),
      location = public.make_point(p_lat, p_lng),
      is_24_7 = coalesce(p_is_24_7, false),
      coverage_radius_km = p_coverage_radius_km,
      capacity = coalesce(p_capacity, 1),
      vehicle_restrictions = nullif(trim(p_vehicle_restrictions), '')
  where id = p_location_id;
end;
$$;

-- Replaces all opening hours of a location in one transaction.
-- p_hours: [{"weekday": 1, "opens_at": "08:30", "closes_at": "18:00"}, ...]
create or replace function public.set_location_hours(p_location_id uuid, p_hours jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_business_role(public.location_business_id(p_location_id), 'manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 28 then
    raise exception 'invalid hours payload' using errcode = '22023';
  end if;

  delete from public.business_hours where business_location_id = p_location_id;

  insert into public.business_hours (business_location_id, weekday, opens_at, closes_at)
  select p_location_id, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) as h;

  update public.business_locations set hours_verified_at = now() where id = p_location_id;
end;
$$;

-- Dashboard reads ---------------------------------------------------------------------

create or replace function public.my_businesses()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'status', b.status,
    'role', m.role,
    'city', jsonb_build_object('slug', c.slug, 'name', c.name),
    'category', cat.name
  ) order by b.created_at), '[]'::jsonb)
  from public.business_members m
  join public.businesses b on b.id = m.business_id and b.deleted_at is null
  join public.cities c on c.id = b.city_id
  join public.categories cat on cat.id = b.primary_category_id
  where m.user_id = auth.uid() and m.accepted_at is not null
$$;

create or replace function public.dashboard_business(p_business_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'status', b.status,
    'rejection_reason', b.rejection_reason,
    'is_verified', b.is_verified,
    'is_demo', b.is_demo,
    'description', b.description,
    'phone', b.phone,
    'email', b.email,
    'website', b.website,
    'booking_enabled', b.booking_enabled,
    'role', (select m.role from public.business_members m
             where m.business_id = b.id and m.user_id = auth.uid()),
    'is_public', public.is_publicly_visible(b.id),
    'city', jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name,
                               'lat', extensions.st_y(c.center::extensions.geometry),
                               'lng', extensions.st_x(c.center::extensions.geometry)),
    'category', jsonb_build_object('id', cat.id, 'slug', cat.slug, 'name', cat.name, 'kind', cat.kind),
    'plan', (select jsonb_build_object('code', sp.code, 'name', sp.name)
             from public.subscription_plans sp
             where sp.id = public.business_active_plan_id(b.id)),
    'limits', jsonb_build_object(
      'max_services', public.business_feature_limit(b.id, 'max_services'),
      'max_images', public.business_feature_limit(b.id, 'max_images'),
      'online_booking', public.business_has_feature(b.id, 'online_booking')
    ),
    'location', (
      select jsonb_build_object(
        'id', l.id,
        'address_line', l.address_line,
        'postal_code', l.postal_code,
        'lat', extensions.st_y(l.location::extensions.geometry),
        'lng', extensions.st_x(l.location::extensions.geometry),
        'is_24_7', l.is_24_7,
        'coverage_radius_km', l.coverage_radius_km,
        'capacity', l.capacity,
        'vehicle_restrictions', l.vehicle_restrictions,
        'hours_verified_at', l.hours_verified_at,
        'hours', coalesce((
          select jsonb_agg(jsonb_build_object(
            'weekday', h.weekday,
            'opens_at', to_char(h.opens_at, 'HH24:MI'),
            'closes_at', to_char(h.closes_at, 'HH24:MI')
          ) order by h.weekday, h.opens_at)
          from public.business_hours h where h.business_location_id = l.id
        ), '[]'::jsonb)
      )
      from public.business_locations l
      where l.business_id = b.id
      order by l.is_primary desc, l.created_at
      limit 1
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'service_id', s.service_id,
        'name', s.name,
        'description', s.description,
        'price_from_cents', s.price_from_cents,
        'price_to_cents', s.price_to_cents,
        'duration_minutes', s.duration_minutes,
        'is_bookable', s.is_bookable,
        'is_active', s.is_active
      ) order by s.sort_order, s.created_at)
      from public.business_services s
      where s.business_id = b.id and s.deleted_at is null
    ), '[]'::jsonb),
    'service_types', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name) order by st.name)
      from public.services st
      where st.category_id = b.primary_category_id and st.is_active
    ), '[]'::jsonb),
    'stats_30d', (
      select jsonb_build_object(
        'profile_view', count(*) filter (where e.type = 'profile_view'),
        'phone_click', count(*) filter (where e.type = 'phone_click'),
        'website_click', count(*) filter (where e.type = 'website_click'),
        'directions_click', count(*) filter (where e.type = 'directions_click')
      )
      from public.business_events e
      where e.business_id = b.id and e.occurred_at > now() - interval '30 days'
    )
  )
  from public.businesses b
  join public.cities c on c.id = b.city_id
  join public.categories cat on cat.id = b.primary_category_id
  where b.id = p_business_id and b.deleted_at is null
$$;

-- Grants -------------------------------------------------------------------------------

revoke execute on function
  public.next_business_slug(uuid, text),
  public.assert_point_near_city(uuid, double precision, double precision),
  public.create_business(text, text, text, text, double precision, double precision, text, text, text, text, text),
  public.update_business_location(uuid, text, double precision, double precision, text, boolean, numeric, smallint, text),
  public.set_location_hours(uuid, jsonb),
  public.my_businesses(),
  public.dashboard_business(uuid)
from public, anon;

grant execute on function
  public.next_business_slug(uuid, text),
  public.assert_point_near_city(uuid, double precision, double precision),
  public.create_business(text, text, text, text, double precision, double precision, text, text, text, text, text),
  public.update_business_location(uuid, text, double precision, double precision, text, boolean, numeric, smallint, text),
  public.set_location_hours(uuid, jsonb),
  public.my_businesses(),
  public.dashboard_business(uuid)
to authenticated;

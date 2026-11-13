-- Public marketplace RPC tests (run as anon, so RLS applies).
\set ON_ERROR_STOP 1
begin;

create schema tests;
create function tests.expect_eq(p_label text, p_actual anyelement, p_expected anyelement) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL - % (expected %, got %)', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   - %', p_label;
end $$;
grant usage on schema tests to anon;
grant execute on all functions in schema tests to anon;

-- A non-visible (draft) business that must never appear.
insert into public.businesses (slug, city_id, primary_category_id, name, status)
values ('hidden-draft', (select id from public.cities where slug = 'varna'),
        (select id from public.categories where slug = 'auto-repair'), 'Hidden Draft Garage', 'draft');
insert into public.business_locations (business_id, city_id, address_line, location)
select id, city_id, 'Somewhere', 'SRID=4326;POINT(27.91 43.21)' from public.businesses where slug = 'hidden-draft';

set local role anon;

select tests.expect_eq('cities list exposes the 4 active cities',
  jsonb_array_length(public.public_cities()), 4);
select tests.expect_eq('Varna has 3 visible auto repair shops',
  (select (c -> 'category_counts' ->> 'auto-repair')::int from jsonb_array_elements(public.public_cities()) c where c ->> 'slug' = 'varna'), 3);
select tests.expect_eq('categories include service types',
  (select jsonb_array_length(c -> 'services') from jsonb_array_elements(public.public_categories()) c where c ->> 'slug' = 'tire-services'), 6);

select tests.expect_eq('city search returns all visible Varna businesses',
  (public.search_businesses(p_city_slug => 'varna') ->> 'total')::int, 10);
select tests.expect_eq('draft business never appears',
  (select count(*) from jsonb_array_elements(public.search_businesses(p_query => 'Hidden') -> 'items'))::int, 0);
select tests.expect_eq('category filter',
  (public.search_businesses(p_city_slug => 'varna', p_category_slug => 'auto-repair') ->> 'total')::int, 3);
select tests.expect_eq('service filter',
  (public.search_businesses(p_city_slug => 'varna', p_service_slug => 'ceramic-coating') ->> 'total')::int, 1);
select tests.expect_eq('name search is case-insensitive',
  (public.search_businesses(p_query => 'ГУМИ') ->> 'total')::int, 2);
select tests.expect_eq('LIKE wildcards in the query are literal',
  (public.search_businesses(p_query => '%') ->> 'total')::int, 0);
select tests.expect_eq('booking filter',
  (public.search_businesses(p_city_slug => 'varna', p_booking_only => true) ->> 'total')::int, 5);

-- From the sea garden (27.935, 43.205): 5 km excludes the far western industrial zone.
select tests.expect_eq('5 km radius from a user point excludes distant providers',
  (select count(*) from jsonb_array_elements(
     public.search_businesses(p_lat => 43.205, p_lng => 27.935, p_radius_km => 5) -> 'items') i
   where i ->> 'slug' = 'demo-patna-pomosht-varna-24')::int, 0);
select tests.expect_eq('50 km radius includes it',
  (select count(*) from jsonb_array_elements(
     public.search_businesses(p_lat => 43.205, p_lng => 27.935, p_radius_km => 50) -> 'items') i
   where i ->> 'slug' = 'demo-patna-pomosht-varna-24')::int, 1);
select tests.expect_eq('origin is reported as user when coordinates are given',
  public.search_businesses(p_lat => 43.205, p_lng => 27.935, p_radius_km => 10) ->> 'origin', 'user');
select tests.expect_eq('distance sort is ascending',
  (select bool_and(d1 <= d2) from (
     select (i ->> 'distance_km')::numeric as d1,
            lead((i ->> 'distance_km')::numeric) over (order by ord) as d2
     from jsonb_array_elements(public.search_businesses(p_lat => 43.205, p_lng => 27.935, p_radius_km => 25, p_sort => 'distance') -> 'items')
       with ordinality as t(i, ord)
   ) pairs where d2 is not null), true);
select tests.expect_eq('pagination limits items but keeps total',
  (select jsonb_array_length(r -> 'items') || '/' || (r ->> 'total')
   from (select public.search_businesses(p_city_slug => 'varna', p_limit => 4, p_offset => 8) as r) x), '2/10');

select tests.expect_eq('no ratings are invented',
  (select count(*) from jsonb_array_elements(public.search_businesses(p_city_slug => 'varna') -> 'items') i
   where i -> 'rating_avg' <> 'null'::jsonb)::int, 0);

select tests.expect_eq('24/7 location is open now',
  (select (i ->> 'open_now')::boolean from jsonb_array_elements(public.search_businesses(p_city_slug => 'varna') -> 'items') i
   where i ->> 'slug' = 'demo-samoobsluzhvane-levski'), true);

select tests.expect_eq('profile loads with services and hours',
  (select jsonb_array_length(p -> 'services') > 0 and jsonb_array_length(p -> 'locations' -> 0 -> 'hours') = 6
   from (select public.get_business_profile('varna', 'demo-avtoservis-vladislav') as p) x), true);
select tests.expect_eq('profile of a draft business is not readable',
  public.get_business_profile('varna', 'hidden-draft'), null::jsonb);
select tests.expect_eq('roadside profile lists its service area',
  public.get_business_profile('varna', 'demo-patna-pomosht-varna-24') -> 'locations' -> 0 -> 'service_areas' ->> 0, 'Варна');
select tests.expect_eq('sitemap paths exclude drafts',
  jsonb_array_length(public.public_business_paths()), 10);

reset role;

-- open-now logic with a fixed clock (Monday 2030-01-07 10:00 Sofia = 08:00 UTC).
select tests.expect_eq('open on Monday 10:00 local',
  public.location_open_now(
    (select l.id from public.business_locations l join public.businesses b on b.id = l.business_id where b.slug = 'demo-avtoservis-vladislav'),
    '2030-01-07 08:00+00'), true);
select tests.expect_eq('closed on Sunday',
  public.location_open_now(
    (select l.id from public.business_locations l join public.businesses b on b.id = l.business_id where b.slug = 'demo-avtoservis-vladislav'),
    '2030-01-06 10:00+00'), false);
select tests.expect_eq('closed at 18:00 local (closing time is exclusive)',
  public.location_open_now(
    (select l.id from public.business_locations l join public.businesses b on b.id = l.business_id where b.slug = 'demo-avtoservis-vladislav'),
    '2030-01-07 16:00+00'), false);

update public.business_locations set hours_verified_at = null
where business_id = (select id from public.businesses where slug = 'demo-avtoservis-vladislav');
select tests.expect_eq('unverified hours give no open-now answer',
  public.location_open_now(
    (select l.id from public.business_locations l join public.businesses b on b.id = l.business_id where b.slug = 'demo-avtoservis-vladislav'),
    '2030-01-07 08:00+00'), null::boolean);

\echo '✓ marketplace tests passed'
rollback;

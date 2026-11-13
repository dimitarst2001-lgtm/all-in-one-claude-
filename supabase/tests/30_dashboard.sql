-- Business dashboard RPC tests (onboarding, location, hours, limits, isolation).
\set ON_ERROR_STOP 1
begin;

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.expect_error(p_label text, p_sql text, p_pattern text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~* p_pattern then
      raise notice 'ok   - %', p_label;
      return;
    end if;
    raise exception 'FAIL - % (unexpected error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL - % (statement succeeded but should have failed)', p_label;
end $$;

create function tests.expect_eq(p_label text, p_actual anyelement, p_expected anyelement) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL - % (expected %, got %)', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   - %', p_label;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

create table tests.ids (k text primary key, v text);
grant all on tests.ids to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'dash-owner@example.com', '{"full_name":"Dash Owner"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'dash-other@example.com', '{"full_name":"Other"}');

-- Onboarding ------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000a1');

insert into tests.ids
select 'biz', (public.create_business(
  'Сервиз Тест', 'varna',
  'auto-repair',
  'ул. Тестова 1', 43.2141, 27.9147, '+359 52 000 999') ->> 'id');

select tests.expect_eq('create_business makes the caller owner',
  (public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) ->> 'role'), 'owner');
select tests.expect_eq('new business starts as draft',
  (public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) ->> 'status'), 'draft');
select tests.expect_eq('slug is transliterated',
  (public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) ->> 'slug'), 'serviz-test');
select tests.expect_eq('primary location stored with coordinates',
  round((public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' ->> 'lat')::numeric, 4),
  43.2141);
select tests.expect_eq('my_businesses lists it',
  jsonb_array_length(public.my_businesses()), 1);

select tests.expect_eq('same name gets a unique slug',
  public.create_business(
    'Сервиз Тест', 'varna',
    'auto-repair',
    'ул. Тестова 2', 43.21, 27.91) ->> 'slug',
  'serviz-test-2');

select tests.expect_error('location far from the city is rejected',
  $sql$select public.create_business('Далечен', 'varna',
    'auto-repair', 'ул. Х', 42.69, 23.32)$sql$,
  'too far');

select tests.expect_error('cannot set moderation status through the table',
  format('update public.businesses set status = ''approved'' where id = %L', (select v from tests.ids where k = 'biz')),
  'permission denied');

-- Draft-period limits: Starter limits apply before a subscription exists ---------------

insert into public.business_services (business_id, name)
select (select v::uuid from tests.ids where k = 'biz'), 'Услуга ' || n from generate_series(1, 5) as n;
select tests.expect_error('6th service in draft exceeds entry plan limit',
  format('insert into public.business_services (business_id, name) values (%L, ''Услуга 6'')',
         (select v from tests.ids where k = 'biz')),
  'max_services');
select tests.expect_error('draft cannot enable online booking',
  format('update public.businesses set booking_enabled = true where id = %L', (select v from tests.ids where k = 'biz')),
  'online booking');
select tests.expect_error('second location exceeds entry plan limit',
  format($sql$insert into public.business_locations (business_id, city_id, address_line, location)
              values (%L, (select id from public.cities where slug = 'varna'), 'ул. Втора', public.make_point(43.2, 27.9))$sql$,
         (select v from tests.ids where k = 'biz')),
  'max_locations');

-- Hours -------------------------------------------------------------------------------------

select public.set_location_hours(
  (public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' ->> 'id')::uuid,
  '[{"weekday":1,"opens_at":"08:00","closes_at":"12:00"},
    {"weekday":1,"opens_at":"13:00","closes_at":"18:00"},
    {"weekday":6,"opens_at":"09:00","closes_at":"14:00"}]');
select tests.expect_eq('hours replaced',
  jsonb_array_length(public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' -> 'hours'), 3);
select tests.expect_eq('hours marked as verified by the business',
  (public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' ->> 'hours_verified_at') is not null, true);
select tests.expect_error('overlapping intervals are rejected',
  format($sql$select public.set_location_hours(%L, '[{"weekday":2,"opens_at":"08:00","closes_at":"12:00"},{"weekday":2,"opens_at":"11:00","closes_at":"18:00"}]')$sql$,
    public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' ->> 'id'),
  'conflicting key|exclusion');

select public.update_business_location(
  (public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' ->> 'id')::uuid,
  'бул. Нов 5', 43.22, 27.92, '9000', true, 30, 2::smallint, null);
select tests.expect_eq('location updated',
  public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) -> 'location' ->> 'address_line', 'бул. Нов 5');

select public.submit_business_for_review((select v::uuid from tests.ids where k = 'biz'));
reset role;

-- Isolation: another account sees nothing and can change nothing ---------------------------

select tests.login('00000000-0000-0000-0000-0000000000b1');
select tests.expect_eq('other user cannot read the dashboard',
  public.dashboard_business((select v::uuid from tests.ids where k = 'biz')), null::jsonb);
select tests.expect_eq('other user has no businesses', jsonb_array_length(public.my_businesses()), 0);
select tests.expect_error('other user cannot change hours',
  format($sql$select public.set_location_hours(%L, '[]')$sql$,
    (select l.id from public.business_locations l where l.business_id = (select v::uuid from tests.ids where k = 'biz'))),
  'not authorized');
reset role;
select tests.expect_eq('hours untouched by the other user',
  (select count(*) from public.business_hours h join public.business_locations l on l.id = h.business_location_id
   where l.business_id = (select v::uuid from tests.ids where k = 'biz')), 3::bigint);

-- Creation limit -----------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000b1');
select public.create_business('Фирма ' || n, 'varna',
  'car-wash', 'ул. ' || n, 43.21, 27.91)
from generate_series(1, 5) as n;
select tests.expect_error('6th business per account is rejected',
  $sql$select public.create_business('Фирма 6', 'varna',
    'car-wash', 'ул. 6', 43.21, 27.91)$sql$,
  'creation limit');
reset role;

\echo '✓ dashboard tests passed'
rollback;

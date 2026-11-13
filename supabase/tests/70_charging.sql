-- EV charging import and public search.
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

create function tests.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
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


insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'ev-user@example.com', '{"full_name":"EV"}');

grant execute on all functions in schema tests to anon, authenticated, service_role;
grant usage on schema tests to service_role;

create function tests.batch(p_extra jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('external_id', '100', 'name', 'Варна Мол DC', 'operator', 'Елдрайв',
      'address', 'бул. Владислав Варненчик 186', 'town', 'Варна', 'lat', 43.2203, 'lng', 27.8933,
      'usage_type', 'Public', 'is_public', true, 'num_points', 2, 'status_text', 'Operational',
      'source_url', 'https://openchargemap.org/site/poi/details/100',
      'source_updated_at', '2026-10-01T10:00:00Z',
      'connectors', jsonb_build_array(
        jsonb_build_object('type', 'ccs2', 'label', 'CCS (Type 2)', 'current', 'DC', 'power_kw', 150, 'quantity', 2),
        jsonb_build_object('type', 'type2', 'label', 'Type 2', 'current', 'AC', 'power_kw', 22, 'quantity', 1))),
    jsonb_build_object('external_id', '101', 'name', 'Морска градина AC', 'lat', 43.2050, 'lng', 27.9300,
      'connectors', jsonb_build_array(
        jsonb_build_object('type', 'type2', 'current', 'AC', 'power_kw', 11, 'quantity', 2))),
    jsonb_build_object('external_id', '200', 'name', 'София Център', 'lat', 42.6950, 'lng', 23.3250,
      'connectors', jsonb_build_array(
        jsonb_build_object('type', 'chademo', 'current', 'DC', 'power_kw', 50))),
    jsonb_build_object('external_id', '', 'name', 'Без id', 'lat', 43.2, 'lng', 27.9),
    jsonb_build_object('external_id', '999', 'name', 'Грешни координати', 'lat', 123, 'lng', 27.9)
  ) || p_extra
$$;

create function tests.names(p_args text) returns text language plpgsql as $$
declare v jsonb;
begin
  execute format('select public.charging_stations_search(%s)', p_args) into v;
  return coalesce((select string_agg(i ->> 'name', ',' order by n)
                   from jsonb_array_elements(v -> 'items') with ordinality t (i, n)), '');
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Import ---------------------------------------------------------------------------------

select tests.anon();
select tests.expect_error('anon cannot import',
  $sql$select public.charging_import('open_charge_map', '[]')$sql$, 'permission denied');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1');
select tests.expect_error('signed-in users cannot import',
  $sql$select public.charging_import('open_charge_map', '[]')$sql$, 'permission denied');
select tests.expect_error('signed-in users cannot write stations',
  $sql$insert into public.charging_stations (source_id, external_id, name, location)
       select id, 'x', 'x', 'SRID=4326;POINT(27.9 43.2)' from public.charging_data_sources limit 1$sql$,
  'permission denied');
reset role;

set local role service_role;
select tests.expect_eq('valid rows are imported, invalid ones skipped',
  public.charging_import('open_charge_map', tests.batch()) ->> 'imported', '3');
select tests.expect_eq('re-import updates in place',
  public.charging_import('open_charge_map', tests.batch()) ->> 'imported', '3');
reset role;

select tests.expect_eq('no duplicates after re-import', (select count(*)::int from public.charging_stations), 3);
select tests.expect_eq('connectors replaced, not appended',
  (select count(*)::int from public.charging_connectors), 4);
select tests.expect_eq('max power and AC/DC are derived',
  (select format('%s %s %s', max_power_kw, has_ac, has_dc) from public.charging_stations where external_id = '100'),
  '150.0 t t');
select tests.expect_eq('city is assigned from the coordinates',
  (select c.slug from public.charging_stations s join public.cities c on c.id = s.city_id where external_id = '200'),
  'sofia');
select tests.expect_eq('import status is recorded',
  (select last_import_status || ' ' || last_import_count from public.charging_data_sources where code = 'open_charge_map'),
  'success 3');

-- Search ---------------------------------------------------------------------------------

select tests.anon();
select tests.expect_eq('city search lists nearby stations, nearest first',
  tests.names($a$p_city_slug => 'varna'$a$), 'Морска градина AC,Варна Мол DC');
select tests.expect_eq('DC filter', tests.names($a$p_city_slug => 'varna', p_dc_only => true$a$), 'Варна Мол DC');
select tests.expect_eq('connector filter', tests.names($a$p_connector => 'chademo'$a$), 'София Център');
select tests.expect_eq('power filter', tests.names($a$p_city_slug => 'varna', p_min_power_kw => 50$a$), 'Варна Мол DC');
select tests.expect_eq('point search with radius',
  tests.names($a$p_lat => 42.7, p_lng => 23.32, p_radius_km => 5$a$), 'София Център');
select tests.expect_eq('attribution is returned',
  public.charging_stations_search(p_city_slug => 'varna') -> 'sources' -> 0 ->> 'name', 'Open Charge Map');
select tests.expect_error('unknown connectors are rejected',
  $sql$select public.charging_stations_search(p_connector => 'usb')$sql$, 'unknown connector');
select tests.expect_error('unknown cities are rejected',
  $sql$select public.charging_stations_search(p_city_slug => 'atlantis')$sql$, 'unknown city');
reset role;

-- Hidden stations (moderation) disappear from the public search.
update public.charging_stations set is_hidden = true where external_id = '101';
select tests.anon();
select tests.expect_eq('hidden stations are not public', tests.names($a$p_city_slug => 'varna'$a$), 'Варна Мол DC');
reset role;
update public.charging_stations set is_hidden = false where external_id = '101';

-- Removal: a complete batch drops stations the provider no longer lists,
-- unless the batch looks truncated.
set local role service_role;
select tests.expect_eq('a truncated batch removes nothing',
  public.charging_import('open_charge_map', '[{"external_id":"100","name":"x","lat":43.22,"lng":27.89}]') ->> 'removed', '0');
select tests.expect_eq('a truncated batch is marked partial',
  (select last_import_status from public.charging_data_sources where code = 'open_charge_map'), 'partial');
select tests.expect_eq('a complete batch removes delisted stations',
  public.charging_import('open_charge_map', jsonb_build_array(tests.batch() -> 0, tests.batch() -> 1)) ->> 'removed', '1');
select public.charging_import_failed('open_charge_map', 'HTTP 503');
reset role;
select tests.expect_eq('failures are recorded',
  (select last_import_status from public.charging_data_sources where code = 'open_charge_map'), 'failed');

\echo '✓ charging tests passed'
rollback;

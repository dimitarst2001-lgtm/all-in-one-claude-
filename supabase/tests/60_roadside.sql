-- Roadside coverage lookup and coverage management.
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

create table tests.ids (k text primary key, v text);
grant all on tests.ids to anon, authenticated;

create function tests.biz() returns uuid language sql stable as $$
  select v::uuid from tests.ids where k = 'biz'
$$;
create function tests.loc() returns uuid language sql stable as $$
  select id from public.business_locations where business_id = tests.biz()
$$;
-- Slugs of providers covering a point, sorted.
create function tests.slugs(p_lat double precision, p_lng double precision, p_service text default null)
returns text language sql stable as $$
  select coalesce(string_agg(i ->> 'slug', ',' order by i ->> 'slug'), '')
  from jsonb_array_elements(public.roadside_providers_for_point(p_lat, p_lng, p_service) -> 'items') i
$$;
create function tests.coverage(p_lat double precision, p_lng double precision) returns text
language sql stable as $$
  select i ->> 'coverage'
  from jsonb_array_elements(public.roadside_providers_for_point(p_lat, p_lng) -> 'items') i
  where (i ->> 'id')::uuid = tests.biz()
$$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'tow-owner@example.com', '{"full_name":"Tow"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'tow-stranger@example.com', '{"full_name":"Stranger"}');

-- Demo providers ---------------------------------------------------------------------------

select tests.anon();
select tests.expect_eq('both demo providers cover central Varna',
  tests.slugs(43.2141, 27.9147), 'demo-ev-transport-devnya,demo-patna-pomosht-varna-24');
select tests.expect_eq('nobody covers Sofia yet', tests.slugs(42.6977, 23.3219), '');
select tests.expect_eq('service filter keeps only EV transport',
  tests.slugs(43.2141, 27.9147, 'ev-transportation'), 'demo-ev-transport-devnya');
select tests.expect_eq('80 km radius reaches Dobrich, 40 km does not',
  tests.slugs(43.5726, 27.8273), 'demo-ev-transport-devnya');
select tests.expect_eq('providers available now are listed first',
  (select bool_and(available_first)
   from (select (i ->> 'is_24_7')::boolean or coalesce((i ->> 'open_now')::boolean, false)
                >= coalesce((lead(i) over (order by n) ->> 'is_24_7')::boolean
                            or coalesce((lead(i) over (order by n) ->> 'open_now')::boolean, false), false)
                as available_first
         from jsonb_array_elements(public.roadside_providers_for_point(43.2141, 27.9147) -> 'items')
              with ordinality as t (i, n)) x), true);
select tests.expect_eq('demo providers are flagged',
  (select bool_and((i ->> 'is_demo')::boolean)
   from jsonb_array_elements(public.roadside_providers_for_point(43.2141, 27.9147) -> 'items') i), true);
select tests.expect_eq('services are listed',
  jsonb_array_length(public.roadside_providers_for_point(43.2141, 27.9147) -> 'items' -> 0 -> 'services') > 0, true);
select tests.expect_error('invalid coordinates are rejected',
  $sql$select public.roadside_providers_for_point(95, 27.9)$sql$, 'invalid coordinates');
select tests.expect_error('non-roadside services are rejected',
  $sql$select public.roadside_providers_for_point(43.2, 27.9, 'oil-change')$sql$, 'unknown roadside service');
select tests.expect_error('anon cannot change coverage',
  $sql$select public.set_location_coverage_cities(gen_random_uuid(), '{varna}')$sql$, 'permission denied');
reset role;

-- A real provider --------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000f1');
insert into tests.ids
select 'biz', (public.create_business('Пътна помощ Тест', 'varna', 'roadside-assistance', 'ул. 3', 43.2141, 27.9147) ->> 'id');
select public.update_business_location(tests.loc(), 'ул. 3', 43.2141, 27.9147, null, true, 50);
reset role;

update public.businesses set status = 'approved', approved_at = now() where id = tests.biz();

select tests.anon();
select tests.expect_eq('unpaid real providers stay hidden', tests.coverage(43.2141, 27.9147), null);
reset role;

insert into public.subscriptions (business_id, plan_id, status, current_period_end)
values (tests.biz(), (select id from public.subscription_plans where code = 'professional'),
        'active', now() + interval '1 month');

select tests.anon();
select tests.expect_eq('radius covers Dobrich', tests.coverage(43.5726, 27.8273), 'radius');
select tests.expect_eq('Sofia is outside the radius', tests.coverage(42.6977, 23.3219), null);
reset role;

select tests.login('00000000-0000-0000-0000-0000000000f1');
select public.set_location_coverage_cities(tests.loc(), '{varna,sofia}');
select tests.expect_eq('coverage cities are listed',
  public.location_coverage_cities(tests.loc()), '["varna", "sofia"]'::jsonb);
select tests.expect_error('unknown cities are rejected',
  $sql$select public.set_location_coverage_cities(tests.loc(), '{atlantis}')$sql$, 'unknown city');
select tests.expect_error('inactive cities are rejected',
  $sql$select public.set_location_coverage_cities(tests.loc(), '{burgas}')$sql$, 'unknown city');
reset role;

select tests.anon();
select tests.expect_eq('a whole-city area covers central Sofia', tests.coverage(42.6977, 23.3219), 'city');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000f2');
select tests.expect_error('strangers cannot change coverage',
  format($sql$select public.set_location_coverage_cities(%L, '{}')$sql$, tests.loc()), 'not authorized');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000f1');
select public.set_location_coverage_cities(tests.loc(), '{varna}');
reset role;

select tests.anon();
select tests.expect_eq('removing a city removes its coverage', tests.coverage(42.6977, 23.3219), null);
reset role;

\echo '✓ roadside tests passed'
rollback;

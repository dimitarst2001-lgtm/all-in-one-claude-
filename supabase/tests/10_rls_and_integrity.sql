-- ---------------------------------------------------------------------------
-- Row Level Security, privilege and integrity tests.
-- Runs inside a transaction that is rolled back, so it leaves no data behind.
-- Any failed assertion raises an exception and aborts the run (exit code ≠ 0).
-- ---------------------------------------------------------------------------

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

-- Executes p_sql and asserts it fails with a message matching p_pattern.
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

-- Fixtures (as postgres) -----------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com', '{"full_name":"Owner A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com', '{"full_name":"Owner B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'customer@example.com', '{"full_name":"Customer","role":"super_admin"}'),
  ('00000000-0000-0000-0000-00000000000d', 'staff-a@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'moderator@example.com', '{}');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000e', 'moderator');

create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;

select tests.expect_eq('profile created by auth trigger',
  (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')), 2::bigint);

select tests.expect_eq('signup metadata never grants a platform role',
  (select count(*) from public.user_roles where user_id = '00000000-0000-0000-0000-00000000000c'), 0::bigint);

select tests.expect_eq('slugify transliterates Bulgarian',
  public.slugify('Велико Търново — Щастие & Жоро'), 'veliko-tarnovo-shtastie-zhoro');

-- Owner A creates a business -------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000a');

with created as (
  insert into public.businesses (slug, city_id, primary_category_id, name, phone)
  values (
    'owner-a-garage',
    (select id from public.cities where slug = 'varna'),
    (select id from public.categories where slug = 'auto-repair'),
    'Owner A Garage', '+359 52 000 900'
  )
  returning id
)
insert into ids select 'biz_a', id from created;

select tests.expect_eq('creator becomes owner',
  (select role::text from public.business_members
   where business_id = (select v from ids where k = 'biz_a')
     and user_id = '00000000-0000-0000-0000-00000000000a'), 'owner');

select tests.expect_eq('new business starts as draft',
  (select status::text from public.businesses where id = (select v from ids where k = 'biz_a')), 'draft');

select tests.expect_error('owner cannot self-approve (column privilege)',
  format('update public.businesses set status = ''approved'' where id = %L', (select v from ids where k = 'biz_a')),
  'permission denied');

select tests.expect_error('owner cannot mark own business verified',
  format('update public.businesses set is_verified = true where id = %L', (select v from ids where k = 'biz_a')),
  'permission denied');

select tests.expect_error('cannot insert a business pre-approved',
  $q$insert into public.businesses (slug, city_id, primary_category_id, name, status)
     values ('x', (select id from public.cities where slug = 'varna'),
             (select id from public.categories where slug = 'auto-repair'), 'Sneaky', 'approved')$q$,
  'permission denied');

select tests.expect_error('owner cannot create a subscription from the client',
  format($q$insert into public.subscriptions (business_id, plan_id, status)
            values (%L, (select id from public.subscription_plans where code = 'premium'), 'active')$q$,
         (select v from ids where k = 'biz_a')),
  'permission denied');

select tests.expect_error('booking cannot be enabled without a plan that includes it',
  format('update public.businesses set booking_enabled = true where id = %L', (select v from ids where k = 'biz_a')),
  'online booking');

insert into public.business_locations (business_id, city_id, address_line, location, is_primary)
values (
  (select v from ids where k = 'biz_a'), (select id from public.cities where slug = 'varna'),
  'ул. Тестова 1, Варна', 'SRID=4326;POINT(27.91 43.21)', true
);

-- Owner adds a staff member.
insert into public.business_members (business_id, user_id, role, accepted_at)
values ((select v from ids where k = 'biz_a'), '00000000-0000-0000-0000-00000000000d', 'staff', now());

reset role;

-- Owner B: tenant isolation ----------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000b');

select tests.expect_eq('other tenant cannot read a draft business',
  (select count(*) from public.businesses where id = (select v from ids where k = 'biz_a')), 0::bigint);

select tests.expect_eq('other tenant cannot read its locations',
  (select count(*) from public.business_locations where business_id = (select v from ids where k = 'biz_a')), 0::bigint);

with updated as (
  update public.businesses set name = 'Hijacked' where id = (select v from ids where k = 'biz_a') returning 1
)
select tests.expect_eq('other tenant update affects no rows', (select count(*) from updated), 0::bigint);

select tests.expect_error('other tenant cannot add itself as owner',
  format($q$insert into public.business_members (business_id, user_id, role, accepted_at)
            values (%L, '00000000-0000-0000-0000-00000000000b', 'owner', now())$q$,
         (select v from ids where k = 'biz_a')),
  'row-level security');

select tests.expect_error('other tenant cannot upload into another business folder',
  format($q$insert into storage.objects (bucket_id, name) values ('business-media', %L)$q$,
         (select v from ids where k = 'biz_a') || '/logo.png'),
  'row-level security');

reset role;

-- Customer: privilege escalation -------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000c');

select tests.expect_error('customer cannot grant itself super_admin',
  $q$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000c', 'super_admin')$q$,
  'row-level security');

select tests.expect_error('customer cannot unsuspend / modify protected profile fields',
  $q$update public.profiles set is_suspended = false where id = '00000000-0000-0000-0000-00000000000c'$q$,
  'permission denied');

update public.profiles set full_name = 'Renamed' where id = '00000000-0000-0000-0000-00000000000c';
select tests.expect_eq('customer can edit own name',
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'Renamed');

select tests.expect_eq('customer cannot read other profiles',
  (select count(*) from public.profiles), 1::bigint);

select tests.expect_error('customer cannot call moderation RPC',
  format('select public.admin_set_business_status(%L, ''approved'')', (select v from ids where k = 'biz_a')),
  'not authorized');

select tests.expect_error('customer cannot read webhook events',
  'select count(*) from public.webhook_events', 'permission denied');

select tests.expect_error('customer cannot read audit log rows they cannot see (no grant bypass)',
  'insert into public.audit_logs (action, entity_type) values (''x'', ''y'')', 'permission denied');

reset role;

-- Staff member of A ------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000d');

select tests.expect_eq('staff can read own business',
  (select count(*) from public.businesses where id = (select v from ids where k = 'biz_a')), 1::bigint);

with updated as (
  update public.businesses set name = 'Staff edit' where id = (select v from ids where k = 'biz_a') returning 1
)
select tests.expect_eq('staff cannot edit business profile', (select count(*) from updated), 0::bigint);

select tests.expect_error('staff cannot add team members',
  format($q$insert into public.business_members (business_id, user_id, role, accepted_at)
            values (%L, '00000000-0000-0000-0000-00000000000c', 'staff', now())$q$,
         (select v from ids where k = 'biz_a')),
  'row-level security');

reset role;

-- Moderation flow -------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_eq('owner submits for review',
  public.submit_business_for_review((select v from ids where k = 'biz_a'))::text, 'pending_review');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_error('rejection requires a reason',
  format('select public.admin_set_business_status(%L, ''rejected'')', (select v from ids where k = 'biz_a')),
  'reason is required');
select public.admin_set_business_status((select v from ids where k = 'biz_a'), 'approved');
reset role;

select tests.expect_eq('approval recorded in audit log',
  (select count(*) from public.audit_logs
   where action = 'business.status_changed' and entity_id = (select v from ids where k = 'biz_a')::text
     and actor_id = '00000000-0000-0000-0000-00000000000e'), 1::bigint);

-- Public visibility ------------------------------------------------------------------------

select tests.anon();
select tests.expect_eq('approved business without subscription is not public',
  (select count(*) from public.businesses where id = (select v from ids where k = 'biz_a')), 0::bigint);
select tests.expect_eq('all 10 demo businesses are public',
  (select count(*) from public.businesses where is_demo), 10::bigint);
select tests.expect_eq('anon cannot read bookings', (select has_table_privilege('public.bookings', 'select')), false);
reset role;

-- Webhook (service role) activates a Starter subscription.
insert into public.subscriptions (business_id, plan_id, status, current_period_end)
values ((select v from ids where k = 'biz_a'), (select id from public.subscription_plans where code = 'starter'),
        'active', now() + interval '1 month');

select tests.anon();
select tests.expect_eq('approved + active subscription is public',
  (select count(*) from public.businesses where id = (select v from ids where k = 'biz_a')), 1::bigint);
reset role;

-- Entitlements: Starter allows 5 services --------------------------------------------------

select tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.business_services (business_id, name)
select (select v from ids where k = 'biz_a'), 'Service ' || n from generate_series(1, 5) as n;

select tests.expect_error('6th service exceeds Starter limit',
  format('insert into public.business_services (business_id, name) values (%L, ''Service 6'')',
         (select v from ids where k = 'biz_a')),
  'max_services');

select tests.expect_error('starter cannot enable online booking',
  format('update public.businesses set booking_enabled = true where id = %L', (select v from ids where k = 'biz_a')),
  'online booking');

insert into storage.objects (bucket_id, name)
values ('business-media', (select v from ids where k = 'biz_a') || '/logo.png');
select tests.expect_eq('owner can upload into own business folder',
  (select count(*) from storage.objects where name like (select v from ids where k = 'biz_a') || '/%'), 1::bigint);
reset role;

-- Booking integrity (exclusion constraint) -----------------------------------------------

insert into ids
select 'loc_demo', l.id
from public.business_locations l
join public.businesses b on b.id = l.business_id
where b.slug = 'demo-avtoservis-vladislav';

insert into public.bookings (business_id, business_location_id, bay_number, customer_name, customer_email,
                             customer_phone, starts_at, ends_at, occupied_until)
select l.business_id, l.id, 1, 'Test One', 't1@example.com', '+359000000',
       '2030-01-07 09:00+02', '2030-01-07 10:00+02', '2030-01-07 10:15+02'
from public.business_locations l where l.id = (select v from ids where k = 'loc_demo');

select tests.expect_error('overlapping booking on the same bay is rejected',
  format($q$insert into public.bookings (business_id, business_location_id, bay_number, customer_name,
            customer_email, customer_phone, starts_at, ends_at, occupied_until)
            select business_id, id, 1, 'Test Two', 't2@example.com', '+359000001',
                   '2030-01-07 10:10+02', '2030-01-07 11:00+02', '2030-01-07 11:00+02'
            from public.business_locations where id = %L$q$, (select v from ids where k = 'loc_demo')),
  'bookings_no_overlap');

insert into public.bookings (business_id, business_location_id, bay_number, customer_name, customer_email,
                             customer_phone, starts_at, ends_at, occupied_until)
select l.business_id, l.id, 1, 'After buffer', 't3@example.com', '+359000002',
       '2030-01-07 10:15+02', '2030-01-07 11:00+02', '2030-01-07 11:00+02'
from public.business_locations l where l.id = (select v from ids where k = 'loc_demo');
select tests.expect_eq('booking starting exactly at the end of the buffer is allowed', true, true);

insert into public.bookings (business_id, business_location_id, bay_number, customer_name, customer_email,
                             customer_phone, starts_at, ends_at, occupied_until)
select l.business_id, l.id, 2, 'Second bay', 't4@example.com', '+359000003',
       '2030-01-07 09:30+02', '2030-01-07 10:30+02', '2030-01-07 10:30+02'
from public.business_locations l where l.id = (select v from ids where k = 'loc_demo');
select tests.expect_eq('same time on another bay is allowed', true, true);

insert into public.bookings (business_id, business_location_id, bay_number, customer_name, customer_email,
                             customer_phone, starts_at, ends_at, occupied_until, status)
select l.business_id, l.id, 1, 'Cancelled overlap', 't5@example.com', '+359000004',
       '2030-01-07 09:00+02', '2030-01-07 10:00+02', '2030-01-07 10:00+02', 'cancelled'
from public.business_locations l where l.id = (select v from ids where k = 'loc_demo');
select tests.expect_eq('cancelled bookings do not block the slot', true, true);

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.expect_eq('other tenant cannot read demo business bookings',
  (select count(*) from public.bookings), 0::bigint);
reset role;

-- Opening hours cannot overlap within a day.
select tests.expect_error('overlapping opening hours are rejected',
  format($q$insert into public.business_hours (business_location_id, weekday, opens_at, closes_at)
            values (%L, 1, '12:00', '13:00')$q$, (select v from ids where k = 'loc_demo')),
  'conflicting key value violates exclusion constraint');

\echo '✓ RLS and integrity tests passed'
rollback;

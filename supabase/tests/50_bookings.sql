-- Booking engine: slots, bay assignment, lifecycle and access.
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

grant execute on all functions in schema tests to anon, authenticated;

create table tests.ids (k text primary key, v text);
grant all on tests.ids to anon, authenticated;

-- Local date two days ahead and helpers to address slots on it.
insert into tests.ids values ('day', ((now() at time zone 'Europe/Sofia')::date + 2)::text);
create function tests.at(p_time text) returns timestamptz language sql stable as $$
  select ((select v::date from tests.ids where k = 'day') + p_time::time) at time zone 'Europe/Sofia'
$$;
create function tests.biz() returns uuid language sql stable as $$
  select v::uuid from tests.ids where k = 'biz'
$$;
create function tests.slots() returns integer language sql stable as $$
  select jsonb_array_length(public.available_slots(tests.biz(), (select v::date from tests.ids where k = 'day'),
    array[(select v::uuid from tests.ids where k = 'svc')]) -> 'slots')
$$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'shop-owner@example.com', '{"full_name":"Owner"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'customer@example.com', '{"full_name":"Customer"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'stranger2@example.com', '{"full_name":"Stranger"}');

-- A real (non-demo) business on the Professional plan, open 09:00–12:00 daily.
select tests.login('00000000-0000-0000-0000-0000000000d1');
insert into tests.ids
select 'biz', (public.create_business('Сервиз Резерв', 'varna', 'auto-repair', 'ул. 2', 43.2141, 27.9147) ->> 'id');
with s as (
  insert into public.business_services (business_id, name, duration_minutes, is_bookable, price_from_cents)
  values (tests.biz(), 'Смяна на масло', 60, true, 4000)
  returning id
)
insert into tests.ids select 'svc', id::text from s;
reset role;

update public.businesses set status = 'approved', approved_at = now() where id = tests.biz();
insert into public.subscriptions (business_id, plan_id, status, current_period_end)
values (tests.biz(), (select id from public.subscription_plans where code = 'professional'),
        'active', now() + interval '1 month');
insert into public.business_hours (business_location_id, weekday, opens_at, closes_at)
select l.id, w, '09:00', '12:00'
from public.business_locations l cross join generate_series(1, 7) as w
where l.business_id = tests.biz();

select tests.login('00000000-0000-0000-0000-0000000000d1');
update public.businesses
set booking_enabled = true, booking_slot_minutes = 30, booking_lead_hours = 2
where id = tests.biz();
reset role;

-- Slots ----------------------------------------------------------------------------------

select tests.expect_eq('demo businesses do not take bookings',
  (select bool_or(public.booking_open(b.id)) from public.businesses b where b.is_demo), false);
select tests.anon();
select tests.expect_eq('demo booking options say unavailable',
  (select bool_or((public.booking_options('varna', b.slug) ->> 'available')::boolean)
   from public.businesses b where b.is_demo and b.booking_enabled), false);
select tests.expect_eq('booking options show the business as open',
  (public.booking_options('varna', (select slug from public.businesses where id = tests.biz())) ->> 'available')::boolean, true);
select tests.expect_eq('09:00–12:00 with a 60 min service gives 5 starts', tests.slots(), 5);
select tests.expect_eq('past dates have no slots',
  jsonb_array_length(public.available_slots(tests.biz(), (now() at time zone 'Europe/Sofia')::date - 1) -> 'slots'), 0);
select tests.expect_eq('dates beyond the horizon have no slots',
  jsonb_array_length(public.available_slots(tests.biz(), (now() at time zone 'Europe/Sofia')::date + 31) -> 'slots'), 0);
select tests.expect_error('unknown services are rejected',
  $sql$select public.available_slots(tests.biz(), current_date + 2, array['00000000-0000-0000-0000-000000000000'::uuid])$sql$,
  'invalid services');
select tests.expect_error('anonymous visitors cannot book',
  $sql$select public.create_booking(tests.biz(), '{}', tests.at('10:00'), 'Анон', '0888000000')$sql$,
  'permission denied');
select tests.expect_eq('anon cannot read booking rows', has_table_privilege('public.bookings', 'select'), false);
reset role;

-- Booking --------------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000d2');
insert into tests.ids
select 'b1', public.create_booking(tests.biz(), array[(select v::uuid from tests.ids where k = 'svc')],
  tests.at('10:00'), 'Иван Петров', '0888123456', '{"make":"Skoda"}', 'Моля, сутринта') ->> 'id';
select tests.expect_eq('new booking waits for confirmation',
  (select status::text from public.bookings where id = (select v::uuid from tests.ids where k = 'b1')), 'pending');
select tests.expect_eq('booking uses the account e-mail',
  (select customer_email::text from public.bookings where id = (select v::uuid from tests.ids where k = 'b1')),
  'customer@example.com');
select tests.expect_eq('service snapshot is stored',
  (select name_snapshot from public.booking_services where booking_id = (select v::uuid from tests.ids where k = 'b1')),
  'Смяна на масло');
select tests.expect_eq('overlapping starts disappear (09:00 and 11:00 remain)', tests.slots(), 2);
select tests.expect_error('the same slot cannot be booked twice',
  $sql$select public.create_booking(tests.biz(), array[(select v::uuid from tests.ids where k = 'svc')], tests.at('10:00'), 'Иван Петров', '0888123456')$sql$,
  'no longer available');
select tests.expect_error('a time that is not a slot is rejected',
  $sql$select public.create_booking(tests.biz(), '{}', tests.at('10:10'), 'Иван Петров', '0888123456')$sql$,
  'no longer available');
select tests.expect_error('customers cannot write bookings directly',
  $sql$update public.bookings set status = 'confirmed'$sql$, 'permission denied');
reset role;

-- A second bay frees the slot again; the next booking takes bay 2.
update public.business_locations set capacity = 2 where business_id = tests.biz();
select tests.login('00000000-0000-0000-0000-0000000000d2');
select tests.expect_eq('two bays offer all 5 starts again', tests.slots(), 5);
insert into tests.ids
select 'b2', public.create_booking(tests.biz(), array[(select v::uuid from tests.ids where k = 'svc')],
  tests.at('10:00'), 'Иван Петров', '0888123456') ->> 'id';
select tests.expect_eq('second booking goes to bay 2',
  (select bay_number from public.bookings where id = (select v::uuid from tests.ids where k = 'b2')), 2::smallint);
select tests.expect_eq('customer sees both bookings', jsonb_array_length(public.my_bookings()), 2);
select tests.expect_error('a third upcoming booking is allowed but a fourth is not',
  $sql$select public.create_booking(tests.biz(), '{}', tests.at('09:00'), 'Иван Петров', '0888123456');
       select public.create_booking(tests.biz(), '{}', tests.at('11:30'), 'Иван Петров', '0888123456')$sql$,
  'too many');
reset role;

-- Business side ----------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000d3');
select tests.expect_eq('strangers see no bookings',
  jsonb_array_length(public.business_bookings(tests.biz(), 'upcoming')), 0);
select tests.expect_error('strangers cannot confirm',
  format($sql$select public.set_booking_status(%L, 'confirmed')$sql$, (select v from tests.ids where k = 'b1')),
  'not authorized');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000d1');
select tests.expect_eq('owner sees upcoming bookings',
  jsonb_array_length(public.business_bookings(tests.biz(), 'upcoming')), 2);
select tests.expect_eq('confirm returns the notice for e-mails',
  public.set_booking_status((select v::uuid from tests.ids where k = 'b1'), 'confirmed') ->> 'status', 'confirmed');
select tests.expect_error('future bookings cannot be marked completed',
  format($sql$select public.set_booking_status(%L, 'completed')$sql$, (select v from tests.ids where k = 'b1')),
  'invalid status change');
select tests.expect_eq('one booking is still pending',
  jsonb_array_length(public.business_bookings(tests.biz(), 'pending')), 1);
reset role;

select tests.login('00000000-0000-0000-0000-0000000000d2');
select tests.expect_eq('customer cancels their booking',
  public.cancel_my_booking((select v::uuid from tests.ids where k = 'b1')) ->> 'status', 'cancelled');
select tests.expect_error('a cancelled booking cannot be cancelled again',
  format($sql$select public.cancel_my_booking(%L)$sql$, (select v from tests.ids where k = 'b1')),
  'cannot be cancelled');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000d3');
select tests.expect_error('strangers cannot cancel someone else''s booking',
  format($sql$select public.cancel_my_booking(%L)$sql$, (select v from tests.ids where k = 'b2')),
  'not authorized');
reset role;

-- Days off remove every slot of the day.
select tests.login('00000000-0000-0000-0000-0000000000d1');
select public.add_blocked_days(tests.biz(), (select v::date from tests.ids where k = 'day'),
  (select v::date from tests.ids where k = 'day'), 'Почивен ден');
select tests.expect_eq('blocked day is listed', jsonb_array_length(public.business_blocked_days(tests.biz())), 1);
select tests.expect_eq('blocked day has no slots', tests.slots(), 0);
reset role;

select tests.login('00000000-0000-0000-0000-0000000000d2');
select tests.expect_error('customers cannot block days',
  $sql$select public.add_blocked_days(tests.biz(), current_date, current_date)$sql$,
  'row-level security|not authorized');
reset role;

\echo '✓ booking tests passed'
rollback;

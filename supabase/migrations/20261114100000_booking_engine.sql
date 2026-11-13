-- Phase 5 (part 1): online booking engine.
--
-- Customers must be signed in to book (no guest bookings in the MVP: it keeps
-- spam out and gives every customer a "my bookings" page). Bookings are only
-- written through the SECURITY DEFINER functions below; the table itself has
-- no insert/update grants.
--
-- Availability for a day comes from availability_rules when the location has
-- any for that weekday, otherwise from business_hours (24/7 locations without
-- rules are bookable all day). Candidate starts are spaced by
-- businesses.booking_slot_minutes; a booking lasts the sum of the selected
-- services' durations (or one slot when no service is chosen) and blocks its
-- bay for that time plus booking_buffer_minutes. A start is offered while at
-- least one of the location's `capacity` bays is free. The exclusion
-- constraint bookings_no_overlap stays the final guard against races.

-- Helpers ------------------------------------------------------------------------------

-- Whether a business accepts online bookings right now. Demo listings never
-- do: they are not real businesses.
create or replace function public.booking_open(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id
      and b.booking_enabled
      and not b.is_demo
      and public.is_publicly_visible(b.id)
      and public.business_has_feature(b.id, 'online_booking')
  )
$$;

-- Total duration in minutes of the chosen services, or NULL when any id is not
-- an active, bookable service of the business. No services = one slot.
create or replace function public.booking_duration(p_business_id uuid, p_service_ids uuid[])
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(cardinality(p_service_ids), 0) = 0 then
      (select b.booking_slot_minutes from public.businesses b where b.id = p_business_id)
    when cardinality(p_service_ids) > 5 then null
    when (select count(distinct x) from unnest(p_service_ids) as x) <> (
      select count(*) from public.business_services s
      where s.id = any (p_service_ids) and s.business_id = p_business_id
        and s.is_active and s.is_bookable and s.deleted_at is null
    ) then null
    else (
      select sum(s.duration_minutes)::integer from public.business_services s
      where s.id = any (p_service_ids)
    )
  end
$$;

-- Bookable start times for one local date. Returns NULL when the business does
-- not take bookings, otherwise {date, timezone, duration_minutes, slots:[{start, label}]}.
create or replace function public.available_slots(
  p_business_id uuid,
  p_date date,
  p_service_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  biz public.businesses%rowtype;
  loc record;
  duration integer;
  today date;
  earliest timestamptz;
begin
  if not public.booking_open(p_business_id) then
    return null;
  end if;

  select * into biz from public.businesses where id = p_business_id;
  select l.id, l.capacity, l.is_24_7, c.timezone into loc
  from public.business_locations l
  join public.cities c on c.id = l.city_id
  where l.business_id = p_business_id
  order by l.is_primary desc, l.created_at
  limit 1;
  if not found then
    return null;
  end if;

  duration := public.booking_duration(p_business_id, p_service_ids);
  if duration is null then
    raise exception 'invalid services' using errcode = '22023', hint = 'invalid_booking_services';
  end if;

  today := (now() at time zone loc.timezone)::date;
  earliest := now() + make_interval(hours => biz.booking_lead_hours);

  return jsonb_build_object(
    'date', p_date,
    'timezone', loc.timezone,
    'duration_minutes', duration,
    'slots', case
      when p_date < today or p_date > today + biz.booking_horizon_days then '[]'::jsonb
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'start', s.starts_at,
          'label', to_char(s.starts_at at time zone loc.timezone, 'HH24:MI')
        ) order by s.starts_at)
        from (
          select distinct gs as starts_at
          from (
            -- Opening intervals of the day, as absolute times.
            select (p_date + r.start_time) at time zone loc.timezone as opens,
                   (p_date + r.end_time) at time zone loc.timezone as closes
            from public.availability_rules r
            where r.business_location_id = loc.id
              and r.weekday = extract(isodow from p_date)::smallint
            union all
            select (p_date + h.opens_at) at time zone loc.timezone,
                   (p_date + h.closes_at) at time zone loc.timezone
            from public.business_hours h
            where h.business_location_id = loc.id
              and h.weekday = extract(isodow from p_date)::smallint
              and not exists (
                select 1 from public.availability_rules r
                where r.business_location_id = loc.id
                  and r.weekday = extract(isodow from p_date)::smallint
              )
            union all
            select p_date::timestamp at time zone loc.timezone,
                   (p_date + 1)::timestamp at time zone loc.timezone
            where loc.is_24_7
              and not exists (
                select 1 from public.availability_rules r
                where r.business_location_id = loc.id
                  and r.weekday = extract(isodow from p_date)::smallint
              )
          ) as w
          cross join lateral generate_series(
            w.opens,
            w.closes - make_interval(mins => duration),
            make_interval(mins => biz.booking_slot_minutes)
          ) as gs
          where gs >= earliest
        ) as s
        where not exists (
          select 1 from public.blocked_periods bp
          where bp.business_location_id = loc.id
            and tstzrange(bp.starts_at, bp.ends_at, '[)')
                && tstzrange(s.starts_at, s.starts_at + make_interval(mins => duration + biz.booking_buffer_minutes), '[)')
        )
        and (
          select count(distinct bk.bay_number) from public.bookings bk
          where bk.business_location_id = loc.id
            and bk.status in ('pending', 'confirmed')
            and tstzrange(bk.starts_at, bk.occupied_until, '[)')
                && tstzrange(s.starts_at, s.starts_at + make_interval(mins => duration + biz.booking_buffer_minutes), '[)')
        ) < loc.capacity
      ), '[]'::jsonb)
    end
  );
end;
$$;

-- Everything the booking page needs about a business, by its public path.
create or replace function public.booking_options(p_city_slug text, p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_id', b.id,
    'name', b.name,
    'slug', b.slug,
    'is_demo', b.is_demo,
    'booking_enabled', b.booking_enabled,
    'available', public.booking_open(b.id),
    'auto_confirm', b.booking_auto_confirm,
    'slot_minutes', b.booking_slot_minutes,
    'lead_hours', b.booking_lead_hours,
    'horizon_days', b.booking_horizon_days,
    'today', (now() at time zone cty.timezone)::date,
    'city', jsonb_build_object('slug', cty.slug, 'name', cty.name),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'duration_minutes', s.duration_minutes,
        'price_from_cents', s.price_from_cents,
        'price_to_cents', s.price_to_cents
      ) order by s.sort_order, s.name)
      from public.business_services s
      where s.business_id = b.id and s.is_active and s.is_bookable and s.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.businesses b
  join public.cities cty on cty.id = b.city_id
  where cty.slug = p_city_slug and b.slug = p_slug
    and public.is_publicly_visible(b.id)
$$;

-- Booking lifecycle ------------------------------------------------------------------------

create or replace function public.create_booking(
  p_business_id uuid,
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle jsonb default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz public.businesses%rowtype;
  loc record;
  caller_email text;
  duration integer;
  local_date date;
  bay integer;
  new_id uuid;
  new_status public.booking_status;
begin
  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not public.booking_open(p_business_id) then
    raise exception 'business does not take bookings' using errcode = 'P0001', hint = 'booking_unavailable';
  end if;

  select * into biz from public.businesses where id = p_business_id;
  select l.id, l.capacity, l.address_line, c.timezone into loc
  from public.business_locations l
  join public.cities c on c.id = l.city_id
  where l.business_id = p_business_id
  order by l.is_primary desc, l.created_at
  limit 1;

  select email into caller_email from auth.users where id = auth.uid();

  -- Abuse guard: at most 3 upcoming active bookings per customer and business.
  if (
    select count(*) from public.bookings bk
    where bk.business_id = p_business_id and bk.customer_id = auth.uid()
      and bk.status in ('pending', 'confirmed') and bk.starts_at > now()
  ) >= 3 then
    raise exception 'too many active bookings' using errcode = 'P0001', hint = 'too_many_bookings';
  end if;

  duration := public.booking_duration(p_business_id, p_service_ids);
  if duration is null then
    raise exception 'invalid services' using errcode = '22023', hint = 'invalid_booking_services';
  end if;

  -- Serialise bookings per location so bay assignment cannot race.
  perform pg_advisory_xact_lock(hashtextextended(loc.id::text, 0));

  local_date := (p_starts_at at time zone loc.timezone)::date;
  if not exists (
    select 1
    from jsonb_array_elements(public.available_slots(p_business_id, local_date, p_service_ids) -> 'slots') as s
    where (s ->> 'start')::timestamptz = p_starts_at
  ) then
    raise exception 'slot is no longer available' using errcode = 'P0001', hint = 'slot_unavailable';
  end if;

  select n into bay
  from generate_series(1, loc.capacity) as n
  where not exists (
    select 1 from public.bookings bk
    where bk.business_location_id = loc.id and bk.bay_number = n
      and bk.status in ('pending', 'confirmed')
      and tstzrange(bk.starts_at, bk.occupied_until, '[)')
          && tstzrange(p_starts_at, p_starts_at + make_interval(mins => duration + biz.booking_buffer_minutes), '[)')
  )
  order by n
  limit 1;
  if bay is null then
    raise exception 'slot is no longer available' using errcode = 'P0001', hint = 'slot_unavailable';
  end if;

  new_status := case when biz.booking_auto_confirm then 'confirmed' else 'pending' end;

  insert into public.bookings (
    business_id, business_location_id, bay_number, customer_id,
    customer_name, customer_email, customer_phone, vehicle, notes,
    starts_at, ends_at, occupied_until, status, status_changed_by
  ) values (
    p_business_id, loc.id, bay, auth.uid(),
    btrim(p_customer_name), caller_email, btrim(p_customer_phone),
    nullif(p_vehicle, '{}'::jsonb), nullif(btrim(p_notes), ''),
    p_starts_at,
    p_starts_at + make_interval(mins => duration),
    p_starts_at + make_interval(mins => duration + biz.booking_buffer_minutes),
    new_status, auth.uid()
  )
  returning id into new_id;

  insert into public.booking_services (booking_id, business_service_id, name_snapshot, price_from_cents_snapshot, duration_minutes_snapshot)
  select new_id, s.id, s.name, s.price_from_cents, s.duration_minutes
  from public.business_services s
  where s.id = any (coalesce(p_service_ids, '{}'));

  return public.booking_notice(new_id);
end;
$$;

-- Facts about a booking that the server uses for notification e-mails.
-- Internal: not granted to clients.
create or replace function public.booking_notice(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', bk.id,
    'status', bk.status,
    'status_reason', bk.status_reason,
    'starts_at', bk.starts_at,
    'ends_at', bk.ends_at,
    'timezone', c.timezone,
    'customer_name', bk.customer_name,
    'customer_email', bk.customer_email,
    'customer_phone', bk.customer_phone,
    'business_id', b.id,
    'business_name', b.name,
    'business_email', b.email,
    'business_phone', b.phone,
    'address', l.address_line,
    'city_name', c.name,
    'services', coalesce((
      select jsonb_agg(bs.name_snapshot order by bs.name_snapshot)
      from public.booking_services bs where bs.booking_id = bk.id
    ), '[]'::jsonb)
  )
  from public.bookings bk
  join public.businesses b on b.id = bk.business_id
  join public.business_locations l on l.id = bk.business_location_id
  join public.cities c on c.id = l.city_id
  where bk.id = p_booking_id
$$;

-- Status changes by the business (staff and up).
--   pending   -> confirmed | rejected | cancelled
--   confirmed -> completed | no_show | cancelled   (completed/no_show only once started)
create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bk public.bookings%rowtype;
begin
  select * into bk from public.bookings where id = p_booking_id for update;
  if not found or auth.uid() is null or not public.has_business_role(bk.business_id, 'staff') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not (
    (bk.status = 'pending' and p_status in ('confirmed', 'rejected', 'cancelled'))
    or (bk.status = 'confirmed' and p_status = 'cancelled')
    or (bk.status = 'confirmed' and p_status in ('completed', 'no_show') and bk.starts_at <= now())
  ) then
    raise exception 'invalid status change' using errcode = 'P0001', hint = 'invalid_booking_transition';
  end if;

  update public.bookings
  set status = p_status,
      status_reason = nullif(btrim(left(p_reason, 500)), ''),
      status_changed_at = now(),
      status_changed_by = auth.uid()
  where id = p_booking_id;

  return public.booking_notice(p_booking_id);
end;
$$;

-- A customer cancels their own upcoming booking.
create or replace function public.cancel_my_booking(p_booking_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bk public.bookings%rowtype;
begin
  select * into bk from public.bookings where id = p_booking_id for update;
  if not found or auth.uid() is null or bk.customer_id is distinct from auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if bk.status not in ('pending', 'confirmed') or bk.starts_at <= now() then
    raise exception 'booking cannot be cancelled' using errcode = 'P0001', hint = 'invalid_booking_transition';
  end if;

  update public.bookings
  set status = 'cancelled',
      status_reason = coalesce(nullif(btrim(left(p_reason, 500)), ''), 'Отказана от клиента'),
      status_changed_at = now(),
      status_changed_by = auth.uid()
  where id = p_booking_id;

  return public.booking_notice(p_booking_id);
end;
$$;

-- Read models ------------------------------------------------------------------------------

-- Bookings of a business for its dashboard. Scope: upcoming | pending | past.
create or replace function public.business_bookings(p_business_id uuid, p_scope text default 'upcoming')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.row order by
    case when p_scope = 'past' then null else x.starts_at end asc,
    case when p_scope = 'past' then x.starts_at end desc), '[]'::jsonb)
  from (
    select bk.starts_at, jsonb_build_object(
      'id', bk.id,
      'status', bk.status,
      'status_reason', bk.status_reason,
      'starts_at', bk.starts_at,
      'ends_at', bk.ends_at,
      'bay_number', bk.bay_number,
      'customer_name', bk.customer_name,
      'customer_email', bk.customer_email,
      'customer_phone', bk.customer_phone,
      'vehicle', bk.vehicle,
      'notes', bk.notes,
      'created_at', bk.created_at,
      'services', coalesce((
        select jsonb_agg(bs.name_snapshot order by bs.name_snapshot)
        from public.booking_services bs where bs.booking_id = bk.id
      ), '[]'::jsonb)
    ) as row
    from public.bookings bk
    where bk.business_id = p_business_id
      and case p_scope
        when 'pending' then bk.status = 'pending' and bk.starts_at > now()
        when 'past' then bk.starts_at <= now() or bk.status not in ('pending', 'confirmed')
        else bk.starts_at > now() and bk.status in ('pending', 'confirmed')
      end
    order by case when p_scope = 'past' then bk.starts_at end desc, bk.starts_at
    limit 200
  ) as x
$$;

-- The signed-in customer's bookings, newest first.
-- Definer so that bookings stay listed even when the business is no longer
-- publicly visible; it only ever returns the caller's own rows.
create or replace function public.my_bookings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', bk.id,
    'status', bk.status,
    'status_reason', bk.status_reason,
    'starts_at', bk.starts_at,
    'ends_at', bk.ends_at,
    'business', jsonb_build_object(
      'name', b.name, 'slug', b.slug, 'city_slug', c.slug, 'phone', b.phone
    ),
    'address', l.address_line,
    'services', coalesce((
      select jsonb_agg(bs.name_snapshot order by bs.name_snapshot)
      from public.booking_services bs where bs.booking_id = bk.id
    ), '[]'::jsonb)
  ) order by bk.starts_at desc), '[]'::jsonb)
  from public.bookings bk
  join public.businesses b on b.id = bk.business_id
  join public.business_locations l on l.id = bk.business_location_id
  join public.cities c on c.id = b.city_id
  where bk.customer_id = auth.uid()
$$;

-- Days off: block whole local days [p_from, p_to] for the primary location.
create or replace function public.add_blocked_days(
  p_business_id uuid,
  p_from date,
  p_to date,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  loc record;
  new_id uuid;
begin
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid range' using errcode = '22023', hint = 'invalid_blocked_range';
  end if;
  select l.id, c.timezone into loc
  from public.business_locations l
  join public.cities c on c.id = l.city_id
  where l.business_id = p_business_id
  order by l.is_primary desc, l.created_at
  limit 1;
  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.blocked_periods (business_location_id, starts_at, ends_at, reason)
  values (
    loc.id,
    p_from::timestamp at time zone loc.timezone,
    (p_to + 1)::timestamp at time zone loc.timezone,
    nullif(btrim(p_reason), '')
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.business_blocked_days(p_business_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', bp.id,
    'from', (bp.starts_at at time zone c.timezone)::date,
    'to', ((bp.ends_at at time zone c.timezone) - interval '1 second')::date,
    'reason', bp.reason
  ) order by bp.starts_at), '[]'::jsonb)
  from public.blocked_periods bp
  join public.business_locations l on l.id = bp.business_location_id
  join public.cities c on c.id = l.city_id
  where l.business_id = p_business_id and bp.ends_at > now()
$$;

-- Grants ------------------------------------------------------------------------------

revoke execute on function
  public.booking_open(uuid),
  public.booking_duration(uuid, uuid[]),
  public.available_slots(uuid, date, uuid[]),
  public.booking_options(text, text),
  public.create_booking(uuid, uuid[], timestamptz, text, text, jsonb, text),
  public.booking_notice(uuid),
  public.set_booking_status(uuid, public.booking_status, text),
  public.cancel_my_booking(uuid, text),
  public.business_bookings(uuid, text),
  public.my_bookings(),
  public.add_blocked_days(uuid, date, date, text),
  public.business_blocked_days(uuid)
from public, anon, authenticated;

grant execute on function
  public.available_slots(uuid, date, uuid[]),
  public.booking_options(text, text)
to anon, authenticated;

grant execute on function
  public.create_booking(uuid, uuid[], timestamptz, text, text, jsonb, text),
  public.set_booking_status(uuid, public.booking_status, text),
  public.cancel_my_booking(uuid, text),
  public.business_bookings(uuid, text),
  public.my_bookings(),
  public.add_blocked_days(uuid, date, date, text),
  public.business_blocked_days(uuid)
to authenticated;

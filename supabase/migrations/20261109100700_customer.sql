-- Customer-facing data: favorites, reviews, inquiries, notifications and
-- anonymous profile analytics events.

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

-- Reviews are only accepted for completed bookings (verified reviews) and are
-- not shown until moderation ships. No fabricated ratings, ever.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  status public.review_status not null default 'pending',
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_business_published_idx on public.reviews (business_id, created_at desc)
  where status = 'published' and deleted_at is null;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email extensions.citext not null check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 32),
  message text not null check (char_length(message) between 5 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index inquiries_business_idx on public.inquiries (business_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- Aggregate-only analytics: no IP, no user id, no location.
create table public.business_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type public.business_event_type not null,
  occurred_at timestamptz not null default now()
);

create index business_events_business_idx on public.business_events (business_id, occurred_at desc);

create or replace function public.track_business_event(p_business_id uuid, p_type public.business_event_type)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_publicly_visible(p_business_id) then
    insert into public.business_events (business_id, type) values (p_business_id, p_type);
  end if;
end;
$$;

grant execute on function public.track_business_event(uuid, public.business_event_type) to anon, authenticated;

-- RLS --------------------------------------------------------------------------

alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.inquiries enable row level security;
alter table public.notifications enable row level security;
alter table public.business_events enable row level security;

create policy "favorites: own" on public.favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_publicly_visible(business_id));

create policy "reviews: public read published" on public.reviews
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null and public.is_publicly_visible(business_id));
create policy "reviews: author reads own" on public.reviews
  for select to authenticated using (user_id = auth.uid());
create policy "reviews: members read" on public.reviews
  for select to authenticated using (public.has_business_role(business_id, 'staff'));
create policy "reviews: staff moderate" on public.reviews
  for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "reviews: author creates for own completed booking" on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.business_id = reviews.business_id
        and b.customer_id = auth.uid()
        and b.status = 'completed'
    )
  );

create policy "inquiries: anyone can send to visible business" on public.inquiries
  for insert to anon, authenticated
  with check (
    public.is_publicly_visible(business_id)
    and (user_id is null or user_id = auth.uid())
    and read_at is null
  );
create policy "inquiries: members read" on public.inquiries
  for select to authenticated using (public.has_business_role(business_id, 'staff'));
create policy "inquiries: members mark read" on public.inquiries
  for update to authenticated
  using (public.has_business_role(business_id, 'staff'))
  with check (public.has_business_role(business_id, 'staff'));
revoke update on public.inquiries from anon, authenticated;
grant update (read_at) on public.inquiries to authenticated;
revoke delete on public.inquiries from anon, authenticated;

create policy "notifications: own read" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "business_events: members read" on public.business_events
  for select to authenticated using (public.has_business_role(business_id, 'staff') or public.is_platform_staff());
revoke insert, update, delete on public.business_events from anon, authenticated;
revoke all on public.favorites, public.notifications from anon;

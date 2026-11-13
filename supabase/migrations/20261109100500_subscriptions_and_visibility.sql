-- Subscription plans, entitlements, Stripe state, and public visibility rules.
--
-- Subscription/payment rows are written ONLY by the service role (verified
-- Stripe webhooks). There are deliberately no insert/update policies for
-- end users, so payment state cannot be forged from the browser.

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'EUR',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  stripe_price_id text unique,
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  placement_weight integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();
create trigger subscription_plans_audit
  after insert or update or delete on public.subscription_plans
  for each row execute function public.audit_row_change();

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  feature_key text not null check (feature_key in (
    'max_services', 'max_images', 'online_booking', 'extended_stats',
    'priority_placement', 'enhanced_profile', 'max_locations', 'max_team_members'
  )),
  enabled boolean not null default true,
  limit_value integer check (limit_value >= 0),
  unique (plan_id, feature_key)
);

comment on column public.plan_features.limit_value is 'NULL means unlimited when enabled.';

create trigger plan_features_audit
  after insert or update or delete on public.plan_features
  for each row execute function public.audit_row_change();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_business_idx on public.subscriptions (business_id, created_at desc);
-- At most one live subscription per business.
create unique index subscriptions_one_live_uidx on public.subscriptions (business_id)
  where status in ('trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete');

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  stripe_invoice_id text unique,
  amount_cents integer not null,
  currency char(3) not null default 'EUR',
  status text not null check (status in ('draft', 'open', 'paid', 'uncollectible', 'void', 'failed')),
  hosted_invoice_url text,
  invoice_pdf_url text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_business_idx on public.payments (business_id, created_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  error text,
  unique (provider, event_id)
);

create index webhook_events_unprocessed_idx on public.webhook_events (received_at)
  where processed_at is null;

-- Entitlements -------------------------------------------------------------------

-- The plan currently granting features to a business (live subscription).
create or replace function public.business_active_plan_id(p_business_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan_id
  from public.subscriptions s
  where s.business_id = p_business_id
    and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc
  limit 1
$$;

create or replace function public.business_has_feature(p_business_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pf.enabled
    from public.plan_features pf
    where pf.plan_id = public.business_active_plan_id(p_business_id)
      and pf.feature_key = p_feature
  ), false)
$$;

-- Returns NULL for unlimited, 0 when the feature is unavailable.
create or replace function public.business_feature_limit(p_business_id uuid, p_feature text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when pf.id is null or not pf.enabled then 0
    else pf.limit_value
  end
  from (select 1) as dummy
  left join public.plan_features pf
    on pf.plan_id = public.business_active_plan_id(p_business_id)
   and pf.feature_key = p_feature
$$;

-- Enforce plan limits in the database so they hold regardless of client.
create or replace function public.enforce_business_service_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_allowed integer;
  current_count integer;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  -- Demo data and service-role maintenance are exempt.
  if auth.uid() is null or exists (select 1 from public.businesses where id = new.business_id and is_demo) then
    return new;
  end if;

  max_allowed := public.business_feature_limit(new.business_id, 'max_services');
  if max_allowed is null then
    return new;
  end if;

  select count(*) into current_count
  from public.business_services
  where business_id = new.business_id and deleted_at is null and id <> new.id;

  if current_count >= max_allowed then
    raise exception 'plan limit reached: max_services = %', max_allowed using errcode = 'P0001', hint = 'upgrade_required';
  end if;
  return new;
end;
$$;

create trigger business_services_enforce_limit
  before insert or update of deleted_at on public.business_services
  for each row execute function public.enforce_business_service_limit();

create or replace function public.enforce_business_media_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_allowed integer;
  current_count integer;
begin
  if new.deleted_at is not null or new.kind = 'logo' then
    return new;
  end if;
  if auth.uid() is null or exists (select 1 from public.businesses where id = new.business_id and is_demo) then
    return new;
  end if;

  max_allowed := public.business_feature_limit(new.business_id, 'max_images');
  if max_allowed is null then
    return new;
  end if;

  select count(*) into current_count
  from public.business_media
  where business_id = new.business_id and kind <> 'logo' and deleted_at is null and id <> new.id;

  if current_count >= max_allowed then
    raise exception 'plan limit reached: max_images = %', max_allowed using errcode = 'P0001', hint = 'upgrade_required';
  end if;
  return new;
end;
$$;

create trigger business_media_enforce_limit
  before insert or update of deleted_at on public.business_media
  for each row execute function public.enforce_business_media_limit();

create or replace function public.enforce_booking_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_enabled
     and not coalesce(old.booking_enabled, false)
     and auth.uid() is not null
     and not new.is_demo
     and not public.business_has_feature(new.id, 'online_booking') then
    raise exception 'plan does not include online booking' using errcode = 'P0001', hint = 'upgrade_required';
  end if;
  return new;
end;
$$;

create trigger businesses_enforce_booking_entitlement
  before insert or update of booking_enabled on public.businesses
  for each row execute function public.enforce_booking_entitlement();

-- Public visibility --------------------------------------------------------------

-- A business is public when approved, not deleted, and either paying or demo.
-- Approval and subscription are independent states (see PROJECT_SPEC.md §9).
create or replace function public.is_publicly_visible(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.status = 'approved'
      and b.deleted_at is null
      and (b.is_demo or public.business_active_plan_id(b.id) is not null)
  )
$$;

create policy "businesses: public read visible" on public.businesses
  for select to anon, authenticated using (public.is_publicly_visible(id));

create policy "locations: public read visible" on public.business_locations
  for select to anon, authenticated using (public.is_publicly_visible(business_id));

create policy "service_areas: public read visible" on public.service_areas
  for select to anon, authenticated
  using (public.is_publicly_visible(public.location_business_id(business_location_id)));

create policy "hours: public read visible" on public.business_hours
  for select to anon, authenticated
  using (public.is_publicly_visible(public.location_business_id(business_location_id)));

create policy "business_categories: public read visible" on public.business_categories
  for select to anon, authenticated using (public.is_publicly_visible(business_id));

create policy "business_services: public read visible" on public.business_services
  for select to anon, authenticated
  using (public.is_publicly_visible(business_id) and is_active and deleted_at is null);

create policy "business_media: public read visible" on public.business_media
  for select to anon, authenticated
  using (public.is_publicly_visible(business_id) and deleted_at is null);

-- RLS: billing ----------------------------------------------------------------------

alter table public.subscription_plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

create policy "plans: public read active" on public.subscription_plans
  for select to anon, authenticated using (is_active or public.is_platform_staff());
create policy "plans: admins manage" on public.subscription_plans
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "plan_features: public read" on public.plan_features
  for select to anon, authenticated using (true);
create policy "plan_features: admins manage" on public.plan_features
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "subscriptions: members read" on public.subscriptions
  for select to authenticated using (public.has_business_role(business_id, 'manager') or public.is_platform_staff());

create policy "payments: owners read" on public.payments
  for select to authenticated using (public.has_business_role(business_id, 'owner') or public.is_platform_admin());

-- No user-facing write paths: only service_role (bypasses RLS) writes these.
revoke insert, update, delete on public.subscriptions, public.payments, public.webhook_events from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke insert, update, delete on public.subscription_plans, public.plan_features from anon;

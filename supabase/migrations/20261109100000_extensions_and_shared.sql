-- Extensions, shared enums and helper functions.
-- On Supabase, extensions live in the `extensions` schema.

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Enums ---------------------------------------------------------------------

create type public.platform_role as enum ('moderator', 'super_admin');

-- Declared lowest → highest so `role >= 'manager'` expresses the hierarchy.
create type public.business_role as enum ('staff', 'manager', 'owner');

create type public.business_status as enum (
  'draft', 'pending_review', 'approved', 'rejected', 'suspended'
);

-- Mirrors Stripe subscription statuses.
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete',
  'incomplete_expired', 'unpaid', 'paused'
);

create type public.booking_status as enum (
  'pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'
);

create type public.media_kind as enum ('logo', 'cover', 'gallery');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.review_status as enum ('pending', 'published', 'hidden');
create type public.category_kind as enum ('business', 'roadside');
create type public.current_type as enum ('AC', 'DC');
create type public.business_event_type as enum (
  'profile_view', 'phone_click', 'website_click', 'email_click', 'directions_click', 'booking_cta'
);

-- updated_at trigger ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Slug helper using the official Bulgarian transliteration (2009 law):
-- ж→zh, ц→ts, ч→ch, ш→sh, щ→sht, ъ→a, ь→y, ю→yu, я→ya.
-- Upper-case Cyrillic is mapped explicitly so the result does not depend on
-- the database collation.
create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(
        lower(translate(
          value,
          'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ',
          'абвгдежзийклмнопрстуфхцчшщъьюя'
        )),
        'щ', 'sht'), 'ж', 'zh'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'), 'ю', 'yu'), 'я', 'ya'),
      'абвгдезийклмнопрстуфхъь',
      'abvgdeziyklmnoprstufhay'
    ),
    '[^a-z0-9]+', '-', 'g'
  ))
$$;

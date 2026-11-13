# Database Schema

PostgreSQL 15+ (Supabase) with `postgis`, `btree_gist`, `citext`, `pgcrypto`.
All schema changes go through `supabase/migrations/*.sql`. This document
describes the target schema; the migrations are the source of truth.

## Conventions

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`, `updated_at` maintained by
  trigger `set_updated_at()`.
- Soft delete via `deleted_at timestamptz` on user-generated content
  (businesses, services, media, reviews). Hard delete for join tables.
- Money as `integer` minor units (`price_cents`) + `currency char(3)` (`EUR`).
- Enums as Postgres enums for stable sets, lookup tables for admin-editable
  sets (categories, service types, cities).
- Every table has RLS **enabled**. Policies listed per table.
- Timezone: stored as `timestamptz`; local business time interpreted with
  `cities.timezone` (default `Europe/Sofia`).

## Enums

| Enum | Values |
| --- | --- |
| `platform_role` | `moderator`, `super_admin` |
| `business_role` | `owner`, `manager`, `staff` |
| `business_status` | `draft`, `pending_review`, `approved`, `rejected`, `suspended` |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid`, `paused` (mirrors Stripe) |
| `booking_status` | `pending`, `confirmed`, `rejected`, `cancelled`, `completed`, `no_show` |
| `media_kind` | `logo`, `cover`, `gallery` |
| `report_status` | `open`, `reviewing`, `resolved`, `dismissed` |
| `current_type` | `AC`, `DC` |

## Identity

**profiles** — 1:1 with `auth.users`. `id (= auth.users.id)`, `full_name`,
`phone`, `avatar_url`, `locale`, `is_suspended`, `marketing_consent_at`,
`deleted_at`. Created by trigger on `auth.users` insert.
RLS: user reads/updates own row (cannot change `is_suspended`); staff read all.

**user_roles** — `user_id`, `role platform_role`, `granted_by`, unique
`(user_id, role)`. RLS: user reads own; only `super_admin` writes.

**business_members** — `business_id`, `user_id`, `role business_role`,
`invited_by`, `accepted_at`, unique `(business_id, user_id)`.
RLS: members of the business read; owners manage; managers may add `staff`.

**business_invitations** — `business_id`, `email citext`, `role`,
`token_hash`, `expires_at`, `accepted_at`. (Supports team invites.)

## Geography

**countries** — `code char(2) pk` (`BG`), `name`, `default_timezone`.
**cities** — `country_code`, `name`, `name_en`, `slug unique`, `center geography(Point)`,
`default_radius_km`, `timezone`, `is_active`, `launch_order`.
Public read for active cities; admins write.

**business_locations** — `business_id`, `city_id`, `name`, `address_line`,
`postal_code`, `location geography(Point) not null`, `is_primary`,
`capacity smallint default 1` (parallel booking bays),
`coverage_radius_km numeric` (roadside), `is_24_7 boolean`.
GiST index on `location`. Public read when the business is publicly visible.

**service_areas** — `business_location_id`, `city_id null`, `area geography(Polygon) null`,
check: one of the two is set. Roadside coverage definitions.

## Businesses

**categories** — `slug unique`, `name`, `name_en`, `description`, `icon`,
`sort_order`, `is_active`, `kind` (`business` | `roadside`).
**services** — service *types* per category: `category_id`, `slug`, `name`,
`name_en`, `is_active`. Unique `(category_id, slug)`.

**businesses** — `slug`, `city_id` (primary city for URL), `primary_category_id`,
`name`, `description`, `phone`, `email`, `website`, `social_links jsonb`,
`status business_status`, `is_verified`, `booking_enabled`,
`booking_auto_confirm`, `booking_slot_minutes`, `booking_buffer_minutes`,
`booking_lead_hours`, `booking_horizon_days`, `is_demo`, `approved_at`,
`approved_by`, `rejection_reason`, `deleted_at`.
Unique `(city_id, slug)`. Public read when `is_publicly_visible(id)`:
`status = approved` **and** active subscription (or demo) **and** not deleted.

**business_categories** — additional categories (`business_id`, `category_id`).

**business_services** — offered services: `business_id`, `service_id null`
(link to type), `name`, `description`, `price_from_cents`, `price_to_cents`,
`currency`, `duration_minutes`, `is_bookable`, `is_active`, `sort_order`,
`deleted_at`. Trigger enforces plan limit `max_services`.

**business_hours** — `business_location_id`, `weekday 1-7 (ISO, Mon=1…Sun=7)`,
`opens_at time`, `closes_at time`, multiple intervals per day allowed.
`hours_verified_at` on the location says whether "open now" may be shown.

**business_media** — `business_id`, `kind media_kind`, `storage_path`,
`alt_text`, `width`, `height`, `sort_order`, `deleted_at`.
Trigger enforces plan limit `max_images`.

## Subscriptions

**subscription_plans** — `code unique` (`starter`, `professional`, `premium`),
`name`, `price_cents`, `currency`, `interval` (`month`), `stripe_price_id`,
`trial_days`, `is_active`, `sort_order`.
**plan_features** — `plan_id`, `feature_key` (`max_services`, `max_images`,
`online_booking`, `extended_stats`, `priority_placement`, `enhanced_profile`),
`enabled`, `limit_value int null` (null = unlimited). Unique `(plan_id, feature_key)`.
**subscriptions** — `business_id`, `plan_id`, `status`, `stripe_customer_id`,
`stripe_subscription_id unique`, `current_period_start/end`,
`cancel_at_period_end`, `canceled_at`, `trial_end`. Written only by the
service role (webhook). Members read their own business's rows.
**payments** — `business_id`, `subscription_id`, `stripe_invoice_id unique`,
`amount_cents`, `currency`, `status`, `paid_at`, `hosted_invoice_url`.
**webhook_events** — `provider`, `event_id unique`, `type`, `payload jsonb`,
`received_at`, `processed_at`, `error`. Service role only.

## Bookings

**availability_rules** — `business_location_id`, `weekday`, `start_time`,
`end_time`, `slot_minutes null` (override). If absent, `business_hours` apply.
**blocked_periods** — `business_location_id`, `period tstzrange`, `reason`.
**bookings** — `business_id`, `business_location_id`, `bay_number smallint`,
`customer_id null` (guest bookings allowed), `customer_name`, `customer_email`,
`customer_phone`, `vehicle jsonb` (make, model, year, plate — optional),
`notes`, `starts_at`, `ends_at`, `buffer_minutes`, `status booking_status`,
`status_changed_at`, `status_reason`.
`occupied_until = ends_at + buffer` (stored; `timestamptz + interval` is not
immutable, so it cannot be a generated column).
**Exclusion constraint** `bookings_no_overlap`: `EXCLUDE USING gist (business_location_id WITH =, bay_number WITH =, tstzrange(starts_at, occupied_until, '[)') WITH &&) WHERE (status IN ('pending','confirmed'))`.
**booking_services** — `booking_id`, `business_service_id`, `price_cents_snapshot`, `name_snapshot`.

## Customer

**favorites** — `user_id`, `business_id`, unique pair. Own rows only.
**reviews** — `business_id`, `user_id`, `booking_id null`, `rating 1–5`,
`body`, `status` (`pending`, `published`, `hidden`), `deleted_at`. Created only
for completed bookings (verified reviews). Not exposed until moderation flow
ships.
**inquiries** — contact form messages to a business; members read.
**notifications** — `user_id`, `type`, `payload`, `read_at`.
**business_events** — analytics counters: `business_id`, `type`
(`profile_view`, `phone_click`, `website_click`, `booking_cta`), `occurred_at`,
no personal data. Insert via rate-limited RPC.

## EV charging

**charging_data_sources** — `code unique` (`open_charge_map`), `name`,
`attribution`, `license`, `website`, `last_import_at`, `last_import_status`.
**charging_stations** — `source_id`, `external_id`, unique `(source_id, external_id)`,
`name`, `operator`, `address`, `city_id null`, `location geography(Point)`,
`usage_type`, `opening_hours`, `pricing_text`, `num_points`, `max_power_kw`,
`has_dc`, `has_ac`, `status_text`, `source_updated_at`, `imported_at`,
`raw jsonb`, `duplicate_of uuid null`, `is_hidden`.
**charging_connectors** — `station_id`, `connector_type` (normalised:
`ccs2`, `type2`, `chademo`, `type1`, `tesla`, `schuko`, `other`),
`current_type`, `power_kw`, `quantity`.

## System

**audit_logs** — `actor_id`, `action`, `entity_type`, `entity_id`, `before
jsonb`, `after jsonb`, `ip inet`, `created_at`. Insert-only; admins read.
**reports** — `reporter_id null`, `entity_type`, `entity_id`, `reason`,
`details`, `status report_status`, `resolved_by`, `resolved_at`.
**platform_settings** — `key text pk`, `value jsonb`, `updated_by`.

## Implemented privilege model (Phase 2)

- Column-level grants stop end users from writing moderation fields:
  `businesses.status / is_verified / is_demo / approved_* / created_by`,
  `profiles.is_suspended`, and all of `subscriptions`, `payments`,
  `webhook_events`, `audit_logs`, `bookings` (writes via functions only).
- Moderation goes through `admin_set_business_status()` and
  `admin_set_business_verified()` (staff only, audited); owners use
  `submit_business_for_review()`.
- Plan limits are enforced by triggers (`max_services`, `max_images`,
  `online_booking`) using `business_feature_limit()` / `business_has_feature()`.
- Admin-managed tables (`cities`, `categories`, `services`, `subscription_plans`,
  `plan_features`, `platform_settings`, `user_roles`, `business_members`) are
  audited by the `audit_row_change()` trigger.
- Tests: `supabase/tests/10_rls_and_integrity.sql` (41 assertions),
  `30_dashboard.sql` (20 assertions), `40_media_team.sql` (24 assertions).
- Draft period: before a subscription exists, limits fall back to the entry
  plan (Starter) so a business can prepare its profile. Visibility and
  on/off features (online booking) still require a live subscription.
- Additional limits: `max_locations`, `max_team_members` (members + open
  invitations), max 5 businesses per account.

## Key SQL functions

| Function | Purpose |
| --- | --- |
| `is_platform_admin()`, `is_platform_staff()` | RLS helpers |
| `has_business_role(business_id, min_role)` | RLS helper, role hierarchy owner > manager > staff |
| `is_publicly_visible(business_id)` | approval + subscription + soft delete |
| `business_has_feature(business_id, key)` / `business_feature_limit(...)` | entitlements |
| `search_businesses(...)` | geo + filters + pagination (Phase 3) |
| `create_business(...)`, `update_business_location(...)`, `set_location_hours(...)` | dashboard writes, SECURITY INVOKER (RLS applies), atomic |
| `my_businesses()`, `dashboard_business(id)` | dashboard reads (members only via RLS) |
| `register_business_media(business, path, kind, w, h, alt)`, `move_business_media(id, dir)` | photos, SECURITY INVOKER; path must be `{business_id}/{uuid}.{ext}` and already uploaded; logo/cover replace the previous one (soft delete) |
| `business_team(id)` | members (+ e-mails and open invitations for managers), DEFINER, members only |
| `invitation_preview(token)`, `accept_business_invitation(token)` | DEFINER; token stored only as SHA-256; must be signed in with the invited e-mail; one use, 7 days |
| `roadside_providers_for_point(lat, lng, service_slug)` | coverage lookup (Phase 5) |
| `booking_options(city_slug, slug)`, `available_slots(business_id, date, service_ids)` | public; slots from availability_rules (else business_hours, 24/7 = whole day), step `booking_slot_minutes`, duration = sum of service durations, minus lead time, horizon, blocked periods and full bays; NULL unless `booking_open()` (enabled, not demo, visible, `online_booking` feature) |
| `create_booking(business, service_ids, starts_at, name, phone, vehicle, notes)` | DEFINER, signed-in customers only (no guest bookings); re-checks the slot under a per-location advisory lock, assigns the first free bay, max 3 upcoming per customer and business; status `confirmed` when auto-confirm is on, else `pending` |
| `set_booking_status(id, status, reason)` | staff+; pending → confirmed/rejected/cancelled, confirmed → cancelled, or completed/no_show once started |
| `cancel_my_booking(id, reason)` | customer cancels own upcoming pending/confirmed booking |
| `business_bookings(id, scope)`, `my_bookings()` | dashboard list (upcoming/pending/past, RLS) and customer list |
| `add_blocked_days(id, from, to, reason)`, `business_blocked_days(id)` | whole local days off for the primary location (managers via RLS) |

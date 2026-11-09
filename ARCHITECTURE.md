# Architecture

Status: living document. Every major decision is recorded here as an ADR-style
entry *before* it is implemented. See `DEVELOPMENT_LOG.md` for chronology.

## 1. System overview

```
Browser ──► Vercel (Next.js 16 App Router)
              │  Server Components (default), Route Handlers, Server Actions
              │  proxy.ts → refreshes Supabase session cookie, optimistic redirects
              │
              ├──► Supabase Postgres + PostGIS  (RLS on every table)
              ├──► Supabase Auth                 (email/password, verification, reset)
              ├──► Supabase Storage              (business logos/media, RLS by membership)
              ├──► Stripe Billing                (hosted Checkout + Customer Portal + webhooks)
              ├──► Resend                        (transactional email)
              ├──► Open Charge Map API           (server-side import job only)
              ├──► Map tiles / geocoding         (MapLibre GL + configurable provider)
              └──► Sentry                        (errors, server + client)
```

## 2. Repository layout

```
src/
  app/                      Routes only. Thin: compose features, no business logic.
    (public)/               Marketing, search, profiles, SEO landing pages, EV map
    (auth)/                 Login, register, reset password, verify
    dashboard/              Business dashboard (members only)
    admin/                  Admin panel (moderator / super_admin)
    api/                    Route handlers: webhooks, cron, public JSON
  components/
    ui/                     shadcn/ui primitives (owned source, restyled with tokens)
    layout/                 Header, footer, containers, page shells
    brand/                  Logo and brand marks
  features/<domain>/        Domain modules: queries (server), actions, zod schemas,
                            domain components. e.g. businesses, search, bookings,
                            billing, roadside, charging, admin, auth.
  lib/
    env/                    Zod-validated environment (server vs public split)
    supabase/               Browser, server and admin (service-role) clients
    utils.ts                cn() and tiny helpers
  config/                   Site config, navigation, static enums
supabase/
  migrations/               Timestamped SQL migrations (only way to change schema)
  seed.sql                  Demo data (Varna), clearly flagged `is_demo = true`
  tests/                    pgTAP RLS / constraint tests
```

Rules: no giant files; `app/` files import from `features/`; database access
only through `features/*/queries.ts` or `server` helpers marked `server-only`.

## 3. Decisions

### ADR-001 Next.js 16 with Cache Components
The scaffold enables `cacheComponents`. Public, non-personalised data (cities,
categories, business profiles, SEO pages, charging stations) is read in
`'use cache'` functions tagged with `cacheTag()` and invalidated with
`revalidateTag()`/`updateTag()` after writes. Anything that reads cookies
(auth state, dashboards) renders inside `<Suspense>` so the static shell stays
fast. Next 16 renames Middleware to **Proxy** (`src/proxy.ts`).

### ADR-002 Supabase for data, auth, storage
Postgres + PostGIS gives real geographic queries; RLS gives tenant isolation
at the database; Auth and Storage share the same policy model. Clients:
- `lib/supabase/client.ts` — browser, anon key, RLS applies.
- `lib/supabase/server.ts` — server, anon key + user cookies, RLS applies.
- `lib/supabase/admin.ts` — service role, `server-only`, used only for
  webhooks, cron imports and audited admin operations. Never imported by
  client code (enforced by `server-only`).

### ADR-003 Authorization model
- Platform roles in `user_roles` (`moderator`, `super_admin`; everyone is a
  customer implicitly). Only a `super_admin` can grant roles; there is no
  insert policy for normal users, so self-escalation is impossible.
- Business roles in `business_members` (`owner`, `manager`, `staff`).
- RLS helper functions (`SECURITY DEFINER`, fixed `search_path`):
  `is_platform_admin()`, `is_platform_staff()`, `has_business_role(business_id, min_role)`.
- Server code re-checks authorization (defence in depth), never trusts the client.

### ADR-004 Geography
`geography(Point, 4326)` columns with GiST indexes on `business_locations`,
`cities` and `charging_stations`. Distance filters use `ST_DWithin`, sorting
uses `<->`/`ST_Distance`. Search is a single SQL function
`search_businesses(...)` called via RPC so filtering, distance and pagination
happen in one round trip.

### ADR-005 Roadside coverage
A provider location serves a point when **any** of: (a) the point is within
`coverage_radius_km` of the base location, (b) the point is inside one of its
`service_areas` polygons, (c) the point's city is listed as a covered city.
Implemented in SQL (`roadside_providers_for_point`).

### ADR-006 Booking integrity
Each location defines `capacity` (parallel bays). A booking occupies
`(location_id, bay_number, tstzrange(start, end + buffer))`. A `btree_gist`
**exclusion constraint** forbids overlapping ranges on the same bay for active
statuses (`pending`, `confirmed`). Booking creation goes through a
`create_booking()` SQL function that validates hours/blocked periods and picks
a free bay inside one transaction. Concurrency is therefore safe even under
races.

### ADR-007 Payments: Stripe Billing
Stripe operates in Bulgaria and supports EUR subscriptions (Bulgaria adopted
the euro on 2026-01-01; the BGN/EUR dual price display obligation ended on
2026-08-08). Hosted Checkout + Customer Portal mean no card data touches our
servers. Webhooks are signature-verified, stored in `webhook_events` keyed by
the Stripe event id (idempotency), and are the **only** writer of subscription
state. Plan ↔ Stripe price mapping lives in `subscription_plans`. Alternatives
reviewed for fallback: Paddle (merchant of record), local acquirers (myPOS,
Borica) — documented in `ROADMAP.md`.

### ADR-008 Entitlements
`plan_features (plan_id, feature_key, limit_value, enabled)`. A single module
`features/billing/entitlements.ts` exposes `getEntitlements(businessId)` and
`assertEntitlement(...)`. SQL mirrors it in `business_has_feature()` so RLS and
triggers enforce limits (e.g. max images, max services) server-side.

### ADR-009 Maps
MapLibre GL JS (open source, no vendor lock-in) with a configurable style URL
(`NEXT_PUBLIC_MAP_STYLE_URL`). Development default: OpenFreeMap (no key).
Production: MapTiler or Mapbox style URLs. Maps are lazy-loaded client
components. Geocoding goes through a server-side provider interface so the
provider can change (Nominatim is not suitable for production autocomplete
per its usage policy).

### ADR-010 EV charging data
A provider interface (`ChargingDataProvider`) with an Open Charge Map
implementation. A protected cron route (`/api/cron/charging-import`, Vercel
Cron, `CRON_SECRET`) imports Bulgarian stations (country code BG) into
`charging_stations` / `charging_connectors`, recording source, external id and
`source_updated_at`. Pages only read our DB, never call OCM per render.
Attribution (CC BY 4.0 + provider attribution) shown on the map and station
panel. Duplicates across sources are flagged by proximity (< 30 m) for admin
review.

### ADR-011 Rate limiting
Sensitive endpoints (auth, booking creation, inquiries, geocoding) are rate
limited through a small `RateLimiter` interface. Production implementation:
Upstash Redis (serverless-friendly). Development: in-memory.

### ADR-012 Email and monitoring
Resend for transactional mail (booking created/status change, membership
invites). Supabase Auth emails use custom SMTP via Resend in production.
Sentry (`@sentry/nextjs`) added in Phase 8 hardening; DSN optional in dev.

### ADR-013 Internationalisation
UI copy is Bulgarian-first (target market) with English identifiers. Copy
lives in components for now; extraction to message catalogues is a planned
step before adding a second UI language.

## 4. Caching strategy

| Data | Mechanism | Invalidation |
| --- | --- | --- |
| Cities, categories, plans | `'use cache'` + `cacheLife('hours')` | `revalidateTag('cities')` etc. on admin edit |
| Business profile | `'use cache'` tag `business:{id}` | on profile/service/media edit |
| Search results | dynamic (depends on params), DB-side indexes | — |
| Charging stations | `'use cache'` tag `charging` | after import job |
| Auth / dashboards | request-time inside `<Suspense>` | — |

## 5. Environments

`local` (Supabase CLI), `preview` (Vercel previews + Supabase branch or staging
project), `production`. See `.env.example` and `docs/setup/*`.

Free tiers are fine for development only: Vercel Hobby forbids commercial use
and Supabase Free pauses inactive projects and has no point-in-time recovery.
Production needs Vercel Pro and Supabase Pro (daily backups, PITR add-on).

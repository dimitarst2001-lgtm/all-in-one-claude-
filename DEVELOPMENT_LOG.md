# Development Log

Newest entries first. Each entry records what changed, how it was verified and
what is still open. Nothing is listed as done without verification evidence.

---

## 2026-11-13 — Phase 5 part 3 (EV charging)

- Migration `20261116100000_charging_engine.sql`: `charging_import`,
  `charging_import_failed` (service role only), `charging_stations_search`
  (anon, RLS applies).
- Import: `src/features/charging/import.ts` (`ChargingDataProvider`, Open
  Charge Map provider: `countrycode=BG`, `compact=false`, key in
  `X-API-Key`), `ocm.ts` normaliser (connection type ids and titles →
  `ccs2/type2/chademo/...`, current type → AC/DC, usage type → public).
  `/api/cron/charging-import` requires `Authorization: Bearer $CRON_SECRET`
  (constant-time compare) and returns 503 when keys are missing.
  `vercel.json` runs it daily at 02:00 UTC. Pages never call the provider.
- `/charging`: filters (city or "near me" rounded to ~100 m, radius,
  connector, minimum power, DC only), MapLibre map + station cards
  (connectors, power, status/access/price as given by the source, directions,
  source link), "no real-time availability" note, attribution with licence
  and last import date. Linked from navigation, home categories, EV section
  and sitemap.

Verified: `pnpm db:test` (new 70_charging: permissions, idempotent re-import,
connector replacement, derived fields, city assignment, filters, hidden
stations, truncated-batch guard, failure status) · unit tests 48/48 (OCM
normaliser, params) · typecheck, lint, build · Playwright against the shim
with 3 sample stations: filters (power + DC, CHAdeMO), empty city, 390 px
and 1280 px · cron route: 503 without config, 401 with a wrong secret.
Not verified: a real Open Charge Map response (host blocked in the sandbox).

---

## 2026-11-13 — Phase 5 part 2 (roadside assistance)

- Migration `20261115100000_roadside.sql`: `roadside_providers_for_point`
  (public, SECURITY INVOKER so RLS keeps hidden businesses out; coverage =
  polygon, radius around the base, or a whole city as centre +
  `default_radius_km`; 24/7 or open-now first, then distance),
  `location_coverage_cities`, `set_location_coverage_cities` (managers, active
  cities only, max 20, polygons untouched).
- `/roadside`: problem picker, "use my location" only after a click (rounded
  to ~100 m, not stored) or a city, provider cards with coverage, distance,
  services, direct call. A call is not an order: no requests, ETA or
  tracking. Demo listings show no call button (their numbers are not real).
  112 notice for accidents. Navigation, home CTA and sitemap point here.
- Dashboard `Адрес`: roadside businesses pick whole cities they cover, next to
  the existing radius.

Verified: `pnpm db:test` (new 60_roadside: demo coverage, service filter,
radius vs. Dobrich, unpaid businesses hidden, city coverage add/remove,
strangers and anon refused) · typecheck, lint, unit tests (+3) · build ·
Playwright against the shim: geolocation search (390 px), city search
(1280 px), coverage cities saved and reloaded. Only console errors are map
tiles blocked by the sandbox.

Open: EV charging import job and map.

---

## 2026-11-13 — Phase 5 part 1 (online bookings)

- Migration `20261114100000_booking_engine.sql`: `booking_open`,
  `booking_duration`, `available_slots`, `booking_options`, `create_booking`
  (advisory lock + bay assignment, exclusion constraint as backstop),
  `booking_notice`, `set_booking_status`, `cancel_my_booking`,
  `business_bookings`, `my_bookings`, `add_blocked_days`,
  `business_blocked_days`. Grants: slots/options to anon, the rest to
  authenticated; `booking_notice` internal.
- Decisions: booking requires sign-in (no guest bookings: less spam, every
  booking appears in "my bookings"); demo listings never accept bookings;
  availability follows business hours unless availability rules exist.
- UI: `/businesses/[city]/[slug]/book` (services, day chips, slot grid,
  contact and optional vehicle), `/account/bookings`, dashboard
  `Резервации` tab (upcoming / pending / history, status actions, settings,
  days off). Services get an "online bookable" switch. The profile's
  "calendar coming soon" text is replaced by a real "Запази час" link.
- E-mails (Resend, best effort): customer on create and on
  confirm/reject/cancel by the business; business on new booking and on
  customer cancellation.
- Also: header and account page link to the dashboard (PR #5).

Verified: `pnpm db:test` (32 new booking assertions: slots, overlap, bays,
lead/horizon, blocked days, 3-booking limit, transitions, access), unit
tests, typecheck, lint, format, build; Playwright on the dev shim: customer
books at 390 px, owner confirms and adds a day off, customer cancels.

Open: online booking cannot be switched on by real businesses until plans can
be bought (Phase 6). Pre-existing dev-only "instant navigation" warnings on
public city/profile pages remain.

---

## 2026-11-09 — Phase 2 (database and authentication)

Database (`supabase/migrations`, 10 files):
- Extensions (PostGIS, btree_gist, citext, pgcrypto) in the `extensions`
  schema, enums, `set_updated_at()`, Bulgarian-transliterating `slugify()`.
- Identity (`profiles` auto-created from `auth.users`, `user_roles`), system
  (`audit_logs`, `platform_settings`, generic audit trigger), geography and
  catalog, businesses (members, invitations, locations with GiST indexes,
  service areas, hours with overlap exclusion, offered services, media),
  subscriptions/entitlements/visibility, bookings (bay-based exclusion
  constraint), customer tables, EV charging, reports, storage bucket and
  policies, final privilege hardening.
- Decisions: column-level grants instead of trusting update policies for
  protected fields; moderation only through audited SECURITY DEFINER RPCs;
  plan limits enforced by triggers; public visibility = approved AND
  (active/trialing/past_due subscription OR demo) AND not deleted.
- Seed: BG + 7 cities (Varna, Sofia, Plovdiv, Veliko Tarnovo active), 5
  categories, 35 service types, 3 plans with features, Open Charge Map source,
  10 demo businesses in Varna (names start with "Демо", phones use the
  invalid "+359 52 000" prefix, e-mails on example.com).

Authentication (`src/features/auth`, `src/app/(auth)`):
- Sign up (customer / business intent, terms consent), sign in, sign out,
  forgot password, reset password, `/auth/confirm` for `token_hash` and PKCE
  links, `/auth/error`, `/account`.
- `getCurrentUser()` DAL verifies the JWT with `getClaims()` and loads roles
  under RLS; suspended users are treated as signed out.
- Proxy redirects anonymous visitors away from `/account`, `/dashboard`,
  `/admin` (optimistic; real checks stay server-side).
- Rate limiting (`src/lib/security/rate-limit.ts`): Upstash Redis REST in
  production, in-memory fallback; open-redirect protection for `?next=`.
- No privileges are ever derived from sign-up metadata (tested).

Verification (2026-11-09):
- `scripts/db-test.sh` on PostgreSQL 16.15 + PostGIS 3 with the Supabase shim:
  all migrations + seed apply cleanly; **41/41** RLS and integrity assertions
  pass (tenant isolation, self-escalation, column protection, forged
  subscriptions, moderation + audit, public visibility, plan limits, storage
  paths, booking overlap/buffer/bay/cancel cases, opening-hour overlaps).
  A deliberately failing test makes the script exit 1.
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ 17/17 · `pnpm build` ✅.
- Browser (iPhone 13): register/login validation errors render with
  accessible wiring; with Supabase unconfigured, actions return a friendly
  "temporarily unavailable" message; no console errors.

Not verified yet: the auth flows against a real Supabase project (the
Supabase API is blocked from the development container). Needs a check on a
Vercel preview with real keys: sign-up e-mail, confirmation link, login,
password reset, logout.

---

## 2026-11-09 — Phase 0 and Phase 1 (foundation)

### Phase 0 — inspection

| Item | Finding |
| --- | --- |
| Repository | `dimitarst2001-lgtm/all-in-one-claude-`, empty (no commits) |
| Framework / dependencies | none |
| Database | none |
| Deployment config | none |
| Environment variables | none |
| Toolchain in dev container | Node 22.23, pnpm 10.28 |

Decision: initialise a fresh Next.js 16.4.5 project (`create-next-app`) with
TypeScript, Tailwind v4, ESLint, App Router, `src/` and the `@/*` alias.

Research notes:
- **Open Charge Map**: data under CC BY 4.0 for user contributions; imported
  third-party data stays under its provider's licence; apps must display data
  provider attribution; API key is mandatory. Source:
  https://openchargemap.org/site/about/terms
- **Stripe** operates in Bulgaria and supports EUR Billing. The BGN/EUR dual
  price display obligation ran 2025-08-08 → 2026-08-08 and has ended.
  Source: https://support.stripe.com/questions/dual-price-indication-requirements-for-customers-in-bulgaria
- **Sandbox limitation**: `ui.shadcn.com` is blocked by the development
  container's network policy, so shadcn/ui components were added as owned
  source files following the shadcn "new-york"/radix conventions, with a
  `components.json` so the CLI works normally on a developer machine.

### Phase 1 — foundation

Implemented:
- Next.js 16.4.5 App Router, React 19.3, TypeScript strict, Tailwind v4,
  Cache Components enabled (see ADR-001).
- Design tokens in `src/app/globals.css` (brand palette, semantic shadcn
  tokens, `surface-dark` and `container-page` utilities). Contrast decision:
  filled buttons and link text use `#1565C0`; `#2196F3` is reserved for
  accents, icons and focus rings (white on `#2196F3` is only 3.1:1).
- shadcn/ui primitives: button, badge, card, input, label, separator, sheet,
  skeleton.
- Brand logo mark, dark navy sticky header, mobile navigation sheet, footer
  with legal links and env-driven contact details.
- Homepage (static marketing version), `/for-businesses` with plan previews,
  legal drafts (`/privacy`, `/terms`, `/cookies`) with a public "pending legal
  review" notice, 404 and error boundary.
- Supabase clients: browser, server (cookies), service role (`server-only`),
  and `src/proxy.ts` session refresh with CDN cache-header forwarding.
- Zod-validated env split into public and server modules; integrations fail
  with a clear `MissingConfigError` when used unconfigured. `.env.example`.
- Vitest set up with 7 env validation tests.

Deliberately not in Phase 1 (to avoid buttons that lead nowhere): city
selector, search bar, featured businesses, auth links. They arrive with real
data in Phases 2–3.

Verification (2026-11-09):
- `pnpm typecheck` ✅ · `pnpm lint` ✅ (0 problems) · `pnpm test` ✅ 7/7 ·
  `pnpm build` ✅ (all routes prerendered static).
- Playwright smoke run against `next start`: `/`, `/for-businesses`,
  `/privacy` at 1366×900 and iPhone 13; no console errors; no horizontal
  scroll on mobile (scrollWidth 390); mobile menu opens and closes.

Open items: Supabase, OCM and OpenFreeMap hosts are blocked from the
development container, so integrations are verified against real services
from a developer machine or Vercel preview.

## 2026-11-09 — Phase 3: public marketplace

Delivered:
- Public read layer as `SECURITY INVOKER` SQL functions (migration
  `20261109110000_public_marketplace.sql`): `public_cities`,
  `public_categories`, `search_businesses` (city/category/service/name,
  PostGIS radius 5–100 km, open now, booking only, sort by distance/name;
  rating sort is not offered because no verified reviews exist yet),
  `get_business_profile`, `public_business_paths`. RLS still applies (anon).
- Pages: `/search` (list + MapLibre map, mobile list/map toggle, pagination,
  sort), `/{city}`, `/{city}/{category}` (only non-empty combinations are
  linked and listed in the sitemap), `/businesses/{city}/{slug}` profiles
  with services, prices, hours, roadside coverage, call/directions actions,
  breadcrumbs + LocalBusiness JSON-LD (not for demo listings).
- Homepage uses live data (featured businesses, category counts).
- Demo listings are labelled on cards and profiles, `noindex`, excluded from
  the sitemap and structured data.
- Analytics events (`profile_view`, `phone_click`, …) via rate-limited server
  action, no personal data.
- Browser geolocation is optional and rounded to ~100 m before use.
- `scripts/dev-rest-shim.mjs` (dev/test only) serves the public RPCs from the
  local test DB so pages render without a Supabase project.
- MapLibre worker is copied to `public/vendor/` on install (CSP-friendly,
  no blob workers); linting ignores that folder.

Verification (2026-11-09):
- `pnpm typecheck` ✅ · `pnpm lint` ✅ 0 problems · `pnpm test` ✅ 27/27 ·
  `pnpm db:test` ✅ 66 assertions · `pnpm build` ✅ against the shim.
- Playwright: hero search → Varna auto repair (3 results); geolocation + 5 km
  → 2 results with distances; tel links; mobile map mounts only after toggle;
  no horizontal scroll at 390 px; no console errors (map tiles stubbed).

Known limitations:
- Unknown slugs return 404 content with `noindex`, but HTTP status 200 when
  streaming has already started (Cache Components behaviour).
- Map tiles (OpenFreeMap) and real Supabase auth not verified from this
  container (hosts blocked).

## 2026-11-09 — Phase 4 (part 1): business dashboard

Delivered:
- Migration `20261109120000_business_dashboard.sql`: `create_business`
  (slug generation, primary location, point must be within 60 km of the
  city), `update_business_location`, `set_location_hours` (atomic replace),
  `my_businesses`, `dashboard_business`; all SECURITY INVOKER so RLS applies.
  Draft-period limits use the entry plan; `max_locations`,
  `max_team_members` and a 5-businesses-per-account limit are enforced by
  triggers (unauthorised inserts are left to RLS so they fail with a
  permission error rather than leaking limits).
- `/dashboard` (list or onboarding CTA), `/dashboard/new` (form with
  MapLibre pin picker, manual coordinates fallback, no geocoding service),
  `/dashboard/[id]` overview (setup checklist, submit for review, rejection
  reason, 30-day stats, plan), `profile`, `location` (24/7, roadside radius
  and vehicle restrictions, bays), `hours` (split days, copy Monday),
  `services` (CRUD, euro prices stored as cents, plan limit shown).
- Staff role sees the dashboard read-only; managers/owners edit.
- Public caches are invalidated with `updateTag` after edits.
- Dev shim now emulates password sign-in (HS256, throwaway secret, dev
  password) and the small PostgREST subset the app uses, so the dashboard
  can be tested end to end against local PostgreSQL with RLS.

Verification (2026-11-09):
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ 38/38 ·
  `pnpm db:test` ✅ (41 + marketplace + 20 dashboard assertions) · `pnpm build` ✅.
- Playwright: anonymous `/dashboard` → login → onboarding (missing pin error,
  map click) → profile → hours → service → submit → "Чака одобрение";
  second account gets 404 with no data leak; 390 px without horizontal
  scroll; no console errors.

Pending in Phase 4: media uploads (Storage), team invitations (email).

## 2026-11-13 — Deployment and Phase 4 (part 2): photos and team

Deployment:
- Supabase project (EU) has all migrations and the seed; Vercel project
  `all-in-one-auto` (region fra1) serves https://all-in-one-auto.vercel.app.
  The Vercel GitHub app has no access to this repository yet, so deployments
  are created from the public repo on demand rather than on every push.
- Migration history on Supabase uses MCP-generated versions, not the file
  timestamps; reconcile before using `supabase db push`.

Delivered:
- Migration `20261113100000_media_and_team.sql`: `register_business_media`,
  `move_business_media`, `business_team`, `invitation_preview`,
  `accept_business_invitation`, a guard that keeps the owner role out of role
  changes, and a fix for `enforce_team_member_limit` (it read `new.user_id`
  on `business_invitations`, so every invitation insert failed).
- `/dashboard/[id]/photos`: logo, cover and gallery. The browser downscales
  and re-encodes to WebP before uploading straight to Storage (RLS: managers
  of that business only); the row is registered afterwards and refused rows
  remove the uploaded file. Reorder and remove; plan limit shown and enforced.
- `/dashboard/[id]/team`: members, roles (owner changes staff/manager),
  remove/leave, open invitations with revoke, invite form. The invitation
  link is shown once to copy; it is also e-mailed when `RESEND_API_KEY` and
  `EMAIL_FROM` are set. `/invitations/[token]` previews and accepts.
- Dashboard pages declare `instant = false` (private per-user views), which
  removes the dev-time blocking-route warnings.
- Dev shim: storage upload/delete/public read for `business-media`, CORS,
  `order` and `DELETE` support, new RPCs and tables.

Verification (2026-11-13):
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ 40/40 ·
  `pnpm db:test` ✅ (+24 media/team assertions) · `pnpm build` ✅.
- Playwright against the shim: logo + 2 gallery uploads (3000×2000 JPEG
  stored as 2000×1333 WebP), reorder, remove (file deleted); invite →
  second account accepts → reuse refused → owner demotes to staff → staff
  sees photos read-only; 390 px without horizontal scroll; no console errors
  (image optimisation of 127.0.0.1 URLs is blocked by Next in dev only).

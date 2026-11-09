# Roadmap

Status legend: ✅ done and verified · 🟡 in progress · ⬜ not started.
"Done" means implemented **and** checked (typecheck, lint, build and the
relevant tests). See `DEVELOPMENT_LOG.md` for evidence.

## Phase 0 — Inspection and planning ✅
Repository inspected (empty), project initialised, documentation written.

## Phase 1 — Foundation ✅
- Next.js 16 App Router, TypeScript strict, Tailwind v4, shadcn/ui primitives
- Brand design tokens, typography (Inter), logo
- Responsive layout shell: dark navy header, mobile navigation, footer
- Supabase clients (browser / server / service role) and session proxy
- Zod-validated environment variables, `.env.example`
- Legal page shells (privacy, terms, cookies) with "pending legal review" notice

## Phase 2 — Database and authentication ✅ (live Supabase verification pending)
- 10 migrations: full schema, PostGIS, RLS on every table, role helpers,
  moderation RPCs, entitlement triggers, booking exclusion constraint,
  storage bucket + policies, audit triggers
- Varna demo seed (10 businesses, `is_demo = true`), cities, categories,
  service types, plans and plan features, EV data source
- SQL test suite (41 assertions) + `scripts/db-test.sh` + CI job
- Auth: register (customer/business), login, logout, forgot/reset password,
  e-mail confirmation route, account page, header auth state, proxy gate,
  rate limiting
- Not yet verified against a live Supabase project (blocked from the dev
  container); see DEVELOPMENT_LOG.md

## Phase 3 — Public marketplace ⬜
Homepage with live data, category & city landing pages, search with PostGIS
filters, list + map, business cards, business profiles, sitemap, robots,
structured data.

## Phase 4 — Business dashboard ⬜
Business onboarding, profile, locations, hours, services, media uploads
(Supabase Storage), team invites and permissions, overview stats.

## Phase 5 — Specialised features ⬜
Roadside flow and coverage areas, booking calendar, slot engine, booking
management and emails, EV charging import job and map.

## Phase 6 — Monetisation ⬜
Stripe products/prices, Checkout, Customer Portal, webhooks with idempotency,
billing history, entitlement enforcement.

## Phase 7 — Admin panel ⬜
KPIs, business approvals/suspension/verification, users and roles,
subscriptions, cities, categories, EV stations, reports, audit log.

## Phase 8 — Quality assurance ⬜
Vitest unit/integration, pgTAP RLS tests, Playwright E2E for every acceptance
scenario, responsive checks, Sentry, security review, production build.

## Post-MVP backlog
- Verified reviews (only after completed bookings) and moderation UI
- Roadside service requests, provider acceptance, ETA, live tracking
- Additional Bulgarian EV operators as charging data providers
- Multi-language UI (EN), message catalogues
- Trial periods and coupons
- Payment fallback evaluation: Paddle (merchant of record), myPOS / Borica
- Native apps / PWA

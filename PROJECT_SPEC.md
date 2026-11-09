# All in One Auto — Product Specification

> Short brand: **AIO Auto** · Slogan: *"Everything your car needs. In one place."*

This document is the condensed, engineering-facing version of the owner's master
brief (2026-11-09). When the brief and this file disagree, the brief wins and
this file must be corrected.

## 1. Vision

A Bulgarian automotive services marketplace that connects vehicle owners with
automotive businesses. Customers discover, compare, contact and book services
for free. Businesses pay a monthly subscription for a listing, management tools
and visibility.

- First launch: **Varna**. Expansion: Sofia, Plovdiv, Veliko Tarnovo.
- Every Bulgarian city must be supportable from day one. Cities are data, added
  by administrators without code changes. No city-specific business logic.

## 2. Audiences

| Audience | Pays | Main goals |
| --- | --- | --- |
| Customers | No | Find, compare, call, book services; find EV chargers |
| Businesses | Monthly subscription | Publish a profile, manage services, hours, bookings, staff |
| Platform admins | — | Approve, moderate, manage cities/categories/plans, see revenue |

## 3. Categories (initial, admin-editable)

| Slug | Name | Notes |
| --- | --- | --- |
| `auto-repair` | Auto Repair Shops | general, engine, diagnostics, electrical, oil & filter, suspension, brakes, A/C, transmission, inspections |
| `roadside-assistance` | Roadside Assistance | towing, emergency towing, jump-start, tire change, fuel delivery, vehicle transport, EV transport, 24/7. **Coverage radius + coverage areas.** |
| `tire-services` | Tire Shops | replacement, balancing, repairs, seasonal change, storage, alignment |
| `car-wash` | Car Washes | automatic, self-service, manual, interior, upholstery |
| `car-detailing` | Car Detailing | exterior, interior, paint correction, ceramic, PPF, headlights |
| EV charging | Separate module | Public map, sourced from Open Charge Map, **no subscription** |

## 4. Public website

- **Homepage**: header, nav, city selector, search, categories, featured
  businesses, roadside section, EV map preview, how it works, business CTA,
  footer with legal pages and contact.
- **Search**: city, category, service, distance (5/10/25/50/100 km), name,
  open-now (only where hours are reliable), online booking, sort by distance,
  sort by rating (only once verified reviews exist). PostGIS-backed.
- **Results**: desktop list + map; mobile list-first with a map toggle.
- **Business profile**: `/businesses/{city}/{slug}`, server-rendered, SEO.
- **SEO landing pages**: `/{city}/{category}` — only indexable when they have
  real content.
- **Location**: browser geolocation only after explicit user action; never
  required to browse.

## 5. Roadside assistance (priority)

Dedicated flow: open → optional location / manual address → pick problem →
providers whose coverage contains the point → sort by distance/coverage → call.
Clicking "call" is **not** an accepted job. No fake live tracking. Requests,
acceptance, ETA and tracking are future work.

## 6. Bookings (optional per business, plan-gated)

Disabled → show contact details only. Enabled → dates, slots, service, customer
data, optional vehicle data, booking request. Statuses: `pending`, `confirmed`,
`rejected`, `cancelled`, `completed`, `no_show`. Businesses configure hours,
working days, durations, slots, buffers, manual/auto confirmation and blocked
periods. Double bookings are prevented in the database. Emails on create and
status change. No CRM in the MVP.

## 7. Dashboards

- **Business**: overview (views, contact clicks, bookings, subscription,
  profile completion), profile, services, bookings, subscription, team. A user
  can manage many businesses; a business can have many locations.
- **Admin**: KPIs (businesses by status, subscriptions, MRR, bookings, users),
  business moderation, users and roles, subscriptions, cities, categories, EV
  stations, reports, audit log.

## 8. Subscriptions (initial assumptions, not commitments)

| Plan | Price | Services | Images | Booking | Stats | Priority | Enhanced profile |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Starter | €9.99/mo | 5 | 5 | — | basic | — | — |
| Professional | €19.99/mo | unlimited | 20 | ✓ | extended | — | — |
| Premium | €39.99/mo | unlimited | 50 | ✓ | extended | ✓ | ✓ |

Plans and features live in the database. One central entitlement service is the
only place the app asks "may this business do X?". Payment state comes only from
verified provider webhooks. Trial period configurable later.

## 9. Roles

Platform: `customer`, `moderator`, `super_admin`.
Business (per business): `owner`, `manager`, `staff`.
Business approval status and subscription status are independent.

## 10. Acceptance criteria

The MVP is complete only when every scenario in section 19 of the brief
(customer, roadside, business, admin, EV, security) works and has been tested.
Progress against them is tracked in `DEVELOPMENT_LOG.md`.

## 11. Non-negotiable working rules

No placeholder buttons, no invented APIs or data, demo businesses clearly
labelled as demo, no fake reviews or ratings, no exposed secrets, no RLS
bypass, responsive design, error states everywhere, nothing marked done until
it is implemented and tested.

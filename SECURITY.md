# Security and Privacy

## Threat model (summary)

| Asset | Threat | Control |
| --- | --- | --- |
| Business private data (bookings, customers, billing) | Cross-tenant access | RLS with `has_business_role()`; server-side re-checks; policy tests |
| Platform roles | Self-escalation via API | No client write path to `user_roles`; only `super_admin` via RLS; audited |
| Subscription state | Forged payment status | Only Stripe webhooks (signature-verified, idempotent) write `subscriptions`/`payments` via service role |
| Secrets | Leakage to browser | `server-only` modules, `NEXT_PUBLIC_` only for anon key/URL/map style; env validated at boot |
| Customer location | Over-collection / exposure | Geolocation only on explicit action, never persisted unless needed for a booking; never public |
| Booking system | Double booking, spam | Exclusion constraint, transactional `create_booking()`, rate limits, optional captcha |
| Auth | Credential stuffing | Supabase Auth rate limits, app-level rate limiting, email verification |

## Controls

- **RLS everywhere.** Every table has RLS enabled. The service-role client is
  used only in: Stripe webhooks, cron imports, and admin operations that write
  an `audit_logs` row.
- **Validation.** All external input (forms, route handlers, search params,
  webhook payloads, third-party API responses) is parsed with Zod.
- **AuthN.** Supabase Auth with `@supabase/ssr` cookies (HttpOnly, Secure,
  SameSite=Lax). `proxy.ts` refreshes the session; authorization is decided
  server-side with `supabase.auth.getUser()` / `getClaims()` (never
  `getSession()` alone on the server).
- **AuthZ.** Role checks in a data-access layer plus RLS. UI hiding is cosmetic.
- **Webhooks.** `stripe.webhooks.constructEvent` on the raw body; event id
  stored in `webhook_events` before processing; handlers are idempotent.
- **Cron.** `Authorization: Bearer ${CRON_SECRET}` required.
- **Headers.** CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` (`geolocation=(self)`), HSTS via Vercel.
- **Output.** React escapes by default; no `dangerouslySetInnerHTML` except
  JSON-LD built from serialised, escaped data.
- **Uploads.** Storage buckets with RLS by business membership, MIME/size
  validation, image dimensions recorded.
- **Audit log.** Approvals, rejections, suspensions, role changes, plan
  changes, city/category edits.
- **Dependencies.** Pinned via `pnpm-lock.yaml`; `pnpm audit` in CI.

## GDPR

- Privacy policy, terms of service and cookie policy pages exist from Phase 1
  and are marked **pending legal review**. They must be reviewed by a lawyer
  before commercial launch.
- Cookie consent: only strictly necessary cookies (auth session) are set
  without consent. Analytics/marketing cookies, if added, require opt-in.
- Data subject rights: account data export (JSON) and account deletion
  workflow (soft delete → anonymise after retention window) in the account
  settings (Phase 4/8).
- Retention: bookings kept 24 months after the appointment then anonymised;
  webhook payloads 90 days; audit logs 24 months; analytics events aggregated
  after 13 months. Values are proposals pending legal review.
- Processors to disclose: Supabase, Vercel, Stripe, Resend, Sentry, map tile
  provider, Open Charge Map (data source only).
- Data location: Supabase project in an EU region (e.g. Frankfurt).

## Backups

Supabase Pro daily backups + Point-in-Time Recovery add-on for production.
Migrations in git allow schema rebuild. Storage objects: periodic export.

## Reporting

Security issues: email the owner (contact to be published on `/contact`).

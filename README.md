# All in One Auto

*Everything your car needs. In one place.*

Bulgarian automotive services marketplace and B2B SaaS: customers find, compare,
call and book auto repair, roadside assistance, tire, car wash and detailing
businesses, and find EV charging stations. Businesses pay a monthly
subscription. First launch: Varna.

## Documentation

| File | Contents |
| --- | --- |
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | Product scope and acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and decision records |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables, constraints, SQL functions |
| [SECURITY.md](SECURITY.md) | Threat model, controls, GDPR |
| [ROADMAP.md](ROADMAP.md) | Phases and status |
| [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) | What was built and how it was verified |

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · shadcn/ui (Radix) · Lucide · Zod · Supabase (Postgres +
PostGIS, Auth, Storage, RLS) · Stripe Billing · Resend · Sentry · Vercel.

## Local development

Requirements: Node.js ≥ 20.9, pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # fill in what you have; the marketing site runs without services
pnpm dev                     # http://localhost:3000
```

Quality checks:

```bash
pnpm typecheck   # route type generation + tsc
pnpm lint        # ESLint (next/core-web-vitals + typescript)
pnpm test        # Vitest unit tests
pnpm build       # production build
```

Supabase, Stripe and deployment setup guides are added under `docs/setup/` as
the corresponding phases ship (see ROADMAP.md).

# Supabase setup

## 1. Create the project

1. Create a project at https://supabase.com/dashboard in an **EU region**
   (e.g. Frankfurt `eu-central-1`) for GDPR data residency.
2. Development can use the Free plan. **Production needs Pro** (daily backups,
   no pausing; add Point-in-Time Recovery for production data).
3. Project Settings → API keys: copy the **publishable** key and the **secret**
   key into `.env.local` / Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server only, never `NEXT_PUBLIC_`)

## 2. Apply migrations and seed

With the Supabase CLI (https://supabase.com/docs/guides/local-development/cli/getting-started):

```bash
supabase init            # once; keeps the existing supabase/migrations folder
supabase login
supabase link --project-ref <your-project-ref>
supabase db push         # applies supabase/migrations/*.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # reference data + Varna demo businesses
```

Local stack (Docker): `supabase start` then `supabase db reset` applies the
migrations and `supabase/seed.sql` automatically.

Never change the schema in the dashboard. Every change is a new file in
`supabase/migrations/`.

## 3. Auth settings

Authentication → Sign In / Providers → Email:
- **Confirm email: ON**
- Minimum password length: **8**; password requirements: letters and digits.
- Secure password change: ON.

Authentication → URL Configuration:
- Site URL: `https://<your-domain>` (or `http://localhost:3000` locally)
- Redirect URLs: `https://<your-domain>/auth/confirm`, `http://localhost:3000/auth/confirm`,
  and your Vercel preview pattern, e.g. `https://*-<team>.vercel.app/auth/confirm`.

Authentication → Emails → Templates. Use the `token_hash` links so
confirmation works even when the e-mail is opened on another device:

| Template | Link |
| --- | --- |
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account?welcome=1` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` |
| Change e-mail | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/account` |

Production: Authentication → Emails → SMTP Settings → use Resend SMTP
(`smtp.resend.com`, port 465, user `resend`, password = Resend API key) with a
verified sending domain. The built-in Supabase mailer is rate-limited and not
meant for production.

## 4. First administrator

Platform roles cannot be granted from the app by a non-admin. Bootstrap the
first super admin once, in the SQL editor, after that person has signed up:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'owner@your-domain.bg';
```

## 5. Storage

The `business-media` bucket is created by migration
`20261109100900_reports_storage_hardening.sql` (public read, 5 MB limit,
JPEG/PNG/WebP/AVIF). Upload paths must start with the business id.

## 6. Verifying the database locally without Supabase

`scripts/db-test.sh` rebuilds a scratch database on any PostgreSQL 15+ server
with PostGIS, using `supabase/tests/00_supabase_shim.sql` to emulate the
Supabase `auth`/`storage` schemas and roles, then runs the RLS tests:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres scripts/db-test.sh
```

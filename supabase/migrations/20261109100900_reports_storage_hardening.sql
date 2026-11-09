-- Content reports, storage buckets and final privilege hardening.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users (id) on delete set null,
  entity_type text not null check (entity_type in ('business', 'review', 'charging_station')),
  entity_id uuid not null,
  reason text not null check (reason in ('incorrect_info', 'closed', 'spam', 'offensive', 'fraud', 'other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

create policy "reports: anyone can file" on public.reports
  for insert to anon, authenticated
  with check (status = 'open' and resolved_by is null and (reporter_id is null or reporter_id = auth.uid()));
create policy "reports: reporter reads own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "reports: staff manage" on public.reports
  for all to authenticated using (public.is_platform_staff()) with check (public.is_platform_staff());

revoke update, delete on public.reports from anon;

create trigger reports_audit
  after update on public.reports
  for each row execute function public.audit_row_change();

-- Storage ------------------------------------------------------------------------
-- Bucket `business-media`: public read (only paths of visible businesses are
-- ever referenced), writes restricted to managers of the business whose id is
-- the first path segment: `{business_id}/{uuid}.{ext}`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media', 'business-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

create or replace function public.storage_path_business_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "business-media: managers upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'business-media'
    and public.has_business_role(public.storage_path_business_id(name), 'manager')
  );

-- Listing objects through the API is limited to the business team; public
-- files are still served by URL because the bucket is public.
create policy "business-media: members list"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'business-media'
    and public.has_business_role(public.storage_path_business_id(name), 'staff')
  );

create policy "business-media: managers update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'business-media'
    and public.has_business_role(public.storage_path_business_id(name), 'manager')
  );

create policy "business-media: managers delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'business-media'
    and public.has_business_role(public.storage_path_business_id(name), 'manager')
  );

-- Hardening ----------------------------------------------------------------------

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- Internal trigger functions must not be callable through the API.
revoke execute on function
  public.handle_new_user(),
  public.add_business_owner(),
  public.audit_row_change(),
  public.enforce_business_service_limit(),
  public.enforce_business_media_limit(),
  public.enforce_booking_entitlement(),
  public.set_updated_at()
from public, anon, authenticated;

-- Admin RPCs require a signed-in user (they re-check roles internally).
revoke execute on function public.admin_set_business_status(uuid, public.business_status, text) from public, anon;
revoke execute on function public.admin_set_business_verified(uuid, boolean) from public, anon;
revoke execute on function public.submit_business_for_review(uuid) from public, anon;

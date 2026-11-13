-- Business photos and team invitations.
\set ON_ERROR_STOP 1
begin;

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.expect_error(p_label text, p_sql text, p_pattern text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~* p_pattern then
      raise notice 'ok   - %', p_label;
      return;
    end if;
    raise exception 'FAIL - % (unexpected error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL - % (statement succeeded but should have failed)', p_label;
end $$;

create function tests.expect_eq(p_label text, p_actual anyelement, p_expected anyelement) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL - % (expected %, got %)', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   - %', p_label;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

create table tests.ids (k text primary key, v text);
grant all on tests.ids to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'media-owner@example.com', '{"full_name":"Owner"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'invitee@example.com', '{"full_name":"Invitee"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'stranger@example.com', '{"full_name":"Stranger"}');

select tests.login('00000000-0000-0000-0000-0000000000c1');
insert into tests.ids
select 'biz', (public.create_business('Медия Тест', 'varna', 'car-wash', 'ул. 1', 43.2141, 27.9147) ->> 'id');
reset role;

-- Simulated uploads (the storage API is not part of the shim).
insert into storage.objects (bucket_id, name)
select 'business-media', (select v from tests.ids where k = 'biz') || '/' || u || '.webp'
from (values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555')
) as t (u);

create policy "tests: read objects" on storage.objects for select to authenticated using (true);

-- Photos -----------------------------------------------------------------------------

select tests.login('00000000-0000-0000-0000-0000000000c1');

select public.register_business_media((select v::uuid from tests.ids where k = 'biz'),
  (select v from tests.ids where k = 'biz') || '/11111111-1111-1111-1111-111111111111.webp', 'logo', 400, 400, 'Лого');
select tests.expect_eq('new logo retires the previous one',
  jsonb_array_length(public.register_business_media((select v::uuid from tests.ids where k = 'biz'),
    (select v from tests.ids where k = 'biz') || '/22222222-2222-2222-2222-222222222222.webp', 'logo') -> 'retired_paths'),
  1);
select tests.expect_eq('only one active logo',
  (select count(*) from public.business_media where business_id = (select v::uuid from tests.ids where k = 'biz')
     and kind = 'logo' and deleted_at is null), 1::bigint);

select public.register_business_media((select v::uuid from tests.ids where k = 'biz'),
  (select v from tests.ids where k = 'biz') || '/33333333-3333-3333-3333-333333333333.webp', 'gallery');
insert into tests.ids
select 'g2', public.register_business_media((select v::uuid from tests.ids where k = 'biz'),
  (select v from tests.ids where k = 'biz') || '/44444444-4444-4444-4444-444444444444.webp', 'gallery') ->> 'id';

select public.move_business_media((select v::uuid from tests.ids where k = 'g2'), -1);
select tests.expect_eq('moved photo comes first',
  (select storage_path from public.business_media
   where business_id = (select v::uuid from tests.ids where k = 'biz') and kind = 'gallery' and deleted_at is null
   order by sort_order, created_at limit 1),
  (select v from tests.ids where k = 'biz') || '/44444444-4444-4444-4444-444444444444.webp');

select tests.expect_error('path outside the business folder is rejected',
  $sql$select public.register_business_media((select v::uuid from tests.ids where k = 'biz'),
    '00000000-0000-0000-0000-000000000000/55555555-5555-5555-5555-555555555555.webp', 'gallery')$sql$,
  'invalid media path');
select tests.expect_error('file that was never uploaded is rejected',
  format($sql$select public.register_business_media(%L, %L, 'gallery')$sql$,
    (select v from tests.ids where k = 'biz'),
    (select v from tests.ids where k = 'biz') || '/66666666-6666-6666-6666-666666666666.webp'),
  'not found');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c3');
select tests.expect_error('stranger cannot register photos',
  format($sql$select public.register_business_media(%L, %L, 'gallery')$sql$,
    (select v from tests.ids where k = 'biz'),
    (select v from tests.ids where k = 'biz') || '/55555555-5555-5555-5555-555555555555.webp'),
  'not authorized');
select tests.expect_error('stranger cannot reorder photos',
  format($sql$select public.move_business_media(%L, 1)$sql$, (select v from tests.ids where k = 'g2')),
  'not authorized');
select tests.expect_eq('stranger sees no team', public.business_team((select v::uuid from tests.ids where k = 'biz')), null::jsonb);
reset role;

-- Draft limit: Starter allows 5 gallery photos (logo does not count).
select tests.login('00000000-0000-0000-0000-0000000000c1');
insert into public.business_media (business_id, kind, storage_path)
select (select v::uuid from tests.ids where k = 'biz'), 'gallery', 'x/' || n
from generate_series(1, 3) as n;
select tests.expect_error('6th gallery photo exceeds the plan',
  format($sql$select public.register_business_media(%L, %L, 'gallery')$sql$,
    (select v from tests.ids where k = 'biz'),
    (select v from tests.ids where k = 'biz') || '/55555555-5555-5555-5555-555555555555.webp'),
  'max_images');

-- Invitations -------------------------------------------------------------------------

insert into public.business_invitations (business_id, email, role, token_hash, invited_by)
values ((select v::uuid from tests.ids where k = 'biz'), 'Invitee@Example.com', 'manager',
        encode(extensions.digest('token-for-invitee-0123456789abcdef0123', 'sha256'), 'hex'),
        '00000000-0000-0000-0000-0000000000c1');
select tests.expect_eq('owner sees the open invitation',
  jsonb_array_length(public.business_team((select v::uuid from tests.ids where k = 'biz')) -> 'invitations'), 1);
select tests.expect_error('limit counts open invitations (Starter: 2 people)',
  format($sql$insert into public.business_invitations (business_id, email, role, token_hash)
              values (%L, 'third@example.com', 'staff', 'x')$sql$, (select v from tests.ids where k = 'biz')),
  'max_team_members');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c3');
select tests.expect_eq('preview tells a stranger the e-mail does not match',
  (public.invitation_preview('token-for-invitee-0123456789abcdef0123') ->> 'email_matches')::boolean, false);
select tests.expect_error('stranger cannot accept someone else''s invitation',
  $sql$select public.accept_business_invitation('token-for-invitee-0123456789abcdef0123')$sql$,
  'another e-mail');
select tests.expect_error('wrong token is rejected',
  $sql$select public.accept_business_invitation('wrong-token-0123456789abcdef0123456789')$sql$,
  'not valid');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c2');
select tests.expect_eq('preview shows the business',
  public.invitation_preview('token-for-invitee-0123456789abcdef0123') ->> 'business_name', 'Медия Тест');
select tests.expect_eq('invitee joins as manager',
  public.accept_business_invitation('token-for-invitee-0123456789abcdef0123')::text,
  (select v from tests.ids where k = 'biz'));
select tests.expect_eq('dashboard shows the new role',
  public.dashboard_business((select v::uuid from tests.ids where k = 'biz')) ->> 'role', 'manager');
select tests.expect_error('invitation cannot be reused',
  $sql$select public.accept_business_invitation('token-for-invitee-0123456789abcdef0123')$sql$,
  'not valid');
select tests.expect_eq('manager sees two members',
  jsonb_array_length(public.business_team((select v::uuid from tests.ids where k = 'biz')) -> 'members'), 2);
select tests.expect_error('manager cannot invite another manager',
  format($sql$insert into public.business_invitations (business_id, email, role, token_hash)
              values (%L, 'm2@example.com', 'manager', 'y')$sql$, (select v from tests.ids where k = 'biz')),
  'row-level security|max_team_members');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c1');
select tests.expect_error('owner role cannot be handed out',
  format($sql$update public.business_members set role = 'owner' where business_id = %L and user_id = %L$sql$,
    (select v from tests.ids where k = 'biz'), '00000000-0000-0000-0000-0000000000c2'),
  'ownership');
update public.business_members set role = 'staff'
where business_id = (select v::uuid from tests.ids where k = 'biz')
  and user_id = '00000000-0000-0000-0000-0000000000c2';
select tests.expect_eq('owner demotes the manager to staff',
  (select role::text from public.business_members
   where business_id = (select v::uuid from tests.ids where k = 'biz')
     and user_id = '00000000-0000-0000-0000-0000000000c2'), 'staff');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c2');
select tests.expect_eq('staff does not see e-mail addresses of others',
  (select count(*) from jsonb_array_elements(public.business_team((select v::uuid from tests.ids where k = 'biz')) -> 'members') m
   where m ->> 'email' is not null), 1::bigint);
delete from public.business_members
where business_id = (select v::uuid from tests.ids where k = 'biz')
  and user_id = '00000000-0000-0000-0000-0000000000c2';
select tests.expect_eq('staff can leave the business', jsonb_array_length(public.my_businesses()), 0);
reset role;

\echo '✓ media and team tests passed'
rollback;

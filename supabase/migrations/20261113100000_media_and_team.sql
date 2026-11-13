-- Phase 4 (part 2): business photos and team management.
--
-- Photos: the browser uploads the file straight to the `business-media`
-- bucket (storage RLS: managers only, path `{business_id}/{uuid}.{ext}`), then
-- registers it here. Logo and cover are single slots; registering a new one
-- retires the previous row and returns its path so the caller can remove the
-- file. Rows are retired with `deleted_at`, never hard-deleted here.
--
-- Team: invitations store only a SHA-256 hash of a random token that the
-- server generates. The invitee opens the link, signs in with the invited
-- e-mail address and accepts; membership is created by a SECURITY DEFINER
-- function because the invitee is not yet a member and cannot pass RLS.

-- Photos -------------------------------------------------------------------------------

create or replace function public.register_business_media(
  p_business_id uuid,
  p_path text,
  p_kind public.media_kind,
  p_width integer default null,
  p_height integer default null,
  p_alt text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
  retired text[] := '{}';
begin
  if not public.has_business_role(p_business_id, 'manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_path !~ ('^' || p_business_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$') then
    raise exception 'invalid media path' using errcode = '22023', hint = 'invalid_media_path';
  end if;

  -- The file must already be in the bucket (visible to members through
  -- storage RLS), so rows never point at missing objects.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-media' and o.name = p_path
  ) then
    raise exception 'media file not found' using errcode = '22023', hint = 'media_not_uploaded';
  end if;

  if p_kind in ('logo', 'cover') then
    with retired_rows as (
      update public.business_media
      set deleted_at = now()
      where business_id = p_business_id and kind = p_kind and deleted_at is null
      returning storage_path
    )
    select coalesce(array_agg(storage_path), '{}') into retired from retired_rows;
  end if;

  insert into public.business_media (business_id, kind, storage_path, alt_text, width, height, sort_order)
  values (
    p_business_id, p_kind, p_path, nullif(btrim(p_alt), ''),
    nullif(p_width, 0), nullif(p_height, 0),
    coalesce((
      select max(sort_order) + 1 from public.business_media
      where business_id = p_business_id and kind = p_kind and deleted_at is null
    ), 0)
  )
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'retired_paths', to_jsonb(retired));
end;
$$;

-- Swaps a gallery photo with its neighbour (-1 = earlier, 1 = later).
create or replace function public.move_business_media(p_media_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item public.business_media%rowtype;
  neighbour public.business_media%rowtype;
begin
  if p_direction not in (-1, 1) then
    raise exception 'invalid direction' using errcode = '22023';
  end if;

  select * into item from public.business_media
  where id = p_media_id and deleted_at is null;
  if not found or not public.has_business_role(item.business_id, 'manager') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into neighbour from public.business_media m
  where m.business_id = item.business_id and m.kind = item.kind and m.deleted_at is null
    and m.id <> item.id
    and case when p_direction < 0
          then (m.sort_order, m.created_at) < (item.sort_order, item.created_at)
          else (m.sort_order, m.created_at) > (item.sort_order, item.created_at) end
  order by
    case when p_direction < 0 then m.sort_order end desc,
    case when p_direction < 0 then m.created_at end desc,
    case when p_direction > 0 then m.sort_order end asc,
    case when p_direction > 0 then m.created_at end asc
  limit 1;

  if not found then
    return;
  end if;

  -- Normalise equal sort orders so the swap always changes the visible order.
  if neighbour.sort_order = item.sort_order then
    update public.business_media set sort_order = item.sort_order + p_direction where id = neighbour.id;
    update public.business_media set sort_order = item.sort_order where id = item.id;
    neighbour.sort_order := item.sort_order + p_direction;
  end if;

  update public.business_media set sort_order = neighbour.sort_order where id = item.id;
  update public.business_media set sort_order = item.sort_order where id = neighbour.id;
end;
$$;

-- Fix: the invitation shortcut read new.user_id, which does not exist when
-- the trigger fires on business_invitations (PL/pgSQL does not short-circuit
-- field references), so every invitation insert failed.
create or replace function public.enforce_team_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_allowed integer;
  current_count integer;
begin
  -- Unauthorised inserts are left to RLS so they fail with a permission error.
  if auth.uid() is null or not public.has_business_role(new.business_id, 'manager') then
    return new;
  end if;
  -- Accepting an invitation turns an invitation into a member; it is not growth.
  if tg_table_name = 'business_members' then
    if exists (
      select 1 from public.business_invitations i
      join auth.users u on lower(u.email) = lower(i.email::text)
      where i.business_id = new.business_id and u.id = (to_jsonb(new) ->> 'user_id')::uuid
        and i.accepted_at is null and i.revoked_at is null
    ) then
      return new;
    end if;
  end if;

  max_allowed := public.business_feature_limit(new.business_id, 'max_team_members');
  if max_allowed is null then
    return new;
  end if;

  select
    (select count(*) from public.business_members where business_id = new.business_id)
    + (select count(*) from public.business_invitations
       where business_id = new.business_id and accepted_at is null and revoked_at is null
         and expires_at > now())
  into current_count;

  if current_count >= max_allowed then
    raise exception 'plan limit reached: max_team_members = %', max_allowed using errcode = 'P0001', hint = 'upgrade_required';
  end if;
  return new;
end;
$$;

-- Team ---------------------------------------------------------------------------------

-- Team overview for a member. E-mail addresses and open invitations are only
-- shown to managers and owners. Returns null for non-members.
create or replace function public.business_team(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_manager boolean;
begin
  if auth.uid() is null or not public.has_business_role(p_business_id, 'staff') then
    return null;
  end if;
  is_manager := public.has_business_role(p_business_id, 'manager');

  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'full_name', p.full_name,
        'email', case when is_manager or m.user_id = auth.uid() then u.email end,
        'joined_at', m.accepted_at,
        'is_self', m.user_id = auth.uid()
      ) order by m.role desc, m.accepted_at)
      from public.business_members m
      join public.profiles p on p.id = m.user_id
      join auth.users u on u.id = m.user_id
      where m.business_id = p_business_id and m.accepted_at is not null
    ), '[]'::jsonb),
    'invitations', case when is_manager then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'role', i.role,
        'expires_at', i.expires_at,
        'created_at', i.created_at,
        'is_expired', i.expires_at <= now()
      ) order by i.created_at desc)
      from public.business_invitations i
      where i.business_id = p_business_id and i.accepted_at is null and i.revoked_at is null
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- What an invitation link points to, for the acceptance page. Reveals the
-- business name and role only to someone holding the token.
create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv record;
  caller_email text;
begin
  if auth.uid() is null or p_token is null or char_length(p_token) < 32 then
    return null;
  end if;

  select i.*, b.name as business_name
  into inv
  from public.business_invitations i
  join public.businesses b on b.id = i.business_id and b.deleted_at is null
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then
    return null;
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  return jsonb_build_object(
    'business_id', inv.business_id,
    'business_name', inv.business_name,
    'role', inv.role,
    'email', inv.email,
    'status', case
      when inv.accepted_at is not null then 'accepted'
      when inv.revoked_at is not null then 'revoked'
      when inv.expires_at <= now() then 'expired'
      else 'open' end,
    'email_matches', lower(caller_email) = lower(inv.email::text)
  );
end;
$$;

create or replace function public.accept_business_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.business_invitations%rowtype;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into inv from public.business_invitations
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if not found or inv.accepted_at is not null or inv.revoked_at is not null then
    raise exception 'invitation is not valid' using errcode = 'P0001', hint = 'invitation_invalid';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invitation has expired' using errcode = 'P0001', hint = 'invitation_expired';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null or lower(caller_email) <> lower(inv.email::text) then
    raise exception 'invitation was sent to another e-mail address' using errcode = 'P0001', hint = 'invitation_email_mismatch';
  end if;

  insert into public.business_members (business_id, user_id, role, invited_by, accepted_at)
  values (inv.business_id, auth.uid(), inv.role, inv.invited_by, now())
  on conflict (business_id, user_id) do update
    set role = greatest(public.business_members.role, excluded.role),
        accepted_at = coalesce(public.business_members.accepted_at, now());

  update public.business_invitations set accepted_at = now() where id = inv.id;
  return inv.business_id;
end;
$$;

-- Ownership is never handed out through role changes; only staff/manager.
create or replace function public.guard_member_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'owner' and old.role <> 'owner' and auth.uid() is not null then
    raise exception 'ownership cannot be granted through a role change' using errcode = '42501';
  end if;
  if old.role = 'owner' and new.role <> 'owner' and auth.uid() is not null then
    raise exception 'the owner role cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger business_members_guard_role
  before update of role on public.business_members
  for each row execute function public.guard_member_role_change();

-- Grants -------------------------------------------------------------------------------

revoke execute on function
  public.register_business_media(uuid, text, public.media_kind, integer, integer, text),
  public.move_business_media(uuid, integer),
  public.business_team(uuid),
  public.invitation_preview(text),
  public.accept_business_invitation(text),
  public.guard_member_role_change()
from public, anon;

grant execute on function
  public.register_business_media(uuid, text, public.media_kind, integer, integer, text),
  public.move_business_media(uuid, integer),
  public.business_team(uuid),
  public.invitation_preview(text),
  public.accept_business_invitation(text)
to authenticated;

revoke execute on function public.guard_member_role_change() from authenticated;

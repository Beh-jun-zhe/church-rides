-- Security hardening:
-- 1) Prevent self-promotion to owner via profile row edits.
-- 2) Centralize configured owner email in system_settings.
-- 3) Keep owner profile locked to owner role/admin approved.

alter table public.system_settings
add column if not exists owner_email text;

insert into public.system_settings (id, schedule_locked, owner_email)
values (true, false, null)
on conflict (id) do nothing;

update public.system_settings
set owner_email = coalesce(
  nullif(lower(trim(owner_email)), ''),
  (
    select lower(p.email)
    from public.profiles p
    where p.role = 'owner'
    order by p.created_at asc
    limit 1
  ),
  lower('behjunzhe@gmail.com')
)
where id = true;

create or replace function public.configured_owner_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(nullif((select owner_email from public.system_settings where id = true), ''), ''));
$$;

create or replace function public.is_schedule_locked_now()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select schedule_locked from public.system_settings where id = true), false);
$$;

create or replace function public.sync_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email text := public.configured_owner_email();
  normalized_email text := lower(coalesce(new.email, ''));
  seeded_role text := case when owner_email <> '' and normalized_email = owner_email then 'owner' else 'rider' end;
  seeded_admin_status text := case when seeded_role = 'owner' then 'approved' else 'not_requested' end;
begin
  insert into public.profiles (id, email, role, admin_status)
  values (new.id, coalesce(new.email, ''), seeded_role, seeded_admin_status)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

create or replace function public.guard_profile_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email text := public.configured_owner_email();
  requester_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if old.role = 'owner' and not public.is_owner() then
    raise exception 'Owner profile can only be updated by owner.';
  end if;

  if public.is_owner() then
    if old.role = 'owner' then
      new.role := 'owner';
      new.admin_status := 'approved';
    end if;
    return new;
  end if;

  if old.id <> auth.uid() then
    raise exception 'You can only edit your own profile.';
  end if;

  if new.role = 'owner' and old.role <> 'owner' then
    if owner_email = '' or requester_email = '' or requester_email <> owner_email then
      raise exception 'Only configured owner account can hold owner role.';
    end if;

    new.role := 'owner';
    new.admin_status := 'approved';
    return new;
  end if;

  if new.email is distinct from old.email then
    if requester_email = '' or lower(new.email) <> requester_email then
      raise exception 'Profile email must match authenticated account email.';
    end if;
  end if;

  if new.admin_status in ('approved', 'rejected') and old.admin_status is distinct from new.admin_status then
    raise exception 'Admin approval must be performed by owner.';
  end if;

  if old.role = 'admin' and old.admin_status = 'approved' and new.role <> 'admin' then
    raise exception 'Admins can only be changed by owner.';
  end if;

  if old.role = 'admin' and old.admin_status = 'pending' and new.role <> 'admin' then
    new.admin_status := 'not_requested';
    return new;
  end if;

  if new.role not in ('rider', 'driver', 'admin') then
    raise exception 'Invalid role transition.';
  end if;

  if new.role = 'admin' and new.admin_status not in ('pending', 'not_requested') then
    raise exception 'Invalid admin request state.';
  end if;

  if new.role <> 'admin' then
    new.admin_status := 'not_requested';
  elsif old.role <> 'admin' and new.admin_status = 'not_requested' then
    new.admin_status := 'pending';
  end if;

  return new;
end;
$$;

-- Church Rides schema + RLS
-- Replace behjunzhe@gmail.com with your owner email before executing in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role text not null default 'rider' check (role in ('owner', 'admin', 'driver', 'rider')),
  admin_status text not null default 'not_requested' check (admin_status in ('not_requested', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text not null,
  pickup_location text not null check (pickup_location in ('North Campus', 'South Campus')),
  pickup_time text not null,
  available_seats integer not null check (available_seats > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text not null,
  pickup_location text not null check (pickup_location in ('North Campus', 'South Campus')),
  selected_time text not null,
  notes text,
  admin_note text,
  status text not null default 'pending_assignment' check (status in ('pending_assignment', 'assigned', 'cancelled')),
  assigned_driver_id uuid references public.drivers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_assignments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  rider_id uuid not null unique references public.riders(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assignment_method text not null default 'auto' check (assignment_method in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id boolean primary key default true,
  schedule_locked boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (id)
);

insert into public.system_settings (id, schedule_locked)
values (true, false)
on conflict (id) do nothing;

create index if not exists idx_drivers_location_time on public.drivers (pickup_location, pickup_time) where active = true;
create index if not exists idx_riders_status on public.riders (status);
create index if not exists idx_riders_location_time on public.riders (pickup_location, selected_time);
create index if not exists idx_assignments_driver_id on public.ride_assignments (driver_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_drivers_updated_at on public.drivers;
create trigger set_drivers_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

drop trigger if exists set_riders_updated_at on public.riders;
create trigger set_riders_updated_at
before update on public.riders
for each row execute function public.set_updated_at();

create or replace function public.sync_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email text := lower('behjunzhe@gmail.com');
  normalized_email text := lower(coalesce(new.email, ''));
  seeded_role text := case when normalized_email = owner_email then 'owner' else 'rider' end;
begin
  insert into public.profiles (id, email, role, admin_status)
  values (new.id, coalesce(new.email, ''), seeded_role, 'not_requested')
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.sync_profile_on_signup();

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  );
$$;

create or replace function public.is_approved_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.admin_status = 'approved'
  );
$$;

create or replace function public.can_manage_rides()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner() or public.is_approved_admin();
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

create or replace function public.guard_profile_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_owner() then
    return new;
  end if;

  if old.id <> auth.uid() then
    raise exception 'You can only edit your own profile.';
  end if;

  if new.role = 'owner' and old.role <> 'owner' then
    if lower(new.email) <> lower('behjunzhe@gmail.com') then
      raise exception 'Only configured owner account can hold owner role.';
    end if;

    new.admin_status := 'approved';
    return new;
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

drop trigger if exists guard_profiles_before_update on public.profiles;
create trigger guard_profiles_before_update
before update on public.profiles
for each row execute function public.guard_profile_transitions();

create or replace function public.guard_rider_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_rides() then
    return new;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'You can only edit your own rider request.';
  end if;

  if public.is_schedule_locked_now() then
    raise exception 'Schedule is locked.';
  end if;

  if new.admin_note is distinct from old.admin_note then
    raise exception 'Admin notes are internal only.';
  end if;

  if new.status not in ('pending_assignment', 'cancelled') then
    raise exception 'Invalid rider status update.';
  end if;

  new.assigned_driver_id := null;
  return new;
end;
$$;

drop trigger if exists guard_riders_before_update on public.riders;
create trigger guard_riders_before_update
before update on public.riders
for each row execute function public.guard_rider_transitions();

create or replace function public.guard_rider_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_rides() then
    return new;
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'You can only create your own rider request.';
  end if;

  if public.is_schedule_locked_now() then
    raise exception 'Schedule is locked.';
  end if;

  if new.status <> 'pending_assignment' then
    raise exception 'Rider requests must begin in coordinating status.';
  end if;

  new.assigned_driver_id := null;
  new.admin_note := null;
  return new;
end;
$$;

drop trigger if exists guard_riders_before_insert on public.riders;
create trigger guard_riders_before_insert
before insert on public.riders
for each row execute function public.guard_rider_inserts();

create or replace function public.guard_driver_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_rides() then
    return new;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'You can only edit your own driver profile.';
  end if;

  if public.is_schedule_locked_now() then
    raise exception 'Schedule is locked.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_drivers_before_update on public.drivers;
create trigger guard_drivers_before_update
before update on public.drivers
for each row execute function public.guard_driver_updates();

create or replace function public.guard_driver_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_manage_rides() then
    return new;
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'You can only create your own driver profile.';
  end if;

  if public.is_schedule_locked_now() then
    raise exception 'Schedule is locked.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_drivers_before_insert on public.drivers;
create trigger guard_drivers_before_insert
before insert on public.drivers
for each row execute function public.guard_driver_inserts();

create or replace function public.driver_rider_counts()
returns table (
  driver_id uuid,
  riders_assigned bigint
)
language sql
stable
as $$
  select d.id as driver_id, count(r.id) as riders_assigned
  from public.drivers d
  left join public.riders r on r.assigned_driver_id = d.id and r.status = 'assigned'
  group by d.id;
$$;

create or replace function public.available_driver_slots()
returns table (
  pickup_location text,
  pickup_time text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.pickup_location, d.pickup_time
  from public.drivers d
  where d.active = true
  group by d.pickup_location, d.pickup_time
  order by d.pickup_location, d.pickup_time;
$$;

create or replace function public.is_rider_assigned_to_driver(target_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.riders r
    where r.user_id = auth.uid()
      and r.status = 'assigned'
      and r.assigned_driver_id = target_driver_id
  );
$$;

create or replace function public.is_driver_owner_of_rider(target_rider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.riders r
    join public.drivers d on d.id = r.assigned_driver_id
    where r.id = target_rider_id
      and d.user_id = auth.uid()
  );
$$;

create or replace function public.run_auto_match()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rider_row public.riders%rowtype;
  candidate_driver_id uuid;
  assigned_count integer := 0;
begin
  if not public.can_manage_rides() then
    raise exception 'Not authorized to run auto match.';
  end if;

  for rider_row in
    select *
    from public.riders
    where status = 'pending_assignment'
      and assigned_driver_id is null
    order by created_at asc
  loop
    select d.id
    into candidate_driver_id
    from public.drivers d
    left join public.riders ar
      on ar.assigned_driver_id = d.id
      and ar.status = 'assigned'
    where d.active = true
      and d.pickup_location = rider_row.pickup_location
      and d.pickup_time = rider_row.selected_time
    group by d.id, d.created_at, d.available_seats
    having count(ar.id) < d.available_seats
    order by count(ar.id) asc, d.created_at asc
    limit 1;

    if candidate_driver_id is not null then
      update public.riders
      set status = 'assigned', assigned_driver_id = candidate_driver_id
      where id = rider_row.id;

      insert into public.ride_assignments (driver_id, rider_id, assigned_by, assignment_method)
      values (candidate_driver_id, rider_row.id, auth.uid(), 'auto')
      on conflict (rider_id)
      do update set
        driver_id = excluded.driver_id,
        assigned_by = excluded.assigned_by,
        assignment_method = excluded.assignment_method,
        created_at = now();

      assigned_count := assigned_count + 1;
    end if;
  end loop;

  return assigned_count;
end;
$$;

create or replace function public.assign_rider_to_driver(
  target_rider_id uuid,
  target_driver_id uuid,
  method text default 'manual'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_row public.drivers%rowtype;
  rider_row public.riders%rowtype;
  assigned_count integer;
begin
  if not public.can_manage_rides() then
    raise exception 'Not authorized to assign riders.';
  end if;

  select * into driver_row from public.drivers where id = target_driver_id and active = true;
  if not found then
    raise exception 'Driver not found or inactive.';
  end if;

  select * into rider_row from public.riders where id = target_rider_id;
  if not found then
    raise exception 'Rider not found.';
  end if;

  if rider_row.pickup_location <> driver_row.pickup_location then
    raise exception 'Rider pickup and time must match driver availability.';
  end if;

  if rider_row.selected_time <> driver_row.pickup_time and rider_row.selected_time <> 'To be coordinated' then
    raise exception 'Rider pickup and time must match driver availability.';
  end if;

  select count(*)::integer
  into assigned_count
  from public.riders
  where assigned_driver_id = target_driver_id
    and status = 'assigned'
    and id <> target_rider_id;

  if assigned_count >= driver_row.available_seats then
    raise exception 'Driver has no remaining seats.';
  end if;

  update public.riders
  set assigned_driver_id = target_driver_id,
      selected_time = driver_row.pickup_time,
      status = 'assigned'
  where id = target_rider_id;

  insert into public.ride_assignments (driver_id, rider_id, assigned_by, assignment_method)
  values (target_driver_id, target_rider_id, auth.uid(), coalesce(method, 'manual'))
  on conflict (rider_id)
  do update set
    driver_id = excluded.driver_id,
    assigned_by = excluded.assigned_by,
    assignment_method = excluded.assignment_method,
    created_at = now();

  return true;
end;
$$;

create or replace function public.unassign_rider(target_rider_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_rides() then
    raise exception 'Not authorized to unassign riders.';
  end if;

  update public.riders
  set assigned_driver_id = null,
      status = 'pending_assignment'
  where id = target_rider_id;

  delete from public.ride_assignments where rider_id = target_rider_id;

  return true;
end;
$$;

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.riders enable row level security;
alter table public.ride_assignments enable row level security;
alter table public.system_settings enable row level security;

-- Drop policies first so this script is re-runnable.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self_or_owner" on public.profiles;
drop policy if exists "drivers_select" on public.drivers;
drop policy if exists "drivers_insert" on public.drivers;
drop policy if exists "drivers_update" on public.drivers;
drop policy if exists "drivers_delete" on public.drivers;
drop policy if exists "riders_select" on public.riders;
drop policy if exists "riders_insert" on public.riders;
drop policy if exists "riders_update" on public.riders;
drop policy if exists "riders_delete" on public.riders;
drop policy if exists "ride_assignments_select" on public.ride_assignments;
drop policy if exists "ride_assignments_modify_admin" on public.ride_assignments;
drop policy if exists "settings_read_authenticated" on public.system_settings;
drop policy if exists "settings_owner_update" on public.system_settings;

-- Profiles
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid() or public.can_manage_rides()
);

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self_or_owner"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_owner())
with check (id = auth.uid() or public.is_owner());

-- Drivers
create policy "drivers_select"
on public.drivers
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_rides()
  or public.is_rider_assigned_to_driver(id)
);

create policy "drivers_insert"
on public.drivers
for insert
to authenticated
with check (user_id = auth.uid() or public.can_manage_rides());

create policy "drivers_update"
on public.drivers
for update
to authenticated
using (user_id = auth.uid() or public.can_manage_rides())
with check (user_id = auth.uid() or public.can_manage_rides());

create policy "drivers_delete"
on public.drivers
for delete
to authenticated
using (user_id = auth.uid() or public.can_manage_rides());

-- Riders
create policy "riders_select"
on public.riders
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_rides()
  or public.is_driver_owner_of_rider(id)
);

create policy "riders_insert"
on public.riders
for insert
to authenticated
with check (user_id = auth.uid() or public.can_manage_rides());

create policy "riders_update"
on public.riders
for update
to authenticated
using (user_id = auth.uid() or public.can_manage_rides())
with check (
  user_id = auth.uid() or public.can_manage_rides()
);

create policy "riders_delete"
on public.riders
for delete
to authenticated
using (user_id = auth.uid() or public.can_manage_rides());

-- Ride assignments
create policy "ride_assignments_select"
on public.ride_assignments
for select
to authenticated
using (
  public.can_manage_rides()
  or exists (
    select 1
    from public.drivers d
    where d.id = ride_assignments.driver_id
      and d.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.riders r
    where r.id = ride_assignments.rider_id
      and r.user_id = auth.uid()
  )
);

create policy "ride_assignments_modify_admin"
on public.ride_assignments
for all
to authenticated
using (public.can_manage_rides())
with check (public.can_manage_rides());

-- Settings: read for authenticated, modify owner only
create policy "settings_read_authenticated"
on public.system_settings
for select
to authenticated
using (true);

create policy "settings_owner_update"
on public.system_settings
for update
to authenticated
using (public.is_owner())
with check (public.is_owner());

-- Function access
grant execute on function public.run_auto_match() to authenticated;
grant execute on function public.assign_rider_to_driver(uuid, uuid, text) to authenticated;
grant execute on function public.unassign_rider(uuid) to authenticated;
grant execute on function public.is_schedule_locked_now() to authenticated;
grant execute on function public.available_driver_slots() to authenticated;
grant execute on function public.is_rider_assigned_to_driver(uuid) to authenticated;
grant execute on function public.is_driver_owner_of_rider(uuid) to authenticated;

-- Weekly Sunday cycle support

create or replace function public.current_service_sunday()
returns date
language sql
stable
security definer
set search_path = public
as $current_service_sunday$
  with local_clock as (
    select
      (now() at time zone 'America/New_York')::date as local_date,
      extract(dow from (now() at time zone 'America/New_York'))::int as local_dow
  )
  select local_date + ((7 - local_dow) % 7)
  from local_clock;
$current_service_sunday$;

alter table public.drivers add column if not exists sunday_date date;
alter table public.riders add column if not exists sunday_date date;
alter table public.ride_assignments add column if not exists sunday_date date;

do $migration$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'guard_drivers_before_update'
      and tgrelid = 'public.drivers'::regclass
      and not tgisinternal
  ) then
    execute 'alter table public.drivers disable trigger guard_drivers_before_update';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgname = 'guard_riders_before_update'
      and tgrelid = 'public.riders'::regclass
      and not tgisinternal
  ) then
    execute 'alter table public.riders disable trigger guard_riders_before_update';
  end if;
end;
$migration$;

update public.drivers
set sunday_date = coalesce(sunday_date, public.current_service_sunday());

update public.riders
set sunday_date = coalesce(sunday_date, public.current_service_sunday());

update public.ride_assignments ra
set sunday_date = r.sunday_date
from public.riders r
where ra.rider_id = r.id
  and ra.sunday_date is null;

update public.ride_assignments
set sunday_date = public.current_service_sunday()
where sunday_date is null;

do $migration$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'guard_drivers_before_update'
      and tgrelid = 'public.drivers'::regclass
      and not tgisinternal
  ) then
    execute 'alter table public.drivers enable trigger guard_drivers_before_update';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgname = 'guard_riders_before_update'
      and tgrelid = 'public.riders'::regclass
      and not tgisinternal
  ) then
    execute 'alter table public.riders enable trigger guard_riders_before_update';
  end if;
end;
$migration$;

alter table public.drivers alter column sunday_date set default public.current_service_sunday();
alter table public.riders alter column sunday_date set default public.current_service_sunday();
alter table public.ride_assignments alter column sunday_date set default public.current_service_sunday();

alter table public.drivers alter column sunday_date set not null;
alter table public.riders alter column sunday_date set not null;
alter table public.ride_assignments alter column sunday_date set not null;

alter table public.drivers drop constraint if exists drivers_user_id_key;
alter table public.riders drop constraint if exists riders_user_id_key;

create unique index if not exists drivers_user_id_sunday_date_key
on public.drivers (user_id, sunday_date);

create unique index if not exists riders_user_id_sunday_date_key
on public.riders (user_id, sunday_date);

drop index if exists idx_drivers_location_time;
drop index if exists idx_riders_status;
drop index if exists idx_riders_location_time;

create index if not exists idx_drivers_sunday_location_time
on public.drivers (sunday_date, pickup_location, pickup_time)
where active = true;

create index if not exists idx_riders_sunday_status
on public.riders (sunday_date, status);

create index if not exists idx_riders_sunday_location_time
on public.riders (sunday_date, pickup_location, selected_time);

create or replace function public.available_driver_slots()
returns table (
  pickup_location text,
  pickup_time text
)
language sql
stable
security definer
set search_path = public
as $available_driver_slots$
  select d.pickup_location, d.pickup_time
  from public.drivers d
  where d.active = true
    and d.sunday_date = public.current_service_sunday()
  group by d.pickup_location, d.pickup_time
  order by d.pickup_location, d.pickup_time;
$available_driver_slots$;

create or replace function public.run_auto_match()
returns integer
language plpgsql
security definer
set search_path = public
as $run_auto_match$
declare
  rider_row public.riders%rowtype;
  candidate_driver_id uuid;
  assigned_count integer := 0;
  target_sunday date := public.current_service_sunday();
begin
  if not public.can_manage_rides() then
    raise exception 'Not authorized to run auto match.';
  end if;

  for rider_row in
    select *
    from public.riders
    where sunday_date = target_sunday
      and status = 'pending_assignment'
      and assigned_driver_id is null
    order by created_at asc
  loop
    select d.id
    into candidate_driver_id
    from public.drivers d
    left join public.riders ar
      on ar.assigned_driver_id = d.id
      and ar.status = 'assigned'
      and ar.sunday_date = target_sunday
    where d.active = true
      and d.sunday_date = target_sunday
      and d.pickup_location = rider_row.pickup_location
      and (d.pickup_time = rider_row.selected_time or rider_row.selected_time = 'To be coordinated')
    group by d.id, d.created_at, d.available_seats
    having count(ar.id) < d.available_seats
    order by count(ar.id) asc, d.created_at asc
    limit 1;

    if candidate_driver_id is not null then
      update public.riders
      set status = 'assigned',
          assigned_driver_id = candidate_driver_id,
          selected_time = (select pickup_time from public.drivers where id = candidate_driver_id)
      where id = rider_row.id;

      insert into public.ride_assignments (driver_id, rider_id, sunday_date, assigned_by, assignment_method)
      values (candidate_driver_id, rider_row.id, target_sunday, auth.uid(), 'auto')
      on conflict (rider_id)
      do update set
        driver_id = excluded.driver_id,
        sunday_date = excluded.sunday_date,
        assigned_by = excluded.assigned_by,
        assignment_method = excluded.assignment_method,
        created_at = now();

      assigned_count := assigned_count + 1;
    end if;
  end loop;

  return assigned_count;
end;
$run_auto_match$;

create or replace function public.assign_rider_to_driver(
  target_rider_id uuid,
  target_driver_id uuid,
  method text default 'manual'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $assign_rider_to_driver$
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

  if rider_row.sunday_date <> driver_row.sunday_date then
    raise exception 'Rider and driver must belong to the same Sunday cycle.';
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
    and sunday_date = rider_row.sunday_date
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

  insert into public.ride_assignments (driver_id, rider_id, sunday_date, assigned_by, assignment_method)
  values (target_driver_id, target_rider_id, rider_row.sunday_date, auth.uid(), coalesce(method, 'manual'))
  on conflict (rider_id)
  do update set
    driver_id = excluded.driver_id,
    sunday_date = excluded.sunday_date,
    assigned_by = excluded.assigned_by,
    assignment_method = excluded.assignment_method,
    created_at = now();

  return true;
end;
$assign_rider_to_driver$;

grant execute on function public.current_service_sunday() to authenticated;

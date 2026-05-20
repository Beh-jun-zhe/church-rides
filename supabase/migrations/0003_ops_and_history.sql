-- Ops improvements:
-- - Audit log
-- - Reminder run tracking

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  sunday_date date,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_runs (
  id uuid primary key default gen_random_uuid(),
  sunday_date date not null,
  reminder_group text not null check (reminder_group in ('drivers', 'riders')),
  trigger_source text not null check (trigger_source in ('manual', 'cron')),
  triggered_by uuid references public.profiles(id) on delete set null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_sunday_date on public.audit_logs (sunday_date);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_reminder_runs_sunday_date on public.reminder_runs (sunday_date desc);
create index if not exists idx_reminder_runs_group on public.reminder_runs (reminder_group, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.reminder_runs enable row level security;

drop policy if exists "audit_logs_select_manage" on public.audit_logs;
drop policy if exists "audit_logs_insert_self" on public.audit_logs;
drop policy if exists "reminder_runs_select_manage" on public.reminder_runs;
drop policy if exists "reminder_runs_insert_manage" on public.reminder_runs;

create policy "audit_logs_select_manage"
on public.audit_logs
for select
to authenticated
using (public.can_manage_rides());

create policy "audit_logs_insert_self"
on public.audit_logs
for insert
to authenticated
with check (
  auth.uid() = actor_id
  or public.can_manage_rides()
);

create policy "reminder_runs_select_manage"
on public.reminder_runs
for select
to authenticated
using (public.can_manage_rides());

create policy "reminder_runs_insert_manage"
on public.reminder_runs
for insert
to authenticated
with check (public.can_manage_rides());

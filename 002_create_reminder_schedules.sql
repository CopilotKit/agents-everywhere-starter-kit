-- Tabla public.reminder_schedules.

create table if not exists public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  scheduled_at timestamptz not null,
  recurrence text,
  timezone text not null default 'UTC',
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminder_schedules_reminder_id_idx
  on public.reminder_schedules (reminder_id);

create index if not exists reminder_schedules_due_idx
  on public.reminder_schedules (status, scheduled_at);

drop trigger if exists reminder_schedules_set_updated_at on public.reminder_schedules;
create trigger reminder_schedules_set_updated_at
before update on public.reminder_schedules
for each row execute function public.set_updated_at();

alter table public.reminder_schedules enable row level security;

drop policy if exists reminder_schedules_owner_policy on public.reminder_schedules;
create policy reminder_schedules_owner_policy
on public.reminder_schedules
for all
to authenticated
using (
  exists (
    select 1
    from public.reminders r
    where r.id = reminder_schedules.reminder_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reminders r
    where r.id = reminder_schedules.reminder_id
      and r.user_id = auth.uid()
  )
);

-- Tabla public.reminder_deliveries.

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  schedule_id uuid not null references public.reminder_schedules(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_deliveries_sent_at check (
    (status = 'sent' and sent_at is not null) or status <> 'sent'
  )
);

create index if not exists reminder_deliveries_reminder_id_idx
  on public.reminder_deliveries (reminder_id);

create index if not exists reminder_deliveries_due_idx
  on public.reminder_deliveries (status, scheduled_for);

-- Evita dos entregas para el mismo recordatorio en la misma ejecución programada.
create unique index if not exists reminder_deliveries_schedule_time_uidx
  on public.reminder_deliveries (schedule_id, scheduled_for);

drop trigger if exists reminder_deliveries_set_updated_at on public.reminder_deliveries;
create trigger reminder_deliveries_set_updated_at
before update on public.reminder_deliveries
for each row execute function public.set_updated_at();

alter table public.reminder_deliveries enable row level security;

drop policy if exists reminder_deliveries_owner_policy on public.reminder_deliveries;
create policy reminder_deliveries_owner_policy
on public.reminder_deliveries
for all
to authenticated
using (
  exists (
    select 1
    from public.reminders r
    where r.id = reminder_deliveries.reminder_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reminders r
    where r.id = reminder_deliveries.reminder_id
      and r.user_id = auth.uid()
  )
);

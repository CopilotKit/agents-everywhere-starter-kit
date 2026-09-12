-- Tabla public.reminders y dependencias compartidas.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  task text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  timezone text not null default 'UTC',
  start_at timestamptz not null,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_end_after_start check (end_at is null or end_at >= start_at)
);

create index if not exists reminders_user_id_idx
  on public.reminders (user_id);

create index if not exists reminders_status_idx
  on public.reminders (status);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;

drop policy if exists reminders_owner_policy on public.reminders;
create policy reminders_owner_policy
on public.reminders
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

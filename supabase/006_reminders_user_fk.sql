-- Apunta reminders.user_id a public.users (Telegram), no a auth.users.
-- Ejecutar después de 001–005.

alter table public.reminders
  drop constraint if exists reminders_user_id_fkey;

alter table public.reminders
  add constraint reminders_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

-- Las policies con auth.uid() no aplican al bot de Telegram (service_role).
drop policy if exists reminders_owner_policy on public.reminders;
drop policy if exists reminder_schedules_owner_policy on public.reminder_schedules;
drop policy if exists reminder_deliveries_owner_policy on public.reminder_deliveries;

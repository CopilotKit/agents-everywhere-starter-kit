-- Alinea las tablas iniciales con acordate-contracts.md.
-- Es segura tanto para el esquema de la primera integración como para una
-- instalación nueva que ejecuta 001–008 antes de esta migración.

alter table public.users
  alter column telegram_id type text using telegram_id::text;

alter table public.users
  add column if not exists timezone text;

update public.users
set timezone = 'America/Asuncion'
where timezone is null or btrim(timezone) = '';

alter table public.users
  alter column timezone set default 'America/Asuncion',
  alter column timezone set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'memories'
      and column_name = 'source_message'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'memories'
      and column_name = 'source_message_id'
  ) then
    alter table public.memories rename column source_message to source_message_id;
  end if;
end;
$$;

alter table public.memories
  add column if not exists source_message_id text;

update public.memories
set source_message_id = coalesce(nullif(source_message_id, ''), 'legacy-memory-' || id::text)
where source_message_id is null or source_message_id = '';

alter table public.memories
  alter column source_message_id set not null;

alter table public.reminders
  add column if not exists scheduled_at timestamptz,
  add column if not exists context text,
  add column if not exists source_memory_ids uuid[] not null default '{}',
  add column if not exists source_message_id text,
  add column if not exists sent_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.reminders
  drop constraint if exists reminders_status_check;

update public.reminders
set
  scheduled_at = coalesce(scheduled_at, start_at),
  context = coalesce(nullif(context, ''), nullif(task, ''), title),
  source_memory_ids = coalesce(source_memory_ids, '{}'),
  source_message_id = coalesce(nullif(source_message_id, ''), 'legacy-reminder-' || id::text),
  status = case status
    when 'active' then 'pending'
    when 'completed' then 'completed'
    else 'failed'
  end;

alter table public.reminders
  alter column scheduled_at set not null,
  alter column context set not null,
  alter column source_message_id set not null,
  alter column status set default 'pending';

alter table public.reminders
  add constraint reminders_status_check
  check (status in ('pending', 'sent', 'completed', 'failed'));

create index if not exists reminders_due_pending_idx
  on public.reminders (status, scheduled_at);

drop function if exists public.match_memories(vector, uuid, integer, double precision);
drop function if exists public.search_memories_text(uuid, text, integer);

create function public.match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer default 3,
  match_threshold double precision default 0.5
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  source_message_id text,
  similarity double precision,
  created_at timestamptz
)
language sql
stable
as $$
  select
    m.id,
    m.user_id,
    m.content,
    m.source_message_id,
    (1 - (m.embedding <=> query_embedding))::double precision as similarity,
    m.created_at
  from public.memories m
  where m.user_id = match_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= match_threshold
  order by m.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 3);
$$;

create function public.search_memories_text(
  match_user_id uuid,
  search_query text,
  match_count integer default 3
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  source_message_id text,
  rank double precision,
  created_at timestamptz
)
language sql
stable
as $$
  select
    m.id,
    m.user_id,
    m.content,
    m.source_message_id,
    ts_rank(
      to_tsvector('spanish', m.content),
      plainto_tsquery('spanish', search_query)
    )::double precision as rank,
    m.created_at
  from public.memories m
  where m.user_id = match_user_id
    and to_tsvector('spanish', m.content)
        @@ plainto_tsquery('spanish', search_query)
  order by rank desc, m.created_at desc
  limit least(greatest(match_count, 1), 3);
$$;

grant execute on function public.match_memories(vector, uuid, integer, double precision)
  to service_role;
grant execute on function public.search_memories_text(uuid, text, integer)
  to service_role;

-- Un claim separado conserva los únicos cuatro estados permitidos en reminders
-- y evita que dos corridas envíen el mismo aviso antes de confirmar Telegram.
create table if not exists public.reminder_delivery_claims (
  reminder_id uuid primary key references public.reminders(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.reminder_delivery_claims enable row level security;

create or replace function public.claim_due_reminders(
  run_at timestamptz,
  batch_size integer default 50
)
returns setof public.reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select r.id
    from public.reminders r
    where r.status = 'pending'
      and r.scheduled_at <= run_at
      and not exists (
        select 1 from public.reminder_delivery_claims c
        where c.reminder_id = r.id
      )
    order by r.scheduled_at asc
    limit least(greatest(batch_size, 1), 100)
    for update of r skip locked
  ), claimed as (
    insert into public.reminder_delivery_claims (reminder_id, claimed_at)
    select id, run_at from candidates
    on conflict (reminder_id) do nothing
    returning reminder_id
  )
  select r.*
  from public.reminders r
  join claimed c on c.reminder_id = r.id;
end;
$$;

create or replace function public.mark_reminder_delivered(
  target_reminder_id uuid,
  delivered_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reminders
  set status = 'sent', sent_at = delivered_at
  where id = target_reminder_id
    and status = 'pending'
    and exists (
      select 1 from public.reminder_delivery_claims
      where reminder_id = target_reminder_id
    );

  if not found then
    raise exception 'Reminder delivery claim no longer exists';
  end if;

  delete from public.reminder_delivery_claims
  where reminder_id = target_reminder_id;
end;
$$;

create or replace function public.mark_reminder_delivery_failed(
  target_reminder_id uuid,
  failed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reminders
  set status = 'failed', updated_at = failed_at
  where id = target_reminder_id
    and status = 'pending'
    and exists (
      select 1 from public.reminder_delivery_claims
      where reminder_id = target_reminder_id
    );

  delete from public.reminder_delivery_claims
  where reminder_id = target_reminder_id;
end;
$$;

grant execute on function public.claim_due_reminders(timestamptz, integer)
  to service_role;
grant execute on function public.mark_reminder_delivered(uuid, timestamptz)
  to service_role;
grant execute on function public.mark_reminder_delivery_failed(uuid, timestamptz)
  to service_role;

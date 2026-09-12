-- Tabla public.memories: información que el usuario pide recordar.

create extension if not exists vector;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  source_message text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_user_id_idx
  on public.memories (user_id);

create index if not exists memories_content_fts_idx
  on public.memories
  using gin (to_tsvector('spanish', content));

drop trigger if exists memories_set_updated_at on public.memories;
create trigger memories_set_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

-- El bot de Telegram escribe con service_role, que bypasea RLS.
alter table public.memories enable row level security;

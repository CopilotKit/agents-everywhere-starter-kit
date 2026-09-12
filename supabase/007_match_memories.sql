-- Búsqueda de memorias: similitud vectorial + texto (FTS español).

create or replace function public.match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer default 5,
  match_threshold double precision default 0.5
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  source_message text,
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
    m.source_message,
    (1 - (m.embedding <=> query_embedding))::double precision as similarity,
    m.created_at
  from public.memories m
  where m.user_id = match_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= match_threshold
  order by m.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.search_memories_text(
  match_user_id uuid,
  search_query text,
  match_count integer default 5
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  source_message text,
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
    m.source_message,
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
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_memories(vector, uuid, integer, double precision)
  to service_role;

grant execute on function public.search_memories_text(uuid, text, integer)
  to service_role;

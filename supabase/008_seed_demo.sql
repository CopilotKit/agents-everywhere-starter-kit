-- Datos de prueba para la demo Acordate.
-- Requiere 001–006. Re-ejecutable (idempotente por telegram_id / ids fijos).
--
-- Nota: embedding queda NULL. La búsqueda por texto (search_memories_text) funciona.
-- La búsqueda vectorial necesita que alguien genere embeddings después.

insert into public.users (id, telegram_id)
values (
  '11111111-1111-1111-1111-111111111111',
  100000001
)
on conflict (telegram_id) do update
set updated_at = now();

insert into public.memories (id, user_id, content, source_message)
values
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'Para retirar el certificado necesito cédula y comprobante.',
    'Guardá que para retirar el certificado necesito cédula y comprobante.'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'La oficina de certificados abre de lunes a viernes de 8 a 12.',
    'Acordate que la oficina abre de 8 a 12.'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111111',
    'El turno del dentista es el jueves a las 16:30 en el centro.',
    'Guardá: dentista jueves 16:30 en el centro.'
  )
on conflict (id) do update
set
  content = excluded.content,
  source_message = excluded.source_message,
  updated_at = now();

insert into public.reminders (
  id,
  user_id,
  title,
  task,
  status,
  timezone,
  start_at
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Retirar certificado',
  'Retirar el certificado. Necesitás llevar cédula y comprobante.',
  'active',
  'America/Asuncion',
  now() + interval '1 hour'
)
on conflict (id) do update
set
  title = excluded.title,
  task = excluded.task,
  status = excluded.status,
  start_at = excluded.start_at,
  updated_at = now();

insert into public.reminder_schedules (
  id,
  reminder_id,
  scheduled_at,
  timezone,
  status
)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  now() + interval '1 hour',
  'America/Asuncion',
  'active'
)
on conflict (id) do update
set
  scheduled_at = excluded.scheduled_at,
  status = excluded.status,
  updated_at = now();

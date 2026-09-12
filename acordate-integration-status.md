# ACORDATE — Estado de integración

Actualiza este tablero cada 20–30 minutos y antes de cada integración. La
persona 5 es dueña del documento; cada responsable actualiza su propia fila.

## Leyenda

| Estado | Uso |
| --- | --- |
| `⬜ No iniciado` | No hay trabajo integrado todavía. |
| `🟡 En curso` | Se está construyendo; aún no cumple el criterio de salida. |
| `🟢 Integrado` | Está en la rama de integración y pasó su prueba acordada. |
| `🔴 Bloqueado` | Requiere una decisión, credencial o corrección externa. |

## Snapshot de auditoría — 2026-09-12

Corrección realizada sobre `origin/main@414e66d`. El build, typecheck y suite
offline pasan; health y los controles de autenticación fueron probados
localmente. Supabase acepta la credencial de servidor, pero falta aplicar la
migración 009 antes de las escrituras end-to-end.

| Área | Responsable | Estado | Criterio para declarar “integrado” | Dependencia / bloqueo | Evidencia |
| --- | --- | --- | --- | --- | --- |
| Contratos de integración | P5 | 🟡 En curso | Documento aceptado por P1–P4. | Código unificado; falta aceptación explícita y aplicar SQL 009. | `acordate-contracts.md`; tests P2/P4. |
| Configuración segura | P5 | 🟡 En curso | Variables cargadas localmente y en deploy, sin secretos en Git. | Variables locales presentes e ignoradas; falta `CRON_SECRET` y configurar deploy. | `.env.example`; chequeo de Git. |
| Telegram y webhook | P1 | 🟡 En curso | Mensaje real entra y recibe respuesta; secreto inválido devuelve `401`. | Construye `AgentTurn` real y falla cerrado; falta mensaje real tras migrar Supabase. | Test webhook y request local `401`/`200`. |
| Agente y tools | P2 | 🟢 Integrado | Las cuatro tools siguen los contratos y manejan datos faltantes. | Depende de la migración para persistir. | `npm run verify`: test del agente con mock. |
| Usuarios y memoria | P3 | 🟡 En curso | Guarda y busca sin filtrar datos entre usuarios. | El adaptador REST y SQL 009 están listos; la migración aún no está aplicada. | Lectura Supabase `200`; columnas esperadas devuelven `400`. |
| Reminders y scheduler | P4 | 🟡 En curso | Crea, envía una vez y completa un reminder. | Repositorio, claim atómico y endpoint listos; faltan migración y secreto cron. | Tests del scheduler y ruta `401`. |
| Deploy / health | P5 | 🟡 En curso | URL HTTPS responde `GET /api/health`. | Ruta local aprobada; falta URL HTTPS/deploy. | `GET /api/health` local `200`. |
| Demo end-to-end | P5 | 🔴 Bloqueado | Checklist 2.1–2.5 aprobado. | Pendiente aplicar 009, configurar cron y probar Telegram desplegado. | `acordate-qa-checklist.md`. |

## Registro de integración

Agregar una fila por intento; no borrar fallos. Esto evita que el equipo repita
diagnósticos ya realizados.

| Hora | Integración probada | Resultado | Próximo paso | Dueño |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |
| 2026-09-12 | Auditoría del primer corte sobre `origin/main@414e66d` | No aprobado: faltan health, rutas de scheduler y adaptadores; `npm ci` no instala por lockfile desactualizado. | Reparar primero lockfile y contratos, luego repetir 0.6 y 1.1–1.8 con evidencia. | P5 + P1–P4 |
| 2026-09-12 | Corrección de integración local | `npm run verify` pasó; health `200`, webhook sin secreto `401`, update autenticado ignorado `200`, scheduler sin secreto `401`. | Aplicar `supabase/009_acordate_contract_alignment.sql`, configurar cron y repetir la demo real. | P5 + P3 + P4 |

## Bloqueos que requieren decisión inmediata

| Bloqueo | Impacto | Dueño para resolver | Decisión / fecha |
| --- | --- | --- | --- |
| Confirmar dónde vivirá el backend Next.js de Acordate sin alterar las plantillas heredadas. | Sin ello no se pueden integrar webhook, agent y scheduler. | Equipo + P5 | Pendiente, antes de implementar módulos. |
| Crear/controlar las cuentas de Telegram Bot, Supabase, OpenAI y Vercel. | Bloquea pruebas reales y deploy. | Equipo | Pendiente. |
| `package-lock.json` no declara el workspace `reminders@0.1.0`. | `npm ci`, typecheck y tests del monorepo no son reproducibles. | P4 + P5 | Regenerar lockfile con la versión de `package.json`; ejecutar `npm ci` limpio. |
| Contratos incompatibles: P2 usa `dueAt`/`memoryIds` y estados `pending`/`completed`; P4 usa `scheduledAt`/`sourceMemoryIds` y cuatro estados; SQL usa `active`/`paused`/`cancelled`. | No se puede crear, enviar ni completar un reminder mediante una interfaz única. | P2 + P3 + P4 | Elegir `acordate-contracts.md` como fuente de verdad y adaptar las tres capas. |
| Faltan `/api/health` y `/api/internal/run-due-reminders`; el webhook queda abierto cuando el secreto no está configurado. | No hay preflight/deploy verificable y existe riesgo de procesar webhooks no autenticados. | P1 + P4 | Implementar rutas, exigir secretos al iniciar y repetir 0.5, 1.2, 1.7 y 3.4. |
| El proyecto Supabase aún no tiene el esquema de contrato (`timezone`, `source_message_id`, reminder canónico y RPCs). | Bloquea escritura real, búsqueda y scheduler. | P3 + P5 | Aplicar `supabase/009_acordate_contract_alignment.sql` desde SQL Editor y volver a probar 1.4–1.8. |

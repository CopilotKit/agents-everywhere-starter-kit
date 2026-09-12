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

## Snapshot inicial

| Área | Responsable | Estado | Criterio para declarar “integrado” | Dependencia / bloqueo | Evidencia |
| --- | --- | --- | --- | --- | --- |
| Contratos de integración | P5 | 🟢 Integrado | Documento aceptado por P1–P4. | Falta confirmación del equipo. | `acordate-contracts.md` |
| Configuración segura | P5 | 🟡 En curso | Variables cargadas localmente y en deploy, sin secretos en Git. | Credenciales de Telegram, OpenAI y Supabase. | `.env.example` |
| Telegram y webhook | P1 | ⬜ No iniciado | Mensaje real entra y recibe respuesta; secreto inválido devuelve `401`. | Bot token, URL desplegada. | |
| Agente y tools | P2 | ⬜ No iniciado | Las cuatro tools siguen los contratos y manejan datos faltantes. | OpenAI key, interfaces finales. | |
| Usuarios y memoria | P3 | ⬜ No iniciado | Guarda y busca sin filtrar datos entre usuarios. | Proyecto/credenciales Supabase. | |
| Reminders y scheduler | P4 | ⬜ No iniciado | Crea, envía una vez y completa un reminder. | Tabla reminders, credenciales Telegram. | |
| Deploy / health | P5 | ⬜ No iniciado | URL HTTPS responde `GET /api/health`. | Implementación mínima Next.js. | |
| Demo end-to-end | P5 | ⬜ No iniciado | Checklist 2.1–2.5 aprobado. | Todos los módulos. | |

## Registro de integración

Agregar una fila por intento; no borrar fallos. Esto evita que el equipo repita
diagnósticos ya realizados.

| Hora | Integración probada | Resultado | Próximo paso | Dueño |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

## Bloqueos que requieren decisión inmediata

| Bloqueo | Impacto | Dueño para resolver | Decisión / fecha |
| --- | --- | --- | --- |
| Confirmar dónde vivirá el backend Next.js de Acordate sin alterar las plantillas heredadas. | Sin ello no se pueden integrar webhook, agent y scheduler. | Equipo + P5 | Pendiente, antes de implementar módulos. |
| Crear/controlar las cuentas de Telegram Bot, Supabase, OpenAI y Vercel. | Bloquea pruebas reales y deploy. | Equipo | Pendiente. |

# ACORDATE — Checklist de integración y QA

Este checklist pertenece a la persona 5. No se marca una prueba como pasada
solo porque un componente responda: debe quedar evidencia verificable en la
columna correspondiente.

## Convenciones

| Estado | Significado |
| --- | --- |
| `⬜ Pendiente` | Aún no se probó o depende de otro módulo. |
| `🟡 Bloqueado` | No puede continuar; anotar dueño y causa. |
| `🟢 Pasó` | Resultado observado y evidencia guardada. |
| `🔴 Falló` | Se reprodujo un error; enlazar issue o registro. |

**Evidencia válida:** captura de Telegram sin secretos, ID de una fila de
Supabase, salida sanitizada del endpoint, o video breve. Nunca pegar tokens,
headers de autorización ni URLs con credenciales.

## 0. Prevuelo de integración

| # | Prueba | Responsable | Estado | Evidencia / notas |
| --- | --- | --- | --- | --- |
| 0.1 | `acordate-contracts.md` está aceptado por las personas 1–4. | P5 | ⬜ Pendiente | |
| 0.2 | La rama de integración contiene los cambios requeridos, sin conflictos. | P5 | ⬜ Pendiente | |
| 0.3 | `.env` local contiene todas las variables de Acordate; no se versiona. | P5 | ⬜ Pendiente | |
| 0.4 | Las variables equivalentes están cargadas en el entorno de Vercel/Supabase que corresponda. | P5 | ⬜ Pendiente | |
| 0.5 | `GET /api/health` en la URL desplegada devuelve `200` y no expone secretos. | P1 + P5 | ⬜ Pendiente | |
| 0.6 | El chequeo de tipos y las pruebas definidas por el proyecto pasan antes de desplegar. | P5 | ⬜ Pendiente | Comando y salida: |

## 1. Pruebas por frontera

| # | Frontera | Caso y resultado esperado | Responsable | Estado | Evidencia / notas |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Telegram → webhook | Un mensaje normal llega al endpoint, se identifica el chat y recibe una respuesta mock o real. | P1 | ⬜ Pendiente | |
| 1.2 | Seguridad del webhook | Un request sin `X-Telegram-Bot-Api-Secret-Token` recibe `401`; no crea usuario, memoria ni reminder. | P1 + P5 | ⬜ Pendiente | |
| 1.3 | Backend → agente | “Guardá que necesito cédula” produce la intención `saveMemory` con `userId` y `sourceMessageId`. | P2 | ⬜ Pendiente | |
| 1.4 | Agente → memoria | La tool guarda el contenido y devuelve un `memory.id` del mismo `userId`. | P2 + P3 | ⬜ Pendiente | |
| 1.5 | Memoria → agente | Una búsqueda relacionada devuelve, como máximo, tres memorias del usuario correcto. | P2 + P3 | ⬜ Pendiente | |
| 1.6 | Agente → reminder | “Recordame … en 2 minutos” crea un reminder futuro `pending`, con `context` y `sourceMemoryIds`. | P2 + P4 | ⬜ Pendiente | |
| 1.7 | Scheduler → Telegram | Una pasada autorizada encuentra el reminder vencido, Telegram confirma el envío y el estado pasa a `sent` una sola vez. | P1 + P4 | ⬜ Pendiente | |
| 1.8 | “Hecho” → completado | El `AgentTurn` incluye el último reminder `sent`; la tool deja ese reminder en `completed`. | P1 + P2 + P4 | ⬜ Pendiente | |

## 2. Prueba end-to-end de la demo

Ejecutar en el mismo chat de Telegram y guardar una captura/clip continuo.

| Paso | Acción | Resultado esperado | Estado | Evidencia / notas |
| --- | --- | --- | --- | --- |
| 2.1 | Enviar: “Guardá que para retirar el certificado necesito cédula y comprobante.” | Acordate confirma que guardó la memoria; existe una fila en `memories`. | ⬜ Pendiente | |
| 2.2 | Enviar: “Recordame retirar el certificado en 2 minutos.” | Recupera la memoria y confirma la fecha/hora del reminder; existe una fila `pending`. | ⬜ Pendiente | |
| 2.3 | Esperar o ejecutar una pasada autorizada del scheduler cuando ya esté vencido. | Llega: “🔔 Recordatorio / Retirar certificado / Necesitás llevar cédula y comprobante.” | ⬜ Pendiente | |
| 2.4 | Enviar: “Hecho”. | Responde con confirmación y la misma fila queda `completed`. | ⬜ Pendiente | |
| 2.5 | Enviar “Hecho” otra vez. | No cambia datos y explica que no hay recordatorio activo. | ⬜ Pendiente | |

## 3. Casos de seguridad, aislamiento y recuperación

| # | Caso | Resultado esperado | Responsable | Estado | Evidencia / notas |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Usuario B pregunta por el certificado de Usuario A. | `searchMemory` no devuelve datos de A. | P3 + P5 | ⬜ Pendiente | |
| 3.2 | Usuario pide “recordame mañana” sin hora. | El agente pide una hora; no se crea reminder. | P2 | ⬜ Pendiente | |
| 3.3 | Scheduler intenta enviar y Telegram falla. | El reminder queda `failed`, no `sent`; el detalle técnico queda solo en logs. | P1 + P4 | ⬜ Pendiente | |
| 3.4 | Llamada al scheduler sin `CRON_SECRET`. | Devuelve `401` y no procesa reminders. | P4 + P5 | ⬜ Pendiente | |
| 3.5 | Revisión de repo y demo. | No hay `.env`, tokens, IDs privados ni trazas sensibles en Git, capturas o video. | P5 | ⬜ Pendiente | |

## Criterio para code freeze

Solo se entra en code freeze cuando 2.1–2.5 están `🟢 Pasó`, 3.1 y 3.2 pasan,
y hay al menos una evidencia de recuperación o error controlado (3.3 o 3.4).
Después: **bug → fix → repetir la prueba afectada → demo**. No se agregan
features nuevas.

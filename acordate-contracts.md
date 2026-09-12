# ACORDATE — Contratos de integración (MVP)

Este documento es la fuente de verdad para las personas 1–5. Si un módulo
necesita cambiarlo, se acuerda aquí antes de modificar la implementación.

## Decisiones cerradas

- El canal es **Telegram Bot API**; no habrá frontend web en el MVP.
- Cada usuario de Telegram corresponde a un único `users.id` interno.
- Se almacenan las fechas en UTC y se expresan como ISO 8601, por ejemplo
  `2026-09-12T13:00:00.000Z`.
- El perfil se crea con `timezone = "America/Asuncion"`. Si el usuario
  proporciona otra zona, se actualiza antes de calcular `scheduledAt`.
- La memoria que se incorpore a un recordatorio debe provenir de
  `searchMemory`; el agente no inventa contexto.
- Un aviso enviado queda en estado `sent`. Solo un recordatorio `sent` puede
  pasar a `completed` mediante “Hecho”.

## Identidad y mensaje entrante

Persona 1 convierte el `Update` de Telegram al siguiente objeto y crea o busca
el usuario antes de invocar al agente. Los IDs externos se tratan como texto.

```ts
type IncomingMessage = {
  telegramUserId: string;
  chatId: string;
  messageId: string;
  text: string;
  receivedAt: string; // ISO UTC
};

type User = {
  id: string; // UUID interno
  telegramId: string; // único
  timezone: string; // IANA; inicialmente America/Asuncion
  createdAt: string; // ISO UTC
};

type AgentTurn = {
  userId: string;
  text: string;
  sourceMessageId: string;
  receivedAt: string; // ISO UTC
  timezone: string;
  activeSentReminder: Pick<Reminder, "id" | "title" | "context"> | null;
};
```

Persona 1 construye un `AgentTurn` y el agente recibe ese objeto, nunca un
`telegramUserId`. Para “Hecho”, persona 1 consulta el último reminder `sent`
del usuario y lo entrega como `activeSentReminder`; persona 2 usa su `id` al
llamar `completeReminder`.

## Contrato común de resultados y errores

Las tools no devuelven excepciones de infraestructura al modelo. Devuelven una
respuesta estructurada; el adaptador de Telegram convierte el resultado en un
mensaje humano.

```ts
type ToolErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NO_ACTIVE_REMINDER"
  | "CONFLICT"
  | "UNAVAILABLE";

type ToolFailure = {
  ok: false;
  code: ToolErrorCode;
  message: string; // seguro para mostrar al usuario
};
```

Los resultados exitosos incluyen `ok: true`. Los secretos, SQL, trazas y
mensajes internos no llegan a Telegram.

## Entidades persistentes

```ts
type Memory = {
  id: string; // UUID
  userId: string;
  content: string;
  sourceMessageId: string;
  createdAt: string; // ISO UTC
};

type ReminderStatus = "pending" | "sent" | "completed" | "failed";

type Reminder = {
  id: string; // UUID
  userId: string;
  title: string;
  scheduledAt: string; // ISO UTC
  status: ReminderStatus;
  context: string;
  sourceMemoryIds: string[];
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string; // ISO UTC
};
```

Restricciones de base de datos:

- `users.telegram_id` es `UNIQUE`.
- `memories.user_id` y `reminders.user_id` referencian `users.id`.
- `reminders.status` acepta únicamente los cuatro estados definidos arriba.
- `scheduled_at`, `sent_at`, `completed_at` y `created_at` se guardan como
  `timestamptz`.

## Tools del agente

Los campos obligatorios se validan con Zod. Los ejemplos muestran los objetos
que cruzan la frontera agente ↔ servicios, no una API pública.

### `saveMemory`

Se utiliza solo cuando el usuario pide explícitamente guardar/recordar un dato.

```ts
type SaveMemoryInput = {
  userId: string;
  content: string;
  sourceMessageId: string;
};

type SaveMemoryResult =
  | { ok: true; memory: Memory }
  | ToolFailure;
```

### `searchMemory`

Devuelve como máximo tres memorias del mismo usuario, ordenadas por relevancia.
Una búsqueda vacía es inválida.

```ts
type SearchMemoryInput = {
  userId: string;
  query: string;
};

type SearchMemoryResult =
  | {
      ok: true;
      memories: Array<Pick<Memory, "id" | "content" | "createdAt"> & {
        score: number; // 0–1; mayor es mejor
      }>;
    }
  | ToolFailure;
```

No encontrar una memoria **no es un error**: se devuelve
`{ ok: true, memories: [] }`. En ese caso, el agente pregunta por el contexto
faltante en vez de inventarlo.

### `createReminder`

El agente convierte expresiones como “mañana a las 10” a UTC usando la zona del
usuario. Si no puede determinar una fecha/hora futura, debe pedir aclaración y
no llamar la tool.

```ts
type CreateReminderInput = {
  userId: string;
  title: string;
  scheduledAt: string; // ISO UTC, estrictamente futuro
  context: string;
  sourceMemoryIds: string[]; // [] si el usuario no dio contexto previo
  sourceMessageId: string;
};

type CreateReminderResult =
  | { ok: true; reminder: Reminder }
  | ToolFailure;
```

`context` debe ser corto y apto para enviar por Telegram. Para la demo:
`"Necesitás llevar cédula y comprobante."`.

### `completeReminder`

Para evitar completar una tarea equivocada, el handler resuelve el último
recordatorio `sent` del usuario y pasa su ID a esta tool. Si no existe uno,
devuelve `NO_ACTIVE_REMINDER` y no modifica datos.

```ts
type CompleteReminderInput = {
  userId: string;
  reminderId: string;
};

type CompleteReminderResult =
  | { ok: true; reminder: Reminder }
  | ToolFailure;
```

La transición permitida es únicamente `sent → completed`; guarda
`completedAt`. Una segunda confirmación responde con `CONFLICT`.

## Endpoints de integración

Estos son los únicos endpoints que necesitan acordar los módulos durante el
MVP. Las tools permanecen internas al backend.

| Endpoint | Protección | Contrato mínimo |
| --- | --- | --- |
| `GET /api/health` | Ninguna; no expone configuración | Devuelve `200` y `{ "ok": true, "service": "acordate" }` cuando el proceso está vivo. |
| `POST /api/telegram/webhook` | Header `X-Telegram-Bot-Api-Secret-Token` igual a `TELEGRAM_WEBHOOK_SECRET` | Recibe un `Update`, lo adapta a `IncomingMessage` y devuelve `200` para un update aceptado. Un secreto ausente o incorrecto devuelve `401` sin crear datos. |
| `POST /api/internal/run-due-reminders` | `Authorization: Bearer <CRON_SECRET>` | Ejecuta una pasada del scheduler y devuelve `{ "ok": true, "processed": number, "sent": number, "failed": number }`. Sin credencial válida devuelve `401`. |

`ACORDATE_PUBLIC_URL` determina el webhook que se registra en Telegram:
`{ACORDATE_PUBLIC_URL}/api/telegram/webhook`. Persona 5 verifica la URL pública;
persona 1 registra el webhook una vez que ese endpoint responde correctamente.

## Límites entre módulos

| Responsable | Entrega / garantía |
| --- | --- |
| Persona 1 — Telegram | Valida el secreto del webhook, adapta `Update` a `IncomingMessage`, resuelve `userId`, construye el `AgentTurn` y envía texto. Para “Hecho”, incorpora el último reminder `sent` como `activeSentReminder`. |
| Persona 2 — Agente | Clasifica intención, llama las cuatro tools con estos tipos, pide aclaración ante datos faltantes y redacta la respuesta. |
| Persona 3 — Memoria | Implementa `users`, `memories`, `saveMemory` y `searchMemory`; nunca devuelve memoria de otro `userId`. |
| Persona 4 — Recordatorios | Implementa `reminders`, `createReminder`, `completeReminder` y el scheduler. Antes de enviar, cambia a `sent` solo después de que Telegram confirme el envío. |
| Persona 5 — Integración | Mantiene este contrato, configura secretos/deploy, prueba cada frontera y conserva evidencia de las pruebas. |

## Scheduler y entrega

El scheduler consulta recordatorios con:

```text
status = pending AND scheduled_at <= now()
```

Por cada uno, construye el aviso:

```text
🔔 Recordatorio
{title}
{context}
Respondé “Hecho” cuando lo completes.
```

Si Telegram confirma el envío: `pending → sent`, con `sentAt`.
Si falla: `pending → failed` y se registra el detalle técnico solo en logs. El
MVP no reintenta automáticamente; nunca lo marca como `sent` sin confirmación.

## Prueba de aceptación compartida

Datos de demostración y resultado esperado:

1. Usuario: “Guardá que para retirar el certificado necesito cédula y
   comprobante.”
   - Se crea una `Memory` para ese `userId`.
2. Usuario: “Recordame retirar el certificado en 2 minutos.”
   - `searchMemory` devuelve la memoria anterior.
   - Se crea un `Reminder` `pending`, con el texto anterior en `context`.
3. Scheduler: llega la hora.
   - Telegram recibe el aviso; el reminder queda `sent`.
4. Usuario: “Hecho”.
   - Se completa ese reminder y queda `completed`.
5. Usuario: “Hecho” otra vez.
   - No cambia ningún reminder y recibe una respuesta clara de que no hay un
     recordatorio activo.

## Variables de entorno (nombres acordados)

```dotenv
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Se configuran en Vercel/Supabase según corresponda. No se añaden valores a Git,
ni se usan prefijos `NEXT_PUBLIC_` para claves de servidor.

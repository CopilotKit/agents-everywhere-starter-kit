# ACORDATE --- PLAN DE TRABAJO EXPRESS

## Hackathon AI Everywhere --- Demo funcional en 4 horas

## 1. Objetivo

Construir una demo de punta a punta que demuestre:

**MEMORIA → RAZONAMIENTO → ACCIÓN → CONTEXTO**

Flujo:

1.  El usuario escribe por Telegram una información.
2.  Acordate la guarda.
3.  El usuario pide un recordatorio relacionado.
4.  El agente recupera la memoria relevante.
5.  Se crea el recordatorio.
6.  Llega el aviso por Telegram con el contexto necesario.
7.  El usuario dice "Hecho".
8.  Acordate marca la tarea como completada.

**No buscamos construir el producto completo. Buscamos una demo
sólida.**

------------------------------------------------------------------------

# 2. Canal: Telegram

## ¿Por qué Telegram?

Para esta demo usamos **Telegram como canal principal**.

La propuesta original estaba orientada a WhatsApp, pero el propio
documento indica que la elegibilidad de un número paraguayo para este
caso de uso debe validarse y que, si no se resuelve, el panel web sería
el respaldo.

Para una hackathon con solo 4 horas:

-   Telegram evita depender de la aprobación/elegibilidad de Meta.
-   El bot puede recibir y enviar mensajes directamente.
-   Es suficiente para demostrar la experiencia conversacional.
-   WhatsApp puede quedar como integración futura.

**Decisión actual: TELEGRAM.**

------------------------------------------------------------------------

# 3. Stack

## 3.1 Telegram Bot API --- Canal

### ¿Qué hace?

Es la puerta de entrada y salida del producto.

Recibe:

-   mensajes del usuario;
-   comandos;
-   confirmaciones como "hecho".

Y permite enviar:

-   respuestas del agente;
-   recordatorios;
-   mensajes con contexto.

### Flujo

``` text
Usuario
   ↓
Telegram
   ↓
Webhook
   ↓
Next.js
```

Y para los avisos:

``` text
Scheduler
   ↓
Backend
   ↓
Telegram
   ↓
Usuario
```

Telegram no toma decisiones de IA. Solo transporta los mensajes.

------------------------------------------------------------------------

## 3.2 Next.js + TypeScript --- Backend

### ¿Qué hace?

Es el servidor que conecta todas las piezas.

Responsabilidades:

-   recibir el webhook de Telegram;
-   identificar al usuario;
-   enviar el mensaje al agente;
-   ejecutar las tools;
-   conectarse a Supabase;
-   devolver respuestas a Telegram;
-   exponer endpoints internos;
-   manejar errores.

### ¿Por qué?

Necesitamos un punto central que coordine:

``` text
Telegram ↔ Agente ↔ Tools ↔ Supabase
```

TypeScript permite mantener tipos claros entre los módulos.

------------------------------------------------------------------------

## 3.3 AI SDK + OpenAI --- Agente

### ¿Qué hace?

Es el "cerebro" de Acordate.

Interpreta mensajes como:

> "Guardá que para retirar el certificado necesito cédula y
> comprobante."

o:

> "Recordame retirar el certificado mañana a las 10."

El agente decide qué acción ejecutar.

Ejemplo:

``` text
Mensaje
  ↓
Agente
  ↓
¿Es información para guardar?
  ↓
saveMemory()
```

Otro ejemplo:

``` text
“Recordame retirar el certificado”
            ↓
     searchMemory()
            ↓
   encuentra contexto
            ↓
    createReminder()
```

### Importante

El modelo **no escribe directamente en la base de datos**.

Decide qué tool utilizar y con qué parámetros.

Las tools hacen las operaciones reales.

------------------------------------------------------------------------

## 3.4 Zod --- Validación

### ¿Qué hace?

Valida los datos que propone el agente antes de ejecutar una acción.

Ejemplo:

``` ts
createReminder({
  title: string,
  scheduledAt: string
})
```

Si el agente genera datos inválidos:

``` text
Agente
  ↓
Zod
  ↓
❌ inválido → no ejecutar
```

Esto evita que una decisión incorrecta del modelo rompa la base de
datos.

### En la demo

Cada tool debe tener un esquema Zod.

------------------------------------------------------------------------

## 3.5 Supabase + PostgreSQL --- Base de datos

### ¿Qué hace?

Guarda el estado permanente de Acordate.

Para la demo necesitamos como mínimo:

``` text
users
memories
reminders
```

### `users`

Identifica al usuario de Telegram.

``` text
id
telegram_id
created_at
```

### `memories`

Guarda información que el usuario quiere que Acordate recuerde.

``` text
id
user_id
content
source_message
created_at
embedding
```

### `reminders`

Guarda las tareas programadas.

``` text
id
user_id
title
scheduled_at
status
context
created_at
```

Supabase también nos permite administrar PostgreSQL y centralizar el
backend de datos rápidamente.

------------------------------------------------------------------------

## 3.6 pgvector + búsqueda de texto --- Memoria

### ¿Qué hace?

Permite que Acordate encuentre información previamente guardada.

Ejemplo:

Primero:

> "Para retirar el certificado necesito cédula y comprobante."

Después:

> "¿Qué necesito llevar para buscar el documento?"

Aunque las palabras no sean exactamente iguales, la memoria puede
encontrar el contenido relacionado.

La idea es combinar:

-   búsqueda por significado;
-   búsqueda por palabras clave.

El resultado debe conservar la referencia al mensaje original.

------------------------------------------------------------------------

## 3.7 Supabase Cron + Edge Functions --- Recordatorios

### ¿Qué hace?

Se ocupa de revisar qué recordatorios ya llegaron a su momento de
ejecución.

Flujo:

``` text
Supabase
   ↓
Cron
   ↓
Busca reminders pendientes
   ↓
¿Ya llegó la hora?
   ↓
Sí
   ↓
Enviar mensaje por Telegram
   ↓
Marcar como enviado
```

La IA no necesita estar "pensando" constantemente.

El scheduler se ocupa de ejecutar los recordatorios guardados.

### Para la demo

Construir solamente el camino mínimo necesario para generar un aviso
real.

No implementar un sistema complejo de recurrencias si pone en riesgo la
demo.

------------------------------------------------------------------------

## 3.8 Vercel --- Deploy

### ¿Qué hace?

Publica el backend de Next.js en Internet.

Necesitamos que Telegram pueda llegar al webhook.

``` text
Telegram
   ↓ Internet
Vercel
   ↓
Next.js
```

También permite tener una URL pública para la demo.

------------------------------------------------------------------------

# 4. Tools mínimas

Para las 4 horas:

### `saveMemory()`

Guarda información del usuario.

``` text
Usuario → “Guardá que necesito cédula”
       ↓
saveMemory()
       ↓
Supabase
```

### `searchMemory()`

Busca información guardada.

``` text
Usuario → “¿Qué necesito llevar?”
       ↓
searchMemory()
       ↓
Memoria relevante
```

### `createReminder()`

Crea un recordatorio.

``` text
Usuario → “Recordame mañana a las 10”
       ↓
createReminder()
       ↓
Supabase
```

### `completeReminder()`

Marca la tarea como realizada.

``` text
Usuario → “Hecho”
       ↓
completeReminder()
       ↓
status = completed
```

### Dejar para después

``` text
listReminders()
updateReminder()
cancelReminder()
```

------------------------------------------------------------------------

# 5. Roles del equipo

Somos 5 personas y **todos trabajan simultáneamente**.

No hay una etapa donde "uno termina y recién después empieza el otro".

## PERSONA 1 --- Telegram + Backend

### ¿Para qué existe este rol?

Construye el canal que conecta al usuario con el sistema.

### Hace

-   Crear/configurar Telegram Bot.
-   Webhook.
-   Endpoint de entrada.
-   Identificación del usuario.
-   Envío de respuestas.
-   Conexión Telegram → Next.js.
-   Manejo básico de errores.

### Entregable

``` text
Telegram
   ↓
Next.js
   ↓
respuesta
   ↓
Telegram
```

Puede usar respuestas mock mientras el agente todavía está siendo
construido.

------------------------------------------------------------------------

# PERSONA 2 --- Agente + IA

### ¿Para qué existe este rol?

Construye el cerebro que interpreta el lenguaje natural y decide qué
herramienta usar.

### Hace

-   Prompt del sistema.
-   AI SDK.
-   Integración con OpenAI.
-   Tool calling.
-   Las 4 tools mínimas.
-   Zod.
-   Manejo de información faltante.

### Entregable

``` text
Mensaje
  ↓
Agente
  ↓
Tool correcta
  ↓
Resultado
```

Puede trabajar completamente aislado de Telegram usando mensajes de
prueba.

------------------------------------------------------------------------

# PERSONA 3 --- Supabase + Memoria

### ¿Para qué existe este rol?

Construye la memoria permanente y la base de datos.

### Hace

-   Crear proyecto Supabase.
-   Crear tablas.
-   Relaciones.
-   `saveMemory`.
-   `searchMemory`.
-   pgvector.
-   búsqueda de texto.
-   Datos de prueba.

### Entregable

``` text
saveMemory()
      ↓
Supabase
      ↓
searchMemory()
      ↓
memoria encontrada
```

Puede trabajar sin esperar al agente.

------------------------------------------------------------------------

# PERSONA 4 --- Recordatorios + Scheduler

### ¿Para qué existe este rol?

Hace que Acordate no solamente "responda", sino que **haga algo
después**.

### Hace

-   `createReminder()`.
-   `completeReminder()`.
-   Estructura de reminders.
-   Scheduler.
-   Supabase Cron/Edge Function.
-   Trigger de envío.
-   Estado del reminder.

### Entregable

``` text
createReminder()
       ↓
Supabase
       ↓
Scheduler
       ↓
Telegram
       ↓
🔔 Aviso
```

Puede usar un `user_id` y datos mock mientras Telegram todavía no está
conectado.

------------------------------------------------------------------------

# PERSONA 5 --- Integración + QA + Deploy

### ¿Para qué existe este rol?

Evita que los cuatro módulos funcionen individualmente pero fallen
cuando se conectan.

### Hace desde el minuto 0

-   Crear/revisar repositorio.
-   Configurar ramas.
-   Variables `.env`.
-   Vercel.
-   Revisar contratos.
-   Probar endpoints.
-   Integrar ramas.
-   Detectar errores.
-   Preparar datos de demo.
-   Preparar el guion.
-   Hacer pruebas end-to-end.

### Importante

Esta persona **no espera hasta el final** para integrar.

Va probando constantemente.

------------------------------------------------------------------------

# 6. Cómo trabajar EN SIMULTÁNEO

## Minuto 0--20: contrato común

Los 5 se reúnen únicamente para definir:

### Flujo

``` text
Guardar memoria
      ↓
Crear recordatorio
      ↓
Recuperar memoria
      ↓
Enviar aviso
      ↓
Completar
```

### Tools

``` text
saveMemory
searchMemory
createReminder
completeReminder
```

### Datos

``` text
users
memories
reminders
```

### Contratos

Todos acuerdan exactamente los inputs/outputs.

Ejemplo:

``` ts
saveMemory({
  userId: string,
  content: string
})
```

``` ts
searchMemory({
  userId: string,
  query: string
})
```

``` ts
createReminder({
  userId: string,
  title: string,
  scheduledAt: string
})
```

``` ts
completeReminder({
  userId: string,
  reminderId: string
})
```

Después de esto:

**TODOS SE SEPARAN Y TRABAJAN EN PARALELO.**

------------------------------------------------------------------------

# 7. Trabajo paralelo por bloques

## 0:20--1:20

``` text
PERSONA 1 → Telegram + webhook
PERSONA 2 → Agente + tools
PERSONA 3 → Supabase + memoria
PERSONA 4 → Reminders + scheduler
PERSONA 5 → Deploy + integración + QA
```

Nadie espera a nadie.

------------------------------------------------------------------------

## 1:20--2:00 --- Primera integración

Se conectan los módulos:

``` text
Telegram
   ↓
Backend
   ↓
Agente
   ↓
saveMemory
   ↓
Supabase
```

Objetivo:

> "Guardá que para retirar el certificado necesito cédula y
> comprobante."

Debe quedar guardado.

------------------------------------------------------------------------

## 2:00--2:40 --- Segunda integración

Ahora:

``` text
Telegram
   ↓
Agente
   ↓
searchMemory
   ↓
createReminder
   ↓
Supabase
```

Objetivo:

> "Recordame retirar el certificado mañana a las 10."

El agente recupera el contexto y crea el reminder.

------------------------------------------------------------------------

## 2:40--3:20 --- Aviso

Conectar:

``` text
Supabase
   ↓
Scheduler
   ↓
Telegram
```

Debe llegar:

> 🔔 Recordatorio\
> Retirar certificado.\
> Necesitás llevar cédula y comprobante.

------------------------------------------------------------------------

## 3:20--3:40 --- Completar

``` text
“Hecho”
   ↓
completeReminder()
   ↓
status = completed
```

------------------------------------------------------------------------

## 3:40--4:00 --- CODE FREEZE

No se agregan funcionalidades.

Solo:

``` text
BUG → FIX → TEST → DEMO
```

------------------------------------------------------------------------

# 8. Arquitectura final

``` text
                         ┌──────────────┐
                         │    USUARIO   │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   TELEGRAM   │
                         └──────┬───────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │ Next.js / Backend  │
                     └─────────┬──────────┘
                               │
                               ▼
                     ┌────────────────────┐
                     │ AI SDK + OpenAI    │
                     │      AGENTE        │
                     └─────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
       saveMemory()      searchMemory()   createReminder()
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ▼
                         ┌────────────┐
                         │  SUPABASE  │
                         │ PostgreSQL  │
                         └─────┬──────┘
                               │
                               ▼
                         ┌────────────┐
                         │    CRON    │
                         └─────┬──────┘
                               │
                               ▼
                         ┌────────────┐
                         │  TELEGRAM  │
                         └─────┬──────┘
                               │
                               ▼
                            🔔 AVISO
```

------------------------------------------------------------------------

# 9. Qué NO hacemos

Durante estas 4 horas quedan fuera:

-   ❌ Frontend web
-   ❌ WhatsApp
-   ❌ Audio
-   ❌ PDF/documentos
-   ❌ Auth
-   ❌ RAG complejo
-   ❌ Recurrencias complejas
-   ❌ Las 7 tools completas
-   ❌ Dashboard
-   ❌ Features secundarias

------------------------------------------------------------------------

# 10. Regla principal

> **NO estamos construyendo Acordate completo.**
>
> Estamos construyendo una demo funcional que demuestra:
>
> **MEMORIA → RAZONAMIENTO → ACCIÓN → CONTEXTO**

Si el usuario puede:

**guardar algo → pedir un recordatorio relacionado → recibirlo con
contexto → marcarlo como hecho**

entonces tenemos una demo.

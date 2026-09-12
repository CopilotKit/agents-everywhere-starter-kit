# Deploy Acordate en Vercel

## Antes del deploy

1. Aplicá en Supabase SQL Editor: [`supabase/009_acordate_contract_alignment.sql`](supabase/009_acordate_contract_alignment.sql).
2. Generá un `CRON_SECRET` nuevo (no reutilices uno compartido por chat):

```bash
openssl rand -hex 32
```

3. En este repo ya existen:
   - `GET /api/health`
   - `POST /api/internal/run-due-reminders`
   - `POST /api/telegram/webhook`

## Crear el proyecto en Vercel

1. Entrá a https://vercel.com/new e importá el repo (el de tu equipo en GitHub).
2. **Root Directory:** raíz del monorepo (`.` / vacío). **No** uses `apps/channel` — Acordate vive en `apps/web`.
3. Framework: Next.js.
4. Cargá estas **Environment Variables** (Production + Preview):

| Variable | Origen |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys (secret) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | ej. `gemini-2.0-flash` |
| `CRON_SECRET` | el que generaste arriba |
| `ACORDATE_PUBLIC_URL` | URL HTTPS final sin slash (setear después del 1er deploy) |

**No uses** prefijo `NEXT_PUBLIC_` para ninguna de estas.

5. Deploy.

## Después del primer deploy

1. Copiá la URL (`https://….vercel.app`) y setéala como `ACORDATE_PUBLIC_URL`. Redeploy si hace falta.
2. Registrá el webhook de Telegram:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${ACORDATE_PUBLIC_URL}/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

3. Verificá:

```bash
curl -sS "${ACORDATE_PUBLIC_URL}/api/health"
curl -sS -X POST "${ACORDATE_PUBLIC_URL}/api/internal/run-due-reminders" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

## Cron (Hobby no permite cada minuto)

En plan **Hobby**, Vercel solo permite crons **1× por día**. Por eso [`vercel.json`](vercel.json) **no** declara cron.

Usá un cron externo cada minuto para la demo:

1. [cron-job.org](https://cron-job.org) (gratis) o similar
2. URL: `https://TU-APP.vercel.app/api/internal/run-due-reminders`
3. Método: `POST`
4. Header: `Authorization: Bearer <CRON_SECRET>`
5. Intervalo: cada 1 minuto

## Seguridad

Rotá las claves compartidas por chat antes de producción (Telegram, Supabase service role, Gemini, `CRON_SECRET`, webhook secret).

# Deploy

## The one thing that will bite you

A Channels listener is a **long-running worker holding an outbound websocket**.
Deploy it like a queue consumer.

| Works | Does not |
|---|---|
| Railway | Vercel functions |
| Fly.io, Render, plain Docker | any serverless request handler |

`apps/web` is an ordinary Next.js app and deploys to Vercel
fine. It is only the listener that needs a persistent process.

## Requirements

- Node.js 22+ (global `WebSocket`)
- One listening port for the host's health check — managed deliveries arrive over
  the Channel's own socket, not this port, but most platforms require it

## Health checks

Liveness and readiness are different signals:

- **Liveness** — the process and event loop are running
- **Readiness** — `channels.status().overall === "online"`

`server.ts` already refuses to start unless the Channel is online, so a broken
deploy fails loudly instead of serving as an agent that never answers.

Do **not** restart on `reconnecting` — the client handles a bounded (~60s)
reconnect. Alert on `error`.

## Scaling

Run **one listener instance for this demo**. Proposal approval
buttons use process-local inline handlers. Claim-based delivery gives each event
to one runtime; an identical replica may claim a click but lack its handler.
Restarting also loses pending inline handlers. Before scaling, implement shared
persistent action bindings and reconstructible registered-component handlers.

**But not across environments.** Two runtimes declaring the same Channel name in
the same project race per delivery and the loser gets nothing, silently. Give
your laptop its own Intelligence project so your local runtime never steals a
delivery from the deployed one.

## Secrets

Server-side only. Never log credentials, provider tokens, or raw payloads. Log
startup status, status transitions, the Channel code, tool errors with
idempotency ids, and event/turn/delivery ids for correlation — never message
bodies or files.

## WhatsApp

The [WhatsApp app](../apps/whatsapp/README.md) uses Channels' direct Meta adapter and its own environment. Expose its main port (3003 by default) through HTTPS for `/webhooks/whatsapp` and `/auth/callback`; keep the SDK listener port (3004 by default) private. Supply Meta credentials and a CopilotKit Intelligence key. Follow the app's deployment notes for single-process persistent storage, transport receipt limits, and Auth0 phone approval.

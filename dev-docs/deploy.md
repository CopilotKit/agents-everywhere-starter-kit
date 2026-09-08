# Deploy

## The one thing that will bite you

A Channels listener is a **long-running worker holding an outbound websocket**.
Deploy it like a queue consumer.

| Works | Does not |
|---|---|
| Railway | Vercel functions |
| Google Cloud Run *(min-instances ≥ 1, CPU always allocated)* | Netlify functions |
| Fly.io, Render, plain Docker | any serverless request handler |

`apps/web` (once you add it) is an ordinary Next.js app and deploys to Vercel
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

Claim-based delivery means replicas are safe: one runtime claims each delivery.
Run identical builds and identical Channel declarations.

**But not across environments.** Two runtimes declaring the same Channel name in
the same project race per delivery and the loser gets nothing, silently. Give
your laptop its own Intelligence project so your local runtime never steals a
delivery from the deployed one.

## Secrets

Server-side only. Never log credentials, provider tokens, or raw payloads. Log
startup status, status transitions, the Channel code, tool errors with
idempotency ids, and event/turn/delivery ids for correlation — never message
bodies or files.

# Deploy

## The one thing that will bite you

A Channels listener is a **long-running worker holding an outbound websocket**.
Deploy it like a queue consumer.

| Works | Does not |
|---|---|
| Railway | Vercel functions |
| Google Cloud Run *(min-instances ≥ 1, CPU always allocated)* | Netlify functions |
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

Run **one listener instance for this demo**. Proposal and research approval
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

## Google Cloud Run listener configuration

This is the deployment path for the [Cloud Run sponsor recipe](sponsors.md#google-cloud-run). It assumes you have prepared a container image; this repository does not supply a Dockerfile or a tested Cloud Run deployment.

1. Package the repository workspaces and dependencies in a Node.js 22+ Linux image. Run `npm ci` with development dependencies included: the source entrypoint uses `tsx`. Exclude `.env`, credentials, generated traces, and local dependencies from the image/build context. Set the container working directory to `apps/channel-slack` within the packaged repository (so `tsx` uses its Channels JSX configuration), and use this entrypoint, which reads injected environment variables without requiring a local `.env` file:

   ```bash
   node --import tsx src/server.ts
   ```

2. Test that image locally with your configured environment, then publish it to your container registry. In Cloud Run, follow [Deploy container images](https://cloud.google.com/run/docs/deploying). The listener reads Cloud Run's injected `PORT` and opens it only after the Channel reports online. Use a TCP startup probe; the kit does not provide a dedicated HTTP health endpoint. Managed messages arrive over an outbound connection, so the HTTP service does not need public unauthenticated access.
3. Configure non-secret `MODEL_PROVIDER`, `MODEL`, and `CHANNEL_CODE`. Inject the selected provider key and `INTELLIGENCE_API_KEY` through [Secret Manager](https://cloud.google.com/run/docs/configuring/secrets), granting the service identity access to the selected secrets. Add only the optional sponsor configuration your workflow uses; do not bake keys into the image.
4. Select [instance-based billing](https://cloud.google.com/run/docs/configuring/billing-settings) so CPU is available outside HTTP requests, and set service-level [minimum](https://cloud.google.com/run/docs/configuring/min-instances) and [maximum](https://cloud.google.com/run/docs/configuring/max-instances) instances to **1** for this demo. Minimum instances incur ongoing cost. A maximum of one is not a guarantee against transient overlap during replacement or deployment; do not roll out changes while approval buttons are pending. Avoid traffic splitting between listener revisions.
5. Stop any laptop listener using the same Intelligence project. Confirm the deployed logs report the Channel online, then mention the bot in a populated Slack thread and check its card against the thread. Exercise an approval while the same instance is running and retrieve completed research if configured. A healthy container alone is not proof of successful Slack delivery.

Instances can still restart. Pending inline approval buttons are lost on restart; create a fresh request if that happens. For durable research whose approval was already recorded, retrieve its run ID in the original conversation after the listener returns. See [scaling constraints](#scaling) before adapting this for production. No cloud deployment is performed by the kit's offline checks.

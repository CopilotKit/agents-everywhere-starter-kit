# Channels

## Delivery is two legs, and neither is Socket Mode

```
Slack ──HTTPS, signed with a signing secret Intelligence holds──▶ Intelligence
Teams ──Bot Framework activity, Microsoft-signed bearer JWT─────▶ Intelligence

Intelligence ──outbound websocket, authed by INTELLIGENCE_API_KEY──▶ your process
```

Two consequences worth internalising:

1. **You need no tunnel and no public URL.** This is the single biggest
   time-saver available on a 4-hour clock.
2. **Your process must be long-running.** It owns the gateway connection. A
   serverless request handler cannot host a Channel.

There is **no `xapp-` app-level token** anywhere on the managed path. Socket Mode
belongs only to the direct-adapter path. If you find yourself reaching for one,
you have drifted off the managed path.

> Slack wants a signing secret; Teams wants a Microsoft-signed bearer JWT.
> Crossing them produces an app that installs cleanly and authenticates nothing —
> the most expensive failure mode here, because it looks like it worked.

## What the managed path does and does not deliver

| Works | Does not |
|---|---|
| mentions, messages | slash commands |
| button and select clicks (so HITL fires) | modal submissions (`view_submission`) |
| reactions | |

Code that registers `onCommand` or `onModalSubmit` compiles, starts, reports
online, and never fires. That is not a bug in your code.

## Turn routing is not symmetric

- A **mentioned** turn goes to `onMention` if registered, else falls back to `onMessage`.
- A **non-mentioned** turn goes **only** to `onMessage`.

This kit subscribes the conversation on mention and gates `onMessage` on
`thread.isSubscribed()`, so the agent follows along after being invited in
without answering every message in every channel. Always verify with a **channel
mention** first.

## Status is not health

`channels.ready()` resolves on `setup_required` as well as `online`, because a
declared-but-unprovisioned Channel is a valid degraded state. Only
`channels.status().overall === "online"` means deliveries can land — which is why
`server.ts` refuses to start otherwise.

| Status | Meaning |
|---|---|
| `connecting` | activation in flight |
| `online` | connected — send a real provider message to verify the whole path |
| `setup_required` | declared but unprovisioned; finish the provider side |
| `reconnecting` | socket dropped, retrying (~60s). **Do not restart on this.** |
| `error` | activation failed; `ready()` rejects with the cause |
| `stopped` | `stop()` was called |

The Intelligence dashboard uses a *different* vocabulary (Disabled, Setup
incomplete, Waiting for runtime, Conflict, Offline, Delivery failing, Online).
"Waiting for runtime" usually means `CHANNEL_CODE` does not match the Channel
Code.

## Claim-based delivery

Multiple runtimes declaring the same Channel name race per delivery, and the
loser gets nothing — silently. The tell is a Slack reply your terminal knows
nothing about. **Give a local runtime its own Intelligence project.**

Replicas in production are fine: one runtime claims each delivery, so identical
builds scale horizontally.
